# Kubi Tokens WiFi

Portal multi-cliente para gestión de tokens de acceso WiFi (Next.js + Supabase + Vercel).

- **Portal de gerencia** (`/panel`): Crear Token, Consultar Token, Detalles Token, Ajustes — con la marca de cada cliente.
- **Dashboard superadmin** (`/admin`): clientes, carga de tokens de Linkyfi, usuarios, branding por cliente, alertas (umbral global: 50).
- Los tokens NO se generan en la app: se cargan pre-generados desde Linkyfi y la app **asigna** uno disponible del pool (asignación atómica, sin duplicados). Las fechas de validez/expiración se calculan al momento de asignar.

## Puesta en marcha

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor** → pega y ejecuta todo el contenido de `supabase/schema.sql`.
3. **Storage** → crea un bucket llamado `logos`, marcado como **public**.
4. **Authentication → Users → Add user**: crea tu usuario superadmin (email + contraseña, marca "Auto Confirm").
5. Copia el UUID de ese usuario y ejecuta en SQL Editor:

   ```sql
   insert into public.profiles (id, role, full_name, email)
   values ('UUID-DEL-USUARIO', 'superadmin', 'David', 'poquirey@gmail.com');
   ```

### 2. Variables de entorno

Copia `.env.example` a `.env.local` y completa:

| Variable | Dónde encontrarla |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (secreta, solo servidor) |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys (opcional; sin ella solo hay alertas en dashboard) |
| `ALERT_EMAIL_TO` | Correo donde recibirás las alertas |
| `ALERT_EMAIL_FROM` | Remitente verificado en Resend |

### 3. Local

```bash
npm install
npm run dev
```

Abre http://localhost:3000 e inicia sesión con tu superadmin.

### 4. Vercel

1. Sube esta carpeta a un repositorio de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New Project** → importa el repo.
3. Agrega las variables de entorno de arriba (Settings → Environment Variables).
4. Deploy. Luego conecta el dominio `tokens.kubiwifi.com` en Settings → Domains (agrega el CNAME que Vercel te indique en tu DNS).

## Flujo de trabajo

1. **Superadmin** crea un cliente (nombre, color, logo, etiqueta "Amber Cove x Kubi", nombre de red).
2. Genera tokens en **Linkyfi** (1/3/7 días) y los carga en el detalle del cliente (pegar códigos o subir CSV — se toma únicamente la columna B, “Token code”; duplicados se omiten).
3. Crea usuarios gerentes para ese cliente (email + contraseña inicial).
4. El gerente entra en el mismo URL, ve su portal con su marca y genera/consulta tokens.
5. Cuando quedan **menos de 50** tokens de una duración: alerta en el dashboard + email (máx. 1 cada 12 h por cliente/duración).

## Estructura

```
supabase/schema.sql        Esquema completo (tablas, RLS, RPCs, vista de stats)
src/app/page.tsx           Login
src/app/panel/             Portal de gerencia (diseño del handoff)
src/app/admin/             Dashboard superadmin
src/app/api/               Route handlers (asignación, carga, clientes, usuarios, logo)
src/lib/                   Clientes Supabase, formato, email
```

## Notas de seguridad

- RLS activo en todas las tablas: un gerente solo ve los tokens **asignados** de **su** cliente; el pool disponible solo se consume vía RPC.
- La asignación usa `FOR UPDATE SKIP LOCKED`: dos gerentes nunca reciben el mismo token.
- El service role key solo se usa en route handlers del servidor.
