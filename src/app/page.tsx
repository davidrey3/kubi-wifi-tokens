'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { KubiLogo } from '@/components/KubiLogo';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = supabaseBrowser();
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err || !data.user) {
      setError('Usuario o contraseña incorrectos.');
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();
    router.push(profile?.role === 'superadmin' ? '/admin' : '/panel');
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'radial-gradient(120% 90% at 50% -10%, #17170D 0%, #0B0B0C 55%)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <KubiLogo width={104} height={45} />
        </div>

        <form
          onSubmit={handleLogin}
          style={{
            background: '#131316',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20,
            padding: '32px 30px 30px',
          }}
        >
          <h1 style={{ margin: '0 0 4px', fontSize: 21, fontWeight: 800, letterSpacing: -0.3 }}>
            Gestión de Tokens WiFi
          </h1>
          <p style={{ margin: '0 0 26px', fontSize: 13.5, color: '#8E8E96' }}>
            Portal de gerencia · acceso interno
          </p>

          <label className="field-label">Usuario</label>
          <input
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginBottom: 18 }}
            required
          />

          <label className="field-label">Contraseña</label>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginBottom: error ? 12 : 22 }}
            required
          />

          {error && (
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#FF6B6B', fontWeight: 600 }}>{error}</p>
          )}

          <button type="submit" className="btn-accent" style={{ width: '100%' }} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Iniciar sesión'}
          </button>

          <p style={{ margin: '18px 0 0', textAlign: 'center', fontSize: 12, color: '#6A6A72' }}>
            ¿Olvidaste tu contraseña? <span style={{ color: 'var(--accent)' }}>Contacta a Kubi</span>
          </p>
        </form>
        <p style={{ margin: '20px 0 0', textAlign: 'center', fontSize: 11.5, color: '#56565C' }}>
          © 2026 Kubi WiFi · Todos los derechos reservados
        </p>
      </div>
    </div>
  );
}
