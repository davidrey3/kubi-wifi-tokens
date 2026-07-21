'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { KubiLogo } from '@/components/KubiLogo';
import {
  IconPlusCircle,
  IconSearch,
  IconList,
  IconSettings,
  IconLogout,
  IconCalendar,
  IconCopy,
  IconBolt,
  IconCheck,
  IconAlert,
} from '@/components/Icons';
import { fmtDate, todayLabel, durLabel, initials, type Client, type Profile, type TokenRow } from '@/lib/format';

type Section = 'crear' | 'consultar' | 'detalles' | 'ajustes';

type Generated = {
  code: string;
  duration_days: number;
  assigned_at: string;
  expires_at: string;
};

type ConsultaResult =
  | { found: false; code: string }
  | { found: true; code: string; duration_days: number; assigned_at: string; expires_at: string };

const TITLES: Record<Section, { title: string; subtitle: string }> = {
  crear: { title: 'Crear Token', subtitle: 'Genera un nuevo acceso WiFi' },
  consultar: { title: 'Consultar Token', subtitle: 'Verifica el estado de un token' },
  detalles: { title: 'Detalles Token', subtitle: 'Historial completo de tokens' },
  ajustes: { title: 'Ajustes', subtitle: 'Administra tu cuenta' },
};

export function PanelApp({ profile, client }: { profile: Profile; client: Client }) {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [section, setSection] = useState<Section>('crear');
  const [selectedDuration, setSelectedDuration] = useState<1 | 3 | 7>(3);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [consultaInput, setConsultaInput] = useState('');
  const [consultaResult, setConsultaResult] = useState<ConsultaResult | undefined>(undefined);
  const [consultando, setConsultando] = useState(false);

  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<'todos' | 'activo' | 'expirado'>('todos');
  const [search, setSearch] = useState('');

  const [fullName, setFullName] = useState(profile.full_name);
  const [savingAccount, setSavingAccount] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();

  function showFlash(msg: string) {
    setFlash(msg);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 2200);
  }

  async function loadTokens() {
    const { data } = await supabase
      .from('tokens')
      .select('id, code, duration_days, status, assigned_at, expires_at, created_at')
      .eq('status', 'asignado')
      .order('assigned_at', { ascending: false });
    setTokens((data as TokenRow[]) ?? []);
  }

  useEffect(() => {
    loadTokens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch('/api/tokens/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: selectedDuration }),
      });
      const json = await res.json();
      if (!res.ok) {
        setGenError(
          json.error === 'sin_tokens_disponibles'
            ? `No quedan tokens disponibles de ${durLabel(selectedDuration)}. Contacta a Kubi.`
            : 'No se pudo generar el token. Intenta de nuevo.'
        );
        return;
      }
      setGenerated(json);
      setCopied(false);
      showFlash('Token generado correctamente');
      loadTokens();
    } catch {
      setGenError('Error de conexión. Intenta de nuevo.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!generated) return;
    await navigator.clipboard.writeText(generated.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function handleConsulta() {
    const code = consultaInput.trim().toUpperCase();
    if (!code) return;
    setConsultando(true);
    const { data, error } = await supabase.rpc('lookup_token', { p_code: code });
    setConsultando(false);
    if (error) {
      setConsultaResult({ found: false, code });
      return;
    }
    if (data?.found) {
      setConsultaResult({ ...data, code: data.code });
    } else {
      setConsultaResult({ found: false, code });
    }
  }

  async function handleSaveAccount() {
    setSavingAccount(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', profile.id);
    setSavingAccount(false);
    if (error) showFlash('No se pudieron guardar los cambios');
    else showFlash('Datos de la cuenta guardados');
  }

  async function handleSavePassword() {
    if (pwNew.length < 8) {
      showFlash('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (pwNew !== pwConfirm) {
      showFlash('Las contraseñas no coinciden');
      return;
    }
    setSavingPw(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: pwCurrent,
    });
    if (authErr) {
      setSavingPw(false);
      showFlash('La contraseña actual no es correcta');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    setSavingPw(false);
    if (error) showFlash('No se pudo actualizar la contraseña');
    else {
      showFlash('Contraseña actualizada');
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const now = Date.now();
  const displayTokens = tokens.map((t) => {
    const active = t.expires_at ? new Date(t.expires_at).getTime() > now : false;
    return { ...t, active };
  });
  const statTotal = displayTokens.length;
  const statActive = displayTokens.filter((t) => t.active).length;
  const statExpired = statTotal - statActive;

  const filtered = displayTokens.filter((t) => {
    if (filterStatus === 'activo' && !t.active) return false;
    if (filterStatus === 'expirado' && t.active) return false;
    if (search && !t.code.toUpperCase().includes(search.trim().toUpperCase())) return false;
    return true;
  });

  const { title, subtitle } = TITLES[section];

  const brandVars = {
    '--accent': client.accent_color || '#BCFF5E',
    '--accent-hover': client.accent_hover || '#d4ff8f',
  } as React.CSSProperties;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', ...brandVars }}>
      {/* ===== Sidebar ===== */}
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
          {client.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.logo_url} alt={client.name} style={{ maxHeight: 34, maxWidth: 180, display: 'block' }} />
          ) : (
            <KubiLogo width={78} height={34} accent={client.accent_color || '#BCFF5E'} />
          )}
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
            {client.logo_url ? client.brand_label : 'Tokens WiFi'}
          </div>
        </div>

        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button className={`nav-item ${section === 'crear' ? 'active' : ''}`} onClick={() => setSection('crear')}>
            <IconPlusCircle /> Crear Token
          </button>
          <button
            className={`nav-item ${section === 'consultar' ? 'active' : ''}`}
            onClick={() => setSection('consultar')}
          >
            <IconSearch /> Consultar Token
          </button>
          <button
            className={`nav-item ${section === 'detalles' ? 'active' : ''}`}
            onClick={() => {
              setSection('detalles');
              loadTokens();
            }}
          >
            <IconList /> Detalles Token
          </button>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '12px 8px' }} />

          <button className={`nav-item ${section === 'ajustes' ? 'active' : ''}`} onClick={() => setSection('ajustes')}>
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
                background: `linear-gradient(135deg, ${client.accent_color || '#BCFF5E'}, #7fd42e)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 14,
                color: '#0B0B0C',
              }}
            >
              {initials(client.name)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {client.name}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: '#6A6A72',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {profile.email}
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              style={{
                flexShrink: 0,
                background: 'none',
                border: 'none',
                color: '#6A6A72',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                transition: 'color 0.12s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#FF6B6B')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#6A6A72')}
            >
              <IconLogout />
            </button>
          </div>
        </div>
      </aside>

      {/* ===== Main ===== */}
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
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>{title}</h2>
            <div style={{ fontSize: 12.5, color: '#6A6A72', marginTop: 1 }}>{subtitle}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#8E8E96' }}>
            <IconCalendar />
            {todayLabel()}
          </div>
        </header>

        <div style={{ padding: 34, maxWidth: 1080 }}>
          {/* ===== CREAR ===== */}
          {section === 'crear' && (
            <div>
              <p style={{ margin: '0 0 24px', fontSize: 14.5, color: '#A0A0A8', maxWidth: 560, lineHeight: 1.55 }}>
                Genera un código de acceso WiFi para un huésped premium. Elige la validez y comparte el token; el
                conteo de expiración empieza en el momento de la generación.
              </p>

              <div className="micro-label" style={{ marginBottom: 12 }}>
                Duración del token
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, maxWidth: 640 }}>
                {([1, 3, 7] as const).map((d) => {
                  const sel = selectedDuration === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setSelectedDuration(d)}
                      style={{
                        position: 'relative',
                        textAlign: 'left',
                        padding: '20px 18px',
                        background: '#131316',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 15,
                        cursor: 'pointer',
                        transition: 'border-color 0.12s',
                        boxShadow: sel ? `inset 0 0 0 2px ${client.accent_color || '#BCFF5E'}` : 'none',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(188,255,94,0.4)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                    >
                      <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: -0.5, color: '#F4F4F5' }}>
                        {d}
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#8E8E96', marginLeft: 4 }}>
                          {d === 1 ? 'día' : 'días'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: '#8E8E96', marginTop: 3 }}>
                        {d === 1 ? '24 horas de acceso' : d === 3 ? '72 horas de acceso' : '1 semana de acceso'}
                      </div>
                      {sel && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 13,
                            right: 13,
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IconCheck color="#0B0B0C" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                className="btn-accent"
                style={{ marginTop: 24, padding: '14px 26px' }}
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? <span className="spinner" /> : <IconBolt color="#0B0B0C" />}
                {generating ? 'Generando…' : 'Generar Token'}
              </button>

              {genError && (
                <div
                  style={{
                    marginTop: 20,
                    maxWidth: 640,
                    background: '#17110F',
                    border: '1px solid rgba(255,107,107,0.3)',
                    borderRadius: 16,
                    padding: '18px 22px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    animation: 'kubiRise 0.3s ease',
                  }}
                >
                  <IconAlert color="#FF6B6B" />
                  <div style={{ fontSize: 13.5, color: '#F4F4F5', fontWeight: 600 }}>{genError}</div>
                </div>
              )}

              {generated && (
                <div
                  style={{
                    marginTop: 30,
                    maxWidth: 640,
                    background: 'linear-gradient(160deg, #16180F 0%, #131316 60%)',
                    border: '1px solid rgba(188,255,94,0.25)',
                    borderRadius: 18,
                    padding: 28,
                    animation: 'kubiRise 0.35s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        animation: 'kubiPulse 1.8s infinite',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                        color: 'var(--accent)',
                      }}
                    >
                      Token generado
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div
                      className="mono"
                      style={{ fontWeight: 700, fontSize: 44, letterSpacing: 8, color: '#F4F4F5' }}
                    >
                      {generated.code}
                    </div>
                    <button className="btn-ghost" onClick={handleCopy}>
                      <IconCopy />
                      {copied ? '¡Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 1,
                      marginTop: 24,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 12,
                      overflow: 'hidden',
                    }}
                  >
                    {[
                      ['Validez', durLabel(generated.duration_days)],
                      ['Generado', fmtDate(generated.assigned_at)],
                      ['Expira', fmtDate(generated.expires_at)],
                    ].map(([label, value]) => (
                      <div key={label} style={{ background: '#131316', padding: '14px 16px' }}>
                        <div
                          style={{
                            fontSize: 11,
                            letterSpacing: 0.5,
                            textTransform: 'uppercase',
                            color: '#6A6A72',
                            marginBottom: 4,
                          }}
                        >
                          {label}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: '16px 0 0', fontSize: 12.5, color: '#8E8E96', lineHeight: 1.5 }}>
                    Comparte este código con el huésped para conectarse a la red{' '}
                    <strong style={{ color: '#C7C7CF' }}>{client.network_name || 'Kubi WiFi'}</strong>. El acceso
                    caduca automáticamente al expirar.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ===== CONSULTAR ===== */}
          {section === 'consultar' && (
            <div>
              <p style={{ margin: '0 0 24px', fontSize: 14.5, color: '#A0A0A8', maxWidth: 560, lineHeight: 1.55 }}>
                Introduce un código de token para verificar si ya fue generado, su estado actual y las fechas de
                generación y expiración.
              </p>

              <div style={{ display: 'flex', gap: 12, maxWidth: 520 }}>
                <input
                  className="mono"
                  value={consultaInput}
                  onChange={(e) => setConsultaInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleConsulta()}
                  placeholder="Ej. K7F2QP"
                  style={{
                    flex: 1,
                    padding: '14px 16px',
                    fontWeight: 700,
                    fontSize: 16,
                    letterSpacing: 3,
                    textTransform: 'uppercase',
                    color: '#F4F4F5',
                    background: '#131316',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 12,
                  }}
                />
                <button
                  className="btn-accent"
                  style={{ padding: '0 26px', fontSize: 14 }}
                  onClick={handleConsulta}
                  disabled={consultando}
                >
                  {consultando ? <span className="spinner" /> : 'Consultar'}
                </button>
              </div>

              {consultaResult === undefined && (
                <div
                  style={{
                    marginTop: 40,
                    maxWidth: 520,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    padding: '40px 24px',
                    border: '1px dashed rgba(255,255,255,0.10)',
                    borderRadius: 16,
                    color: '#6A6A72',
                  }}
                >
                  <div style={{ marginBottom: 14, opacity: 0.7 }}>
                    <IconSearch size={40} strokeWidth={1.5} />
                  </div>
                  <div style={{ fontSize: 14, color: '#8E8E96' }}>Ingresa un código para ver su estado.</div>
                </div>
              )}

              {consultaResult && consultaResult.found && (
                <ConsultaCard result={consultaResult} accent={client.accent_color || '#BCFF5E'} />
              )}

              {consultaResult && !consultaResult.found && (
                <div
                  style={{
                    marginTop: 26,
                    maxWidth: 560,
                    background: '#17110F',
                    border: '1px solid rgba(255,107,107,0.3)',
                    borderRadius: 16,
                    padding: '22px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    animation: 'kubiRise 0.3s ease',
                  }}
                >
                  <IconAlert color="#FF6B6B" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#FF6B6B' }}>Token no encontrado</div>
                    <div style={{ fontSize: 13, color: '#A0A0A8', marginTop: 2 }}>
                      No existe ningún token con el código{' '}
                      <strong className="mono" style={{ color: '#F4F4F5' }}>
                        {consultaResult.code}
                      </strong>
                      .
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== DETALLES ===== */}
          {section === 'detalles' && (
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 14,
                  maxWidth: 640,
                  marginBottom: 26,
                }}
              >
                {[
                  ['Total generados', statTotal, '#F4F4F5'],
                  ['Activos', statActive, 'var(--accent)'],
                  ['Expirados', statExpired, '#8E8E96'],
                ].map(([label, value, color]) => (
                  <div
                    key={label as string}
                    style={{
                      background: '#131316',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 14,
                      padding: '18px 20px',
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#6A6A72', marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, color: color as string }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  marginBottom: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', gap: 8 }}>
                  {(
                    [
                      ['todos', 'Todos'],
                      ['activo', 'Activos'],
                      ['expirado', 'Expirados'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      className={`chip ${filterStatus === key ? 'active' : ''}`}
                      onClick={() => setFilterStatus(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{ position: 'relative', width: 220 }}>
                  <div style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
                    <IconSearch size={15} color="#6A6A72" />
                  </div>
                  <input
                    className="mono"
                    value={search}
                    onChange={(e) => setSearch(e.target.value.toUpperCase())}
                    placeholder="Buscar código…"
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 34px',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      color: '#F4F4F5',
                      background: '#131316',
                      border: '1px solid rgba(255,255,255,0.10)',
                      borderRadius: 10,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  background: '#131316',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 0.9fr 1.4fr 1.4fr 1fr',
                    gap: 12,
                    padding: '14px 22px',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: '#6A6A72',
                  }}
                >
                  <div>Token</div>
                  <div>Validez</div>
                  <div>Generado</div>
                  <div>Expira</div>
                  <div style={{ textAlign: 'right' }}>Estado</div>
                </div>
                {filtered.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 0.9fr 1.4fr 1.4fr 1fr',
                      gap: 12,
                      padding: '15px 22px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      alignItems: 'center',
                    }}
                  >
                    <div className="mono" style={{ fontWeight: 700, fontSize: 15, letterSpacing: 2, color: '#F4F4F5' }}>
                      {t.code}
                    </div>
                    <div style={{ fontSize: 13.5, color: '#C7C7CF' }}>{durLabel(t.duration_days)}</div>
                    <div style={{ fontSize: 13, color: '#8E8E96' }}>{t.assigned_at ? fmtDate(t.assigned_at) : '—'}</div>
                    <div style={{ fontSize: 13, color: '#8E8E96' }}>{t.expires_at ? fmtDate(t.expires_at) : '—'}</div>
                    <div style={{ textAlign: 'right' }}>
                      <StatusBadge active={t.active} />
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div style={{ padding: 40, textAlign: 'center', fontSize: 13.5, color: '#6A6A72' }}>
                    No hay tokens que coincidan con el filtro.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== AJUSTES ===== */}
          {section === 'ajustes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 620 }}>
              <div className="card">
                <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>Datos de la cuenta</h3>
                <p style={{ margin: '0 0 20px', fontSize: 13, color: '#8E8E96' }}>
                  Información visible en tu perfil de gerencia.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label className="field-label">Nombre</label>
                    <input className="input-sm" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Correo</label>
                    <input className="input-sm" value={profile.email} disabled style={{ opacity: 0.6 }} />
                  </div>
                </div>
                <button
                  className="btn-accent"
                  style={{ marginTop: 20, padding: '11px 22px', fontSize: 13.5, borderRadius: 10 }}
                  onClick={handleSaveAccount}
                  disabled={savingAccount}
                >
                  {savingAccount ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>

              <div className="card">
                <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>Cambiar contraseña</h3>
                <p style={{ margin: '0 0 20px', fontSize: 13, color: '#8E8E96' }}>
                  Usa una contraseña de al menos 8 caracteres.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label className="field-label">Contraseña actual</label>
                    <input
                      className="input-sm"
                      type="password"
                      placeholder="••••••••"
                      value={pwCurrent}
                      onChange={(e) => setPwCurrent(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label className="field-label">Nueva contraseña</label>
                      <input
                        className="input-sm"
                        type="password"
                        placeholder="••••••••"
                        value={pwNew}
                        onChange={(e) => setPwNew(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="field-label">Confirmar</label>
                      <input
                        className="input-sm"
                        type="password"
                        placeholder="••••••••"
                        value={pwConfirm}
                        onChange={(e) => setPwConfirm(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <button
                  className="btn-accent"
                  style={{ marginTop: 20, padding: '11px 22px', fontSize: 13.5, borderRadius: 10 }}
                  onClick={handleSavePassword}
                  disabled={savingPw}
                >
                  {savingPw ? 'Actualizando…' : 'Actualizar contraseña'}
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
                  <div style={{ fontSize: 13, color: '#8E8E96', marginTop: 2 }}>
                    Saldrás del portal de gerencia en este dispositivo.
                  </div>
                </div>
                <button className="btn-danger" onClick={handleLogout}>
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Toast */}
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
          <IconCheck size={17} color="var(--accent)" strokeWidth={2.4} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#F4F4F5' }}>{flash}</span>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  const color = active ? 'var(--accent)' : '#8E8E96';
  const bg = active ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'rgba(255,255,255,0.06)';
  return (
    <span className="badge" style={{ color, background: bg }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {active ? 'Activo' : 'Expirado'}
    </span>
  );
}

function ConsultaCard({
  result,
  accent,
}: {
  result: { code: string; duration_days: number; assigned_at: string; expires_at: string };
  accent: string;
}) {
  const now = Date.now();
  const gen = new Date(result.assigned_at).getTime();
  const exp = new Date(result.expires_at).getTime();
  const active = exp > now;
  const pct = Math.min(100, Math.max(0, ((now - gen) / (exp - gen)) * 100));
  const color = active ? accent : '#8E8E96';

  let remaining = 'Este token ya expiró';
  if (active) {
    const ms = exp - now;
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    remaining = d > 0 ? `Expira en ${d} d ${h} h` : `Expira en ${h} h`;
  }

  return (
    <div
      style={{
        marginTop: 26,
        maxWidth: 560,
        background: '#131316',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
        padding: 26,
        animation: 'kubiRise 0.3s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div className="mono" style={{ fontWeight: 700, fontSize: 34, letterSpacing: 6, color: '#F4F4F5' }}>
          {result.code}
        </div>
        <span
          className="badge"
          style={{
            padding: '7px 14px',
            fontSize: 12.5,
            gap: 7,
            color,
            background: active ? 'rgba(188,255,94,0.12)' : 'rgba(255,255,255,0.06)',
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
          {active ? 'Activo' : 'Expirado'}
        </span>
      </div>

      <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[
          ['Validez', durLabel(result.duration_days)],
          ['Generado el', fmtDate(result.assigned_at)],
          ['Expira el', fmtDate(result.expires_at)],
        ].map(([label, value], i, arr) => (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: i < arr.length - 1 ? 14 : 0,
              borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}
          >
            <span style={{ fontSize: 13, color: '#8E8E96' }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: '#6A6A72' }}>{remaining}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{Math.round(pct)}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}
