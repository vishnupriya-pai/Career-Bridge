# CareerBridge

## Connected Supabase project

This workspace is connected to the active Supabase project `CareerBridge` (`bsldieqijtlolepkkcpm`, region `ap-south-1`). The schema and row-level security are installed, with 21 active sample listings across fresher, experienced, and referral categories. The `admin-users`, `notify`, `payments`, and `whatsapp-bot` (inactive no-reply handler) Edge Functions are deployed. Local URL and publishable key are stored in the ignored `.env.local`; never commit that file.

A responsive React + TypeScript + Vite job portal for early-career and experienced candidates, plus employee referrals. It includes candidate, coordinator, and administrator workspaces; search and filters; profiles; saved jobs; applications; referral requests; moderation; email verification; messaging adapters; and Razorpay checkout.

## Run locally

1. Install Node.js 20 or newer.
2. This workspace already has `.env.local` configured for CareerBridge. For a fresh clone, copy `.env.example` to `.env.local` and fill in the project URL and publishable key.
3. Run `npm install` and `npm run dev`.
4. Open the local URL printed by Vite. With no Supabase credentials, the app opens in **local demo mode**. Data is stored in this browser only and is not shared across devices.
5. Demo accounts (password for each: `Career2026!`):
   - Candidate: `candidate@careerbridge.demo`
   - Coordinator: `coordinator@careerbridge.demo`
   - Admin: `admin@careerbridge.demo`

For another clone, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. Use the project's publishable key (or legacy anon key); **never place a service-role/secret key in a `VITE_` variable**. The migration `supabase/migrations/20261024000100_initial_schema.sql` creates the schema and seeds six non-sensitive sample listings.

## Staff accounts and permissions

Public sign-up creates candidate accounts only. Staff accounts must be provisioned by a trusted project owner. In Supabase Auth, set the user's **app metadata** role to `coordinator` or `admin` (never user metadata), and set the matching `profiles.role` value with the SQL Editor. Example for a known account UUID:

```sql
update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb where id = 'USER_UUID';
update public.profiles set role = 'admin' where id = 'USER_UUID';
```

The user must sign out and sign in again to refresh claims. Authorization is enforced by Row Level Security and server-side checks, not by hiding UI alone. Public profile edits cannot change a role. Coordinators can publish listings and manage requests for their own referral listings; admins can review listings and see referral requests.

## Real integrations

### Email verification

Supabase Auth sends verification emails during sign-up. The sign-up flow requests verification through Supabase Auth and redirects to the current app origin. The sign-in form also includes Forgot password: Supabase Auth emails a recovery link to the current app origin, the app opens a new-password form on the PASSWORD_RECOVERY event, and saves the new password with Supabase Auth. Add each demo and production app origin to Authentication → URL Configuration → Redirect URLs so recovery links can return to the app. In this hosted project, set Supabase Dashboard → Authentication → URL Configuration: Site URL `http://localhost:5173` and Redirect URLs `http://localhost:5173/**` (replace with your deployed HTTPS domain when available). Configure custom SMTP for dependable production delivery; the built-in sender is rate-limited. The email test action uses the `notify` Edge Function and Resend after the user's email is verified.

### SMS and WhatsApp

The `notify` Edge Function is deployed. Applications and referral requests send a confirmation email to the signed-in user's verified email, plus SMS and WhatsApp messages when the candidate has separately opted in to those channels. Messages are sent only after the database write succeeds. For local development, the deployed notify function allows http://localhost:5173 and http://localhost:5174; set APP_URL to the exact production origin. Configure Edge Function secrets: `APP_URL`, `RESEND_API_KEY`, `RESEND_FROM`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, and `TWILIO_WHATSAPP_FROM`. For a personal demo without a verified domain, set `RESEND_FROM=onboarding@resend.dev` and use the same email address for the CareerBridge account as the Resend account owner; Resend restricts its shared test sender to that owner address. To send to other recipients, verify a sender domain with Resend and set `RESEND_FROM` to an address on that domain. Add a valid international-format phone number and save the separate optional SMS and WhatsApp consent choices in the profile before using those channels. The function sends only to the authenticated user's own profile contact and caps delivery at 15 messages per hour. Set TWILIO_WHATSAPP_CONTENT_SID to an approved Twilio WhatsApp template containing the variable {{1}}; the app inserts the notification text there. Business-initiated messages outside the 24-hour service window require an approved template. Twilio/Meta may require sender verification, opt-in, and production account access.

