import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendLowStockEmail } from '@/lib/email';
import { isTokenDuration } from '@/lib/format';

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const duration = Number(body?.duration);
  const isBulkRequest = body?.quantity !== undefined;
  const quantity = isBulkRequest ? Number(body.quantity) : 1;
  if (!isTokenDuration(duration)) {
    return NextResponse.json({ error: 'duracion_invalida' }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
    return NextResponse.json({ error: 'cantidad_invalida' }, { status: 400 });
  }

  const { data, error } =
    isBulkRequest
      ? await supabase.rpc('assign_tokens', { p_duration: duration, p_quantity: quantity })
      : await supabase.rpc('assign_token', { p_duration: duration });

  if (error) {
    if (error.message.includes('tokens_insuficientes')) {
      const available = Number(error.message.match(/tokens_insuficientes:(\d+)/)?.[1] ?? 0);
      return NextResponse.json({ error: 'tokens_insuficientes', available }, { status: 409 });
    }
    const code = error.message.includes('sin_tokens_disponibles')
      ? 'sin_tokens_disponibles'
      : error.message.includes('duracion_no_permitida')
        ? 'duracion_no_permitida'
      : error.message.includes('sin_cliente')
        ? 'sin_cliente'
        : 'error_interno';
    return NextResponse.json({ error: code }, { status: code === 'error_interno' ? 500 : 409 });
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

  if (isBulkRequest) {
    return NextResponse.json({
      tokens: data.tokens,
      quantity: data.tokens.length,
      remaining: data.remaining,
    });
  }

  return NextResponse.json({
    code: data.code,
    duration_days: data.duration_days,
    assigned_at: data.assigned_at,
    expires_at: data.expires_at,
    remaining: data.remaining,
  });
}
