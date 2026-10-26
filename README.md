# CareerBridge

## Connected Supabase project

This workspace is connected to the active Supabase project `CareerBridge` (`bsldieqijtlolepkkcpm`, region `ap-south-1`). The schema and row-level security are installed, with 21 active sample listings across fresher, experienced, and referral categories. The `admin-users`, `notify`, `payments`, and `whatsapp-bot` (inactive no-reply handler) Edge Functions are deployed. Local URL and publishable key are stored in the ignored `.env.local`; never commit that file.

A responsive job portal built with React and JavaScript (JSX), an HTML page shell, plain CSS, and Vite for early-career and experienced candidates, plus employee referrals. It includes candidate, coordinator, and administrator workspaces; search and filters; profiles; saved jobs; applications; referral requests; moderation; email verification; messaging adapters; and Razorpay checkout.

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

The `notify` Edge Function is deployed. Applications and referral requests send a confirmation email to the signed-in user's verified email, plus SMS and WhatsApp messages when the candidate has separately opted in to those channels. Messages are sent only after the database write succeeds. For local development, the deployed messaging functions allow http://localhost:5173, http://localhost:5174, http://127.0.0.1:5173, and http://127.0.0.1:5174; set APP_URL to the exact production origin. Configure Edge Function secrets: `APP_URL`, `RESEND_API_KEY`, `RESEND_FROM`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM`, and `TWILIO_VERIFY_SERVICE_SID`. For a personal demo without a verified domain, set `RESEND_FROM=onboarding@resend.dev` and use the same email address for the CareerBridge account as the Resend account owner; Resend restricts its shared test sender to that owner address. To send to other recipients, verify a sender domain with Resend and set `RESEND_FROM` to an address on that domain. Candidates save an E.164 phone number (for example `+919876543210`), opt in to WhatsApp job/application updates, and request a WhatsApp OTP from Profile. The `whatsapp-otp` function uses Twilio Verify with a WhatsApp-enabled Verify Service; the verified flag is server-managed and changing the phone number clears verification and WhatsApp consent. Only verified, opted-in candidates are eligible for WhatsApp campaigns. Admins can create and launch WhatsApp job-opportunity campaigns from Messaging; delivery is batched and asks for confirmation. The `notify` function sends only to the authenticated user's own profile contact and caps delivery at 15 messages per hour. Set TWILIO_WHATSAPP_CONTENT_SID to an approved Twilio WhatsApp template containing the variable {{1}}; the app inserts the notification text there. Business-initiated messages outside the 24-hour service window require an approved template. Twilio/Meta may require sender verification, opt-in, and production account access.

For a Twilio SMS trial, set `TWILIO_SMS_TRIAL_MODE=true`, `TWILIO_SMS_TRIAL_BODY=sms_event_notifications` (or another supported Twilio trial template name), and `TWILIO_SMS_FROM` to the sender shown in the trial SMS API request. The Profile → Delivery check sends that preset generic message to the signed-in user's own opted-in number; the custom message is ignored in trial mode. Trial SMS campaigns are disabled because Twilio only permits delivery to individually verified recipient numbers. After upgrading, turn off trial mode to send custom message bodies. Twilio trial SMS is limited to verified recipients and provider-defined message templates; check Twilio Console for the sender assigned to the specific recipient.

