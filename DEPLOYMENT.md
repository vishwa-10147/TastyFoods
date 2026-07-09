# Production Deployment Guide

This guide is for the current production app: direct ordering, management dashboard, CSV menu import, PostgreSQL storage, and Razorpay payments.

## 1) Prerequisites
- GitHub repository connected to Render
- Render Web Service
- PostgreSQL database, either Render Postgres or another managed Postgres provider
- Razorpay account with live keys

## 2) Required Environment Variables
Set these in Render service settings:

- `NODE_ENV=production`
- `PORT=10000` (or Render default)
- `DATABASE_URL=<full_postgres_connection_url>`
- `RAZORPAY_KEY_ID=<your_live_key_id>`
- `RAZORPAY_KEY_SECRET=<your_live_key_secret>`
- `RAZORPAY_WEBHOOK_SECRET=<your_webhook_secret>`
- `MANAGEMENT_AUTH_SECRET=<long_random_secret>`

Postgres SSL:

- Leave `PGSSL` empty for a Render Internal Database URL when the web service and database are in the same Render account and region.
- Set `PGSSL=true` for Supabase, Neon, or Render External Database URLs when TLS is required.

Recommended operational settings:

- `RATE_LIMIT_WINDOW_MS=60000`
- `RATE_LIMIT_MAX=240`
- `MANAGEMENT_SETUP_KEY=<admin_setup_key>`

Optional restaurant routing settings:

- `PUBLIC_DEFAULT_RESTAURANT_CODE=gandikotadosa`
- `RESTAURANT_DOMAIN_MAP=gandikotadosa.in:gandikotadosa,www.gandikotadosa.in:gandikotadosa`

Use `PUBLIC_DEFAULT_RESTAURANT_CODE` when one web service/domain should open one restaurant directly. Use `RESTAURANT_DOMAIN_MAP` when multiple custom domains share the same web service and each domain should open a different restaurant.

### 2.1) Render Postgres URL

In Render, copy the full connection string from the database page:

- Use the Internal Database URL only when the web service and database are in the same Render account and region.
- Use the External Database URL if the database is in a different account/region or if the internal host cannot resolve.
- Do not set `DATABASE_URL` to only the host name. It must look like:
  - `postgresql://user:password@host:5432/database`

If deploy logs show `getaddrinfo ENOTFOUND dpg-...`, the web service cannot resolve the database host. Recheck the database status, region, account, and `DATABASE_URL`.

## 2.2) Management Login Bootstrap
Management now requires login using restaurant name/code + password.

Create first account (first bootstrap does not require setup key):

- `POST /api/management/register`
- Body:
   - `restaurant`: `gandikota`
   - `restaurantName`: `Gandikota`
   - `password`: `yourStrongPassword`

Create/update additional restaurant passwords (requires setup key):

- `POST /api/management/register`
- Body:
   - `setupKey`: must match `MANAGEMENT_SETUP_KEY`
   - `restaurant`: `branch_b`
   - `restaurantName`: `Branch B`
   - `password`: `anotherStrongPassword`

Management login endpoint:

- `POST /api/management/login`
- Body:
   - `restaurant`
   - `password`

Password storage:

- Passwords are stored in the PostgreSQL table `restaurant_auth`.
- Stored as salted PBKDF2 hashes (`password_hash`, `password_salt`), not plain text.

## 3) Razorpay Webhook
In Razorpay dashboard:

1. Add webhook URL:
   - `https://<your-service>.onrender.com/api/payments/razorpay/webhook`
2. Enable event:
   - `payment.captured`
3. Use the same secret as `RAZORPAY_WEBHOOK_SECRET`

## 4) Deploy on Render
1. Push changes to your deployment branch.
2. Wait for Render deploy to complete.
3. Validate endpoints:
   - `GET /api/health`
   - `GET /api/state`

## 5) Post-Deploy Validation Checklist
- Management page opens: `/management.html`
- Client page opens: `/client.html`
- CSV import works from Management -> Menu availability
- New order flow works end-to-end
- Razorpay checkout and webhook verification both work

## 6) Data and Backup Notes
- Primary DB: PostgreSQL from `DATABASE_URL`
- The server creates/migrates required tables during startup.
- Use your Postgres provider's backups/snapshots for production recovery.

## 7) Operational Notes
- Render free tiers may sleep when idle.
- Keep the web service and Render Postgres database in the same region if you use the Internal Database URL.
- If using an external provider, confirm it allows Render outbound connections and requires the correct SSL setting.

## 8) Supabase Setup

1. Create a Supabase project.
2. In Supabase dashboard, open: `Settings -> Database -> Connection string -> URI`.
3. Copy URI and set as `DATABASE_URL`.
4. Set `PGSSL=true`.

PowerShell example:

```powershell
$env:DATABASE_URL='<supabase_uri>'
$env:PGSSL='true'
npm start
```
