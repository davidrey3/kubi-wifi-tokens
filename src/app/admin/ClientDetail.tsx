'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { IconArrowLeft, IconUpload, IconUsers, IconPalette } from '@/components/Icons';
import { durLabel, initials, TOKEN_DURATIONS, type Client, type Profile, type TokenDuration } from '@/lib/format';
import { parseLinkyfiTokenCsv } from '@/lib/linkyfi-csv';
import type { Stat } from './AdminApp';

export function ClientDetail({
  client,
  stats,
  onBack,
  onChanged,
  showFlash,
}: {
  client: Client;
  stats: Stat[];
  onBack: () => void;
  onChanged: (c: Client) => void;
  showFlash: (m: string) => void;
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [users, setUsers] = useState<Profile[]>([]);

  // carga de tokens
  const [uploadDuration, setUploadDuration] = useState<TokenDuration>(1);
  const [codesText, setCodesText] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // nuevo usuario
  const [nuEmail, setNuEmail] = useState('');
  const [nuName, setNuName] = useState('');
  const [nuPassword, setNuPassword] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  // branding
  const [bName, setBName] = useState(client.name);
  const [bAccent, setBAccent] = useState(client.accent_color);
  const [bLabel, setBLabel] = useState(client.brand_label);
  const [bNetwork, setBNetwork] = useState(client.network_name);
  const [savingBrand, setSavingBrand] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const loadUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at');
    setUsers((data as Profile[]) ?? []);
  }, [supabase, client.id]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const parseCodes = (text: string) =>
    text
      .split(/[\s,;\n\r\t]+/)
      .map((c) => c.trim())
      .filter(Boolean);

  async function handleUploadTokens() {
    const codes = parseCodes(codesText);
    if (codes.length === 0) return showFlash('Pega o sube al menos un código');
    setUploading(true);
    const res = await fetch('/api/admin/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: client.id, duration_days: uploadDuration, codes }),
    });
    const json = await res.json();
    setUploading(false);
    if (!res.ok) return showFlash(`Error al cargar: ${json.error}`);
    setCodesText('');
    showFlash(`${json.inserted} tokens de ${durLabel(uploadDuration)} cargados`);
    onChanged(client);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const codes = parseLinkyfiTokenCsv(text);
      setCodesText(codes.join('\n'));
      showFlash(`${codes.length} tokens leídos de la columna B`);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleCreateUser() {
    if (!nuEmail.trim() || nuPassword.length < 8) {
      return showFlash('Correo válido y contraseña de 8+ caracteres requeridos');
    }
    setCreatingUser(true);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: nuEmail.trim(),
        password: nuPassword,
        full_name: nuName.trim(),
        client_id: client.id,
      }),
    });
    const json = await res.json();
    setCreatingUser(false);
    if (!res.ok) return showFlash(`Error: ${json.error}`);
    setNuEmail('');
    setNuName('');
    setNuPassword('');
    showFlash('Usuario creado');
    loadUsers();
  }

  async function handleDeleteUser(id: string, email: string) {
    if (!window.confirm(`¿Eliminar el usuario ${email}? Perderá el acceso al portal.`)) return;
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) return showFlash('No se pudo eliminar el usuario');
    showFlash('Usuario eliminado');
    loadUsers();
  }

  async function handleSaveBrand() {
    setSavingBrand(true);
    const res = await fetch('/api/admin/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: client.id,
        name: bName.trim() || client.name,
        accent_color: bAccent,
        brand_label: bLabel.trim(),
        network_name: bNetwork.trim(),
      }),
    });
    const json = await res.json();
    setSavingBrand(false);
    if (!res.ok) return showFlash(`Error: ${json.error}`);
    showFlash('Marca actualizada');
    onChanged(json as Client);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('client_id', client.id);
    const res = await fetch('/api/admin/logo', { method: 'POST', body: fd });
    const json = await res.json();
    setUploadingLogo(false);
    e.target.value = '';
    if (!res.ok) return showFlash(`Error subiendo logo: ${json.error}`);
    showFlash('Logo actualizado');
    onChanged({ ...client, logo_url: json.url });
  }

  const statFor = (d: number) =>
    stats.find((s) => Number(s.duration_days) === d) ?? { disponibles: 0, asignados: 0, activos: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <button className="btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        <IconArrowLeft size={15} /> Volver a clientes
      </button>

      {/* ===== Stats por duración ===== */}
      <div>
        <div className="micro-label" style={{ marginBottom: 12 }}>
          Consumo de tokens
        </div>
        <div className="token-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, maxWidth: 980 }}>
          {TOKEN_DURATIONS.map((d) => {
            const s = statFor(d);
            const low = Number(s.disponibles) < 50;
            return (
              <div
                key={d}
                style={{
                  background: '#131316',
                  border: `1px solid ${low ? 'rgba(255,107,107,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 14,
                  padding: '18px 20px',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>{durLabel(d)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Row label="Disponibles" value={String(s.disponibles)} color={low ? '#FF6B6B' : '#BCFF5E'} />
                  <Row label="Utilizados" value={String(s.asignados)} />
                  <Row label="Activos ahora" value={String(s.activos)} color="#C7C7CF" />
                </div>
                {low && (
                  <div style={{ marginTop: 10, fontSize: 11.5, color: '#FF6B6B', fontWeight: 700 }}>
                    ⚠ Por debajo del umbral (50)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== Cargar tokens ===== */}
      <div className="card" style={{ maxWidth: 980 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <IconUpload color="#BCFF5E" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Cargar tokens de Linkyfi</h3>
        </div>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: '#8E8E96' }}>
          Pega los códigos (uno por línea) o sube el CSV exportado de Linkyfi. Del CSV se importa únicamente la
          columna B (“Token code”) y los duplicados se omiten automáticamente.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {TOKEN_DURATIONS.map((d) => (
            <button
              key={d}
              className={`chip ${uploadDuration === d ? 'active' : ''}`}
              onClick={() => setUploadDuration(d)}
            >
              {durLabel(d)}
            </button>
          ))}
        </div>

        <textarea
          className="mono"
          value={codesText}
          onChange={(e) => setCodesText(e.target.value)}
          placeholder={'K7F2QP\nB5N4RT\nM2J5KD\n…'}
          rows={6}
          style={{
            width: '100%',
            padding: '12px 14px',
            fontSize: 13,
            color: '#F4F4F5',
            background: '#0E0E10',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button className="btn-accent" style={{ padding: '11px 20px', fontSize: 13.5 }} onClick={handleUploadTokens} disabled={uploading}>
            {uploading ? 'Cargando…' : `Cargar ${parseCodes(codesText).length || ''} tokens`}
          </button>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
            <IconUpload size={15} /> Subir CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      </div>

      {/* ===== Usuarios ===== */}
      <div className="card" style={{ maxWidth: 760 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <IconUsers color="#BCFF5E" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Usuarios del portal</h3>
        </div>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: '#8E8E96' }}>
          Cuentas de gerencia con acceso al portal de {client.name}.
        </p>

        {users.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 20 }}>
            {users.map((u) => (
              <div
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 12,
                    color: '#C7C7CF',
                    flexShrink: 0,
                  }}
                >
                  {initials(u.full_name || u.email)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{u.full_name || '—'}</div>
                  <div style={{ fontSize: 12, color: '#6A6A72' }}>{u.email}</div>
                </div>
                <button
                  className="btn-danger"
                  style={{ padding: '7px 14px', fontSize: 12.5 }}
                  onClick={() => handleDeleteUser(u.id, u.email)}
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="micro-label" style={{ marginBottom: 10 }}>
          Nuevo usuario
        </div>
        <div className="responsive-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <input className="input-sm" placeholder="Nombre" value={nuName} onChange={(e) => setNuName(e.target.value)} />
          <input className="input-sm" type="email" placeholder="correo@cliente.com" value={nuEmail} onChange={(e) => setNuEmail(e.target.value)} />
        </div>
        <div className="mobile-stack-row" style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <input
            className="input-sm"
            type="text"
            placeholder="Contraseña inicial (mín. 8)"
            value={nuPassword}
            onChange={(e) => setNuPassword(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn-accent" style={{ padding: '0 20px', fontSize: 13.5 }} onClick={handleCreateUser} disabled={creatingUser}>
            {creatingUser ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>
      </div>

      {/* ===== Marca ===== */}
      <div className="card" style={{ maxWidth: 760 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <IconPalette color="#BCFF5E" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Marca del portal</h3>
        </div>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: '#8E8E96' }}>
          Personaliza cómo ve el cliente su portal: logo, color de acento y nombre de la red.
        </p>

        <div className="mobile-stack-row" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <div
            style={{
              width: 120,
              height: 52,
              borderRadius: 10,
              background: '#0E0E10',
              border: '1px solid rgba(255,255,255,0.10)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {client.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={client.logo_url} alt="logo" style={{ maxWidth: '90%', maxHeight: '80%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: 11, color: '#6A6A72' }}>Sin logo</span>
            )}
          </div>
          <button className="btn-ghost" onClick={() => logoRef.current?.click()} disabled={uploadingLogo}>
            <IconUpload size={15} /> {uploadingLogo ? 'Subiendo…' : 'Subir logo'}
          </button>
          <input ref={logoRef} type="file" accept=".png,.jpg,.jpeg,.svg,.webp" style={{ display: 'none' }} onChange={handleLogoUpload} />
        </div>

        <div className="responsive-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label className="field-label">Nombre del cliente</label>
            <input className="input-sm" value={bName} onChange={(e) => setBName(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Color de acento</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="color"
                value={bAccent}
                onChange={(e) => setBAccent(e.target.value)}
                style={{ width: 42, height: 40, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
              />
              <input className="input-sm mono" value={bAccent} onChange={(e) => setBAccent(e.target.value)} style={{ fontSize: 13 }} />
            </div>
          </div>
          <div>
            <label className="field-label">Etiqueta de marca</label>
            <input className="input-sm" value={bLabel} onChange={(e) => setBLabel(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Nombre de la red WiFi</label>
            <input className="input-sm" value={bNetwork} onChange={(e) => setBNetwork(e.target.value)} />
          </div>
        </div>

        <button
          className="btn-accent"
          style={{ marginTop: 20, padding: '11px 22px', fontSize: 13.5, borderRadius: 10 }}
          onClick={handleSaveBrand}
          disabled={savingBrand}
        >
          {savingBrand ? 'Guardando…' : 'Guardar marca'}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, color = '#F4F4F5' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 12.5, color: '#8E8E96' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 800, color }}>{value}</span>
    </div>
  );
}