To enable the Profile delivery checks on a deployed project, apply all migrations (including `20261025054100_add_sms_opt_in.sql`, `20261025120000_whatsapp_phone_verification.sql`, and `20261026100000_reset_message_consent_on_phone_change.sql`), then deploy the latest `notify`, `whatsapp-otp`, `messaging-admin`, `messaging-webhooks`, and `payments` Edge Functions. Add these secrets under Supabase → Edge Functions → Secrets: `APP_URL` (exact website origin), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM` (format `whatsapp:+...`), `TWILIO_WHATSAPP_CONTENT_SID` (approved Content template with a `{{1}}` body variable), and `TWILIO_VERIFY_SERVICE_SID` (WhatsApp enabled). Never put provider credentials in frontend `VITE_` variables. In the app, save the international phone and the separate SMS/WhatsApp opt-ins. For WhatsApp, complete the one-time OTP verification above Delivery check, then press WhatsApp. Twilio trial SMS only reaches verified recipient numbers. A `200`/success response means Twilio accepted the send request; use Twilio Messaging Logs and the message status callback to confirm carrier delivery and diagnose failures.

For a Twilio WhatsApp trial sender, set `TWILIO_WHATSAPP_SANDBOX_MODE=true`, use the `From` sender and preset `ContentSid` shown in Twilio's Try out WhatsApp API request, and have the receiving phone join/verify that Twilio trial flow. This trial flag skips the Verify Service check only for the signed-in user's own message delivery check and uses the provider's preset content without app variables. It does not enable bulk campaigns or production WhatsApp sending. Turn the flag off after connecting an approved production sender/template.

### Incoming WhatsApp messages

CareerBridge uses WhatsApp and SMS for opted-in, outbound application and referral confirmations. Incoming WhatsApp messages do not receive automated AI replies; the Gemini assistant described below is available on the website chat widget.

### Candidate AI assistant

CareerBridge includes a signed-in candidate chat assistant powered by the Gemini API. It can answer general questions about using the website and receives up to 20 active, public job listings for job-specific answers. It does not read candidate profiles, applications, referrals, payments, or private messages; it sends the candidate's chat text to Gemini, so candidates should not type passwords, OTPs, or sensitive personal details. Chat input is limited to 1,000 characters per message, to 12 requests per signed-in user per minute, and to the eight most recent messages. To enable replies, apply `20261026140000_ai_chat_rate_limit.sql`, set the `GEMINI_API_KEY` secret in Supabase Edge Function Secrets, optionally set `GEMINI_MODEL` (defaults to `gemini-3.8-flash`), and deploy `career-chat`. The API key must stay server-side. Google’s Gemini free-tier terms state that submitted content may be used to improve its products, so review Google's current [Gemini API pricing and data terms](https://ai.google.dev/gemini-api/docs/pricing) and [API key safety guidance](https://ai.google.dev/gemini-api/docs/api-key) before enabling the integration.

### Razorpay demo payments

Candidates see one CareerBridge Plus one-time checkout. The administrator can change its price, description, benefits, or availability from the admin dashboard. Checkout is labeled **DEMO — TEST PAYMENTS ONLY** and refuses to run unless `RAZORPAY_MODE=test` and the server key ID starts with `rzp_test_`. The server creates each order and verifies the Checkout signature plus Razorpay's order, amount, currency, and captured status. A captured payment becomes `awaiting_admin`; it is not marked paid yet. An administrator can confirm it in Admin → Recent payment events. The server rechecks the captured payment with Razorpay, records the administrator and timestamp, then sends one confirmation email through Resend. Admins can retry the email if Resend fails. Duplicate payment callbacks and confirmations do not send duplicate emails. The Razorpay secret stays in Supabase Edge Function secrets.

**No payment credentials are included.** Add these values as Supabase Edge Function secrets for a deployed function, or in ignored `supabase/functions/.env` for local function serving:

- `RAZORPAY_MODE=test`
- `RAZORPAY_KEY_ID` (must be your Razorpay **Test Mode** key beginning `rzp_test_`)
- `RAZORPAY_KEY_SECRET` (test-mode secret)
- `RAZORPAY_WEBHOOK_SECRET` (the secret configured for the test-mode webhook)
- `APP_URL` (the allowed web-app origin)

The one-time amount is read from the admin-managed `careerbridge-plus` plan; the client cannot choose or override it. Apply `20261026130000_admin_payment_confirmation.sql` so captured orders can wait for administrator review. Set `RESEND_API_KEY` and `RESEND_FROM` as Edge Function secrets for the post-approval customer email; the customer's email address must be verified with Supabase Auth.

For the hosted Supabase project, apply pending migrations with `supabase db push`, then deploy the updated function with `supabase functions deploy payments`. The existing website must use that same Supabase project. Razorpay checkout stays unavailable until test credentials are set in that project's Edge Function Secrets.

For a local end-to-end test, install the Supabase CLI and Docker Desktop, then run these in the project folder:

```powershell
npx supabase start
npx supabase db reset
npx supabase functions serve payments --env-file supabase/functions/.env
```

Create the ignored `supabase/functions/.env` file with the test secrets above. In `supabase status`, copy the local API URL and publishable/anon key into the ignored root `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Start Vite in a second terminal with `npm run dev`. Sign in with a candidate account, open Profile → CareerBridge Plus demo checkout, and use only Razorpay's test payment values from [Razorpay Test Mode documentation](https://razorpay.com/docs/server-integration/python/test-app/). After a test payment is captured, sign in as an administrator and confirm it under Admin → Recent payment events; only then does the server mark it paid and send the confirmation email. A failed email is visible to the administrator and can be retried. Never enter real card, bank, UPI, or other payment details. For local Edge Function secret handling, see [Supabase Environment Variables documentation](https://supabase.com/docs/guides/functions/secrets).

The hosted payment function must be redeployed after source changes. Keep credentials in Test mode; this demo does not enable Live payments.
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
| `TWILIO_VERIFY_SERVICE_SID` | Edge Functions | Twilio Verify Service SID with WhatsApp channel enabled, for phone OTP checks |
| `GEMINI_API_KEY` | Edge Functions | Server-side key for the candidate chat assistant |
| `GEMINI_MODEL` | Edge Functions | Optional Gemini model name (default `gemini-3.8-flash`) |
| `RAZORPAY_MODE`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Edge Functions | Require Razorpay test mode and create test orders |
| `RAZORPAY_WEBHOOK_SECRET` | Edge Functions | Verify Razorpay webhook HMAC |


## Architecture and security

- React pages and reusable UI live in `src/App.jsx`; client data and Supabase setup live in `src/lib/*.js`; the page shell is `index.html`; styling is responsive CSS in `src/style.css`. Supabase Edge Functions remain TypeScript server code.
- `src/lib/data.js` selects Supabase persistence when credentials are set and browser-local demo storage otherwise.
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
- [ ] Add Razorpay test credentials and configure a test-mode webhook. Live payments and the Plus entitlement are out of scope for this demo.
- [ ] Set a production `APP_URL`, production auth redirect allow-list, privacy/terms pages, and deployment domain.

Real customer messaging still needs valid Resend/Twilio credentials. Razorpay Live mode is deliberately disabled in this demo. Resend's test sender may only deliver to the account owner's verified address; external recipients require a verified sender domain.

### Razorpay webhook (optional)

The one-time checkout verifies the payment directly with Razorpay and does not require subscription events. A Test Mode webhook can additionally reconcile captured and failed orders. If configured, use `https://<your-supabase-project>.supabase.co/functions/v1/payments`, select ordinary order/payment events such as `order.paid`, `payment.captured`, `payment.failed`, and refund events, then store its signing secret in Supabase Edge Function Secrets as `RAZORPAY_WEBHOOK_SECRET`. Do not select subscription events.