### Incoming WhatsApp messages

The AI chatbot is disabled. CareerBridge uses WhatsApp and SMS for opted-in, outbound application and referral confirmations; incoming customer messages do not receive automated AI replies.

### Razorpay payments

The `payments` Edge Function is deployed. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `PLAN_PRICE_PAISE` (default `49900`), and `APP_URL` as Edge Function secrets. Configure a Razorpay webhook to `https://<project-ref>.supabase.co/functions/v1/payments` with event types `payment.captured`, `payment.failed`, and `order.paid`. Add the same webhook secret in Razorpay and Supabase. The browser requests an order from the server; a signed webhook is the source of truth for paid status. Do not grant clients direct write access to `payment_orders`. Use Razorpay test keys before switching to live credentials. The Plus offer is currently a one-time ₹499 checkout; connect confirmed payments to the product entitlement or receipt workflow you intend to offer before charging real users.

For a future code update, deploy functions with the Supabase CLI after linking the project, for example `supabase functions deploy notify`, `supabase functions deploy payments`, and `supabase functions deploy admin-users`. Set secrets with `supabase secrets set NAME=value`; do not commit them. The functions validate authenticated users, keep provider secrets server-side, return sanitized provider errors, and apply a per-user request limit. The `admin-users` function checks the caller’s trusted administrator claim before changing a user role. Configure function CORS to the deployed app's exact origin using `APP_URL`.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser build | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser build | Supabase publishable/anon key protected by RLS |
| `APP_URL` | Edge Functions | Allowed web-app origin |
| `RESEND_API_KEY`, `RESEND_FROM` | Edge Functions | Verified email delivery |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Edge Functions | SMS and WhatsApp delivery |
| `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM` | Edge Functions | Provider-approved sender IDs |
| `TWILIO_WHATSAPP_CONTENT_SID` | Edge Functions | Approved WhatsApp template Content SID (HX...) with variable {{1}} |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Edge Functions | Create checkout orders |
| `RAZORPAY_WEBHOOK_SECRET` | Edge Functions | Verify Razorpay webhook HMAC |
| `PLAN_PRICE_PAISE` | Edge Functions | Checkout amount in paise (default 49900) |

## Architecture and security

- React pages and reusable UI live in `src/App.tsx`; styling is plain responsive CSS in `src/style.css`.
- `src/lib/data.ts` selects Supabase persistence when credentials are set and browser-local demo storage otherwise.
- `supabase/migrations` defines Postgres constraints, indexes, private role-check helpers, RLS policies, explicit Data API grants, and seed listings.
- Supabase email/password authentication verifies email. Authorization roles use trusted `app_metadata` claims. Never trust user-editable `user_metadata` for access control.
- Referral requests and applications are scoped to the owner and assigned coordinator. Profile role edits are not granted to clients. Payment status changes happen only from the signed provider webhook.
- External credentials belong in Supabase Edge Function secrets or the relevant provider dashboard, never in client source or committed files.

## Verify and build

```bash
npm run test
npm run lint
npm run build
```

## Deployment

Build with `npm run build` and deploy `dist/` to a static host such as Vercel, Netlify, or Cloudflare Pages. Set the two `VITE_` variables in that host's build environment and add a history fallback to `index.html` for client-side routes. In Supabase, apply the migration, configure Auth URLs and SMTP, provision staff roles, deploy the Edge Functions, set provider secrets, and register the Razorpay webhook endpoint. Confirm provider test-mode events arrive before enabling live accounts.

## Credential-dependent checklist

- [ ] Add Supabase project URL and publishable key, apply the migration, and provision trusted staff accounts.
- [ ] Configure production SMTP and test email verification/redirects.
- [ ] Add Resend and Twilio credentials, SMS-capable sender, WhatsApp sender/template, and candidate channel opt-ins.
- [ ] Add Razorpay test credentials, webhook secret and URL; decide how confirmed payments grant the advertised Plus entitlement.
- [ ] Set a production `APP_URL`, production auth redirect allow-list, privacy/terms pages, and deployment domain.

Provider delivery and live checkout still require valid Resend/Twilio/Razorpay credentials. Resend's test sender may only deliver to the account owner's verified address; external recipients require a verified sender domain.
