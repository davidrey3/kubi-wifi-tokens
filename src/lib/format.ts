const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function fmtDate(iso: string | Date): string {
  const dt = typeof iso === 'string' ? new Date(iso) : iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}, ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

export function todayLabel(): string {
  const d = new Date();
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function durLabel(days: number): string {
  if (days === 365) return '1 año';
  return days === 1 ? '1 día' : `${days} días`;
}

export const TOKEN_DURATIONS = [1, 3, 7, 365] as const;
export type TokenDuration = (typeof TOKEN_DURATIONS)[number];

export function isTokenDuration(value: number): value is TokenDuration {
  return TOKEN_DURATIONS.includes(value as TokenDuration);
}

export function clientTokenDurations(client: Pick<Client, 'allowed_token_durations'>): TokenDuration[] {
  const configured = client.allowed_token_durations ?? TOKEN_DURATIONS;
  return TOKEN_DURATIONS.filter((duration) => configured.includes(duration));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export type TokenRow = {
  id: string;
  code: string;
  duration_days: number;
  status: string;
  assigned_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type Client = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  card_template_url: string | null;
  accent_color: string;
  accent_hover: string;
  brand_label: string;
  network_name: string;
  allowed_token_durations: number[];
};

export type Profile = {
  id: string;
  client_id: string | null;
  role: 'superadmin' | 'manager';
  full_name: string;
  email: string;
};
