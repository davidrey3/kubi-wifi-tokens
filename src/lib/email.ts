import { Resend } from 'resend';

export async function sendLowStockEmail(clientName: string, duration: number, remaining: number) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  if (!apiKey || !to) return; // email opcional: sin config, solo alerta en dashboard

  const resend = new Resend(apiKey);
  const durText = duration === 1 ? '1 día' : `${duration} días`;

  await resend.emails.send({
    from: process.env.ALERT_EMAIL_FROM || 'onboarding@resend.dev',
    to,
    subject: `⚠️ Kubi Tokens — A ${clientName} le quedan ${remaining} tokens de ${durText}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px">
        <h2 style="margin:0 0 8px">Tokens por agotarse</h2>
        <p style="margin:0 0 16px;color:#444">
          El cliente <strong>${clientName}</strong> tiene solo
          <strong>${remaining}</strong> tokens disponibles de <strong>${durText}</strong>
          (umbral: 50).
        </p>
        <p style="margin:0;color:#444">
          Genera más tokens en Linkyfi y cárgalos desde el dashboard de administración.
        </p>
      </div>
    `,
  });
}
