'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { KubiLogo } from '@/components/KubiLogo';
import {
  IconBuilding,
  IconBell,
  IconSettings,
  IconLogout,
  IconCalendar,
  IconCheck,
  IconPlusCircle,
} from '@/components/Icons';
import { fmtDate, todayLabel, durLabel, initials, type Client, type Profile } from '@/lib/format';
import { ClientDetail } from './ClientDetail';

export type Stat = {
  client_id: string;
  duration_days: number;
  disponibles: number;
  asignados: number;
  activos: number;
};

type AlertRow = {
  id: string;
  client_id: string;
  duration_days: number;
  remaining: number;
  is_read: boolean;
  created_at: string;
};

type View = 'clientes' | 'alertas' | 'ajustes';

export function AdminApp({ profile }: { profile: Profile }) {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [view, setView] = useState<View>('clientes');
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);

  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();
  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 2600);
  }, []);

  const loadAll = useCallback(async () => {
    const [c, s, a] = await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('client_token_stats').select('*'),
      supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    setClients((c.data as Client[]) ?? []);
    setStats((s.data as Stat[]) ?? []);
    setAlerts((a.data as AlertRow[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const unread = alerts.filter((a) => !a.is_read).length;

  async function markAlertsRead() {
    await supabase.from('alerts').update({ is_read: true }).eq('is_read', false);
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? '—';

  const headerTitle = selectedClient
    ? selectedClient.name
    : view === 'clientes'
      ? 'Clientes'
      : view === 'alertas'
        ? 'Alertas'
        : 'Ajustes';
  const headerSubtitle = selectedClient
    ? 'Detalle del cliente'
    : view === 'clientes'
      ? 'Administración de portales'
      : view === 'alertas'
        ? 'Tokens por agotarse'
        : 'Tu cuenta de superadmin';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 256,
          flexShrink: 0,
          background: '#101012',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        <div style={{ padding: '24px 22px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <KubiLogo width={78} height={34} />
          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: '#6A6A72',
            }}
          >
            Superadmin
          </div>
        </div>

        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            className={`nav-item ${view === 'clientes' ? 'active' : ''}`}
            onClick={() => {
              setView('clientes');
              setSelectedClient(null);
              loadAll();
            }}
          >
            <IconBuilding /> Clientes
          </button>
          <button
            className={`nav-item ${view === 'alertas' ? 'active' : ''}`}
            onClick={() => {
              setView('alertas');
              setSelectedClient(null);
            }}
            style={{ position: 'relative' }}
          >
            <IconBell /> Alertas
            {unread > 0 && (
              <span
                style={{
                  marginLeft: 'auto',
                  background: '#FF6B6B',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 800,
                  borderRadius: 999,
                  padding: '1px 8px',
                }}
              >
                {unread}
              </span>
            )}
          </button>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '12px 8px' }} />

          <button
            className={`nav-item ${view === 'ajustes' ? 'active' : ''}`}
            onClick={() => {
              setView('ajustes');
              setSelectedClient(null);
            }}
          >
            <IconSettings /> Ajustes
          </button>
        </nav>

        <div style={{ padding: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 6px' }}>
            <div
              style={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #BCFF5E, #7fd42e)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 14,
                color: '#0B0B0C',
              }}
            >
              {initials(profile.full_name || 'Kubi Admin')}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile.full_name || 'Superadmin'}
              </div>
              <div style={{ fontSize: 11.5, color: '#6A6A72', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile.email}
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              style={{ flexShrink: 0, background: 'none', border: 'none', color: '#6A6A72', cursor: 'pointer', padding: 4, display: 'flex' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#FF6B6B')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#6A6A72')}
            >
              <IconLogout />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, background: '#0B0B0C' }}>
        <header
          style={{
            height: 68,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 34px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            position: 'sticky',
            top: 0,
            background: 'rgba(11,11,12,0.82)',
            backdropFilter: 'blur(10px)',
            zIndex: 5,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>{headerTitle}</h2>
            <div style={{ fontSize: 12.5, color: '#6A6A72', marginTop: 1 }}>{headerSubtitle}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#8E8E96' }}>
            <IconCalendar />
            {todayLabel()}
          </div>
        </header>

        <div style={{ padding: 34, maxWidth: 1080 }}>
          {selectedClient ? (
            <ClientDetail
              client={selectedClient}
              stats={stats.filter((s) => s.client_id === selectedClient.id)}
              onBack={() => {
                setSelectedClient(null);
                loadAll();
              }}
              onChanged={(c) => {
                setSelectedClient(c);
                loadAll();
              }}
              showFlash={showFlash}
            />
          ) : view === 'clientes' ? (
            <ClientList
              clients={clients}
              stats={stats}
              onSelect={(c) => setSelectedClient(c)}
              onNew={() => setShowNewClient(true)}
            />
          ) : view === 'alertas' ? (
            <AlertsView alerts={alerts} clientName={clientName} onMarkRead={markAlertsRead} />
          ) : (
            <AdminSettings profile={profile} showFlash={showFlash} onLogout={handleLogout} />
          )}
        </div>
      </main>

      {showNewClient && (
        <NewClientModal
          onClose={() => setShowNewClient(false)}
          onCreated={(c) => {
            setShowNewClient(false);
            showFlash(`Cliente ${c.name} creado`);
            loadAll();
            setSelectedClient(c);
          }}
        />
      )}

      {flash && (
        <div
          style={{
            position: 'fixed',
            bottom: 26,
            right: 26,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '13px 18px',
            background: '#1C1C21',
            border: '1px solid rgba(188,255,94,0.35)',
            borderRadius: 12,
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            animation: 'kubiToast 0.25s ease',
          }}
        >
          <IconCheck size={17} color="#BCFF5E" strokeWidth={2.4} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#F4F4F5' }}>{flash}</span>
        </div>
      )}
    </div>
  );
}

/* ================= Lista de clientes ================= */

function ClientList({
  clients,
  stats,
  onSelect,
  onNew,
}: {
  clients: Client[];
  stats: Stat[];
  onSelect: (c: Client) => void;
  onNew: () => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <p style={{ margin: 0, fontSize: 14.5, color: '#A0A0A8', maxWidth: 560, lineHeight: 1.55 }}>
          Cada cliente tiene su propio pool de tokens, usuarios y marca.
        </p>
        <button className="btn-accent" style={{ padding: '12px 20px', fontSize: 14 }} onClick={onNew}>
          <IconPlusCircle color="#0B0B0C" /> Nuevo cliente
        </button>
      </div>

      {clients.length === 0 && (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            border: '1px dashed rgba(255,255,255,0.10)',
            borderRadius: 16,
            color: '#8E8E96',
            fontSize: 14,
          }}
        >
          Aún no hay clientes. Crea el primero con “Nuevo cliente”.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {clients.map((c) => {
          const cs = stats.filter((s) => s.client_id === c.id);
          const disponibles = cs.reduce((a, s) => a + Number(s.disponibles), 0);
          const asignados = cs.reduce((a, s) => a + Number(s.asignados), 0);
          const low = cs.some((s) => Number(s.disponibles) < 50);
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              style={{
                textAlign: 'left',
                color: '#F4F4F5',
                background: 'linear-gradient(145deg, #1D211C 0%, #17181B 58%, #151518 100%)',
                border: `1px solid ${low ? 'rgba(255,107,107,0.40)' : 'rgba(188,255,94,0.16)'}`,
                borderRadius: 16,
                padding: 22,
                cursor: 'pointer',
                boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                transition: 'border-color 0.12s, transform 0.12s, box-shadow 0.12s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(188,255,94,0.42)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 14px 34px rgba(0,0,0,0.26)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = low ? 'rgba(255,107,107,0.40)' : 'rgba(188,255,94,0.16)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.18)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: `color-mix(in srgb, ${c.accent_color} 16%, #131316)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 14,
                    color: c.accent_color,
                    overflow: 'hidden',
                  }}
                >
                  {c.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logo_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    initials(c.name)
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#F4F4F5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#92929B' }}>{c.brand_label}</div>
                </div>
                {low && (
                  <span
                    className="badge"
                    style={{ marginLeft: 'auto', color: '#FF6B6B', background: 'rgba(255,107,107,0.10)', flexShrink: 0 }}
                  >
                    Pocos tokens
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11.5, color: '#92929B', marginBottom: 3 }}>Disponibles</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: low ? '#FF6B6B' : '#BCFF5E' }}>{disponibles}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: '#92929B', marginBottom: 3 }}>Utilizados</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#F4F4F5' }}>{asignados}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ================= Alertas ================= */

function AlertsView({
  alerts,
  clientName,
  onMarkRead,
}: {
  alerts: { id: string; client_id: string; duration_days: number; remaining: number; is_read: boolean; created_at: string }[];
  clientName: (id: string) => string;
  onMarkRead: () => void;
}) {
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 14.5, color: '#A0A0A8' }}>
          Se genera una alerta cuando a un cliente le quedan menos de 50 tokens de una duración.
        </p>
        {alerts.some((a) => !a.is_read) && (
          <button className="btn-ghost" onClick={onMarkRead}>
            Marcar todas como leídas
          </button>
        )}
      </div>

      {alerts.length === 0 && (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            border: '1px dashed rgba(255,255,255,0.10)',
            borderRadius: 16,
            color: '#8E8E96',
            fontSize: 14,
          }}
        >
          Sin alertas por ahora. Todo en orden.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {alerts.map((a) => (
          <div
            key={a.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: a.is_read ? '#131316' : '#17110F',
              border: `1px solid ${a.is_read ? 'rgba(255,255,255,0.08)' : 'rgba(255,107,107,0.3)'}`,
              borderRadius: 14,
              padding: '16px 20px',
            }}
          >
            <IconBell color={a.is_read ? '#6A6A72' : '#FF6B6B'} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {clientName(a.client_id)} — quedan {a.remaining} tokens de {durLabel(a.duration_days)}
              </div>
              <div style={{ fontSize: 12, color: '#6A6A72', marginTop: 2 }}>{fmtDate(a.created_at)}</div>
            </div>
            {!a.is_read && (
              <span className="badge" style={{ color: '#FF6B6B', background: 'rgba(255,107,107,0.10)' }}>
                Nueva
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= Ajustes superadmin ================= */

function AdminSettings({
  profile,
  showFlash,
  onLogout,
}: {
  profile: Profile;
  showFlash: (m: string) => void;
  onLogout: () => void;
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function savePassword() {
    if (pwNew.length < 8) return showFlash('La contraseña debe tener al menos 8 caracteres');
    if (pwNew !== pwConfirm) return showFlash('Las contraseñas no coinciden');
    setSaving(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: pwCurrent,
    });
    if (authErr) {
      setSaving(false);
      return showFlash('La contraseña actual no es correcta');
    }
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    setSaving(false);
    if (error) showFlash('No se pudo actualizar la contraseña');
    else {
      showFlash('Contraseña actualizada');
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 620 }}>
      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>Cambiar contraseña</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#8E8E96' }}>Usa una contraseña de al menos 8 caracteres.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="field-label">Contraseña actual</label>
            <input className="input-sm" type="password" placeholder="••••••••" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="field-label">Nueva contraseña</label>
              <input className="input-sm" type="password" placeholder="••••••••" value={pwNew} onChange={(e) => setPwNew(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Confirmar</label>
              <input className="input-sm" type="password" placeholder="••••••••" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} />
            </div>
          </div>
        </div>
        <button
          className="btn-accent"
          style={{ marginTop: 20, padding: '11px 22px', fontSize: 13.5, borderRadius: 10 }}
          onClick={savePassword}
          disabled={saving}
        >
          {saving ? 'Actualizando…' : 'Actualizar contraseña'}
        </button>
      </div>

      <div
        style={{
          background: '#131316',
          border: '1px solid rgba(255,107,107,0.18)',
          borderRadius: 16,
          padding: '22px 26px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>Cerrar sesión</div>
          <div style={{ fontSize: 13, color: '#8E8E96', marginTop: 2 }}>Saldrás del dashboard de administración.</div>
        </div>
        <button className="btn-danger" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

/* ================= Modal nuevo cliente ================= */

function NewClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Client) => void }) {
  const [name, setName] = useState('');
  const [accent, setAccent] = useState('#BCFF5E');
  const [brandLabel, setBrandLabel] = useState('');
  const [networkName, setNetworkName] = useState('Kubi WiFi');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return setError('El nombre es obligatorio.');
    setSaving(true);
    setError(null);
    const res = await fetch('/api/admin/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        accent_color: accent,
        brand_label: brandLabel.trim() || `${name.trim()} x Kubi`,
        network_name: networkName.trim() || 'Kubi WiFi',
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return setError(json.error ?? 'No se pudo crear el cliente.');
    onCreated(json as Client);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 40,
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 460, animation: 'kubiRise 0.25s ease' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>Nuevo cliente</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#8E8E96' }}>
          Crea el portal de un nuevo cliente. Luego podrás subir su logo, tokens y usuarios.
        </p>

        <label className="field-label">Nombre del cliente</label>
        <input
          className="input-sm"
          placeholder="Ej. Puerto Amber Cove"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ marginBottom: 16 }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label className="field-label">Color de acento</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                style={{ width: 42, height: 40, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
              />
              <input className="input-sm mono" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ fontSize: 13 }} />
            </div>
          </div>
          <div>
            <label className="field-label">Nombre de la red WiFi</label>
            <input className="input-sm" value={networkName} onChange={(e) => setNetworkName(e.target.value)} />
          </div>
        </div>

        <label className="field-label">Etiqueta de marca</label>
        <input
          className="input-sm"
          placeholder={name ? `${name} x Kubi` : 'Ej. Amber Cove x Kubi'}
          value={brandLabel}
          onChange={(e) => setBrandLabel(e.target.value)}
          style={{ marginBottom: 20 }}
        />

        {error && <p style={{ margin: '0 0 14px', fontSize: 13, color: '#FF6B6B', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-accent" style={{ padding: '10px 22px', fontSize: 14 }} onClick={create} disabled={saving}>
            {saving ? 'Creando…' : 'Crear cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}
