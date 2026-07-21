import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendLowStockEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const duration = Number(body?.duration);
  if (![1, 3, 7].includes(duration)) {
    return NextResponse.json({ error: 'duracion_invalida' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('assign_token', { p_duration: duration });

  if (error) {
    const msg = error.message.includes('sin_tokens_disponibles')
      ? 'sin_tokens_disponibles'
      : error.message.includes('sin_cliente')
        ? 'sin_cliente'
        : 'error_interno';
    return NextResponse.json({ error: msg }, { status: msg === 'error_interno' ? 500 : 409 });
  }

  // Alerta por email si el pool bajó del umbral (no bloquea la respuesta)
  if (data?.low_stock) {
    try {
      const admin = supabaseAdmin();
      const { data: profile } = await admin
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single();
      if (profile?.client_id) {
        const { data: client } = await admin
          .from('clients')
          .select('name')
          .eq('id', profile.client_id)
          .single();
        // Enviar solo si acaba de crearse una alerta reciente (el RPC ya dedup a 12h)
        await sendLowStockEmail(client?.name ?? 'Cliente', duration, data.remaining);
      }
    } catch (e) {
      console.error('email alert failed', e);
    }
  }

  return NextResponse.json({
    code: data.code,
    duration_days: data.duration_days,
    assigned_at: data.assigned_at,
    expires_at: data.expires_at,
    remaining: data.remaining,
  });
}
