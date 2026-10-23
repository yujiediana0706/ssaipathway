# Pathway

AI career-transition companion: diagnosis, role simulation, and a human coaching marketplace. Built with Next.js (App Router), Firebase, and Stripe.

## Stack

- Next.js 16 + React 19 + Tailwind CSS 4
- next-intl (`/zh` and `/en` routes, `localePrefix: "always"`)
- Firebase Auth / Firestore / Storage (Admin SDK on the server)
- Stripe Checkout + webhooks (server-side SDK)
- GLM for AI responses

## Local development

```bash
cp .env.local.example .env.local   # fill in the values
npm install
npm run dev                        # http://localhost:3000
```

Every page lives under `src/app/[locale]/...`; the middleware in `src/proxy.ts` redirects locale-less URLs.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web config (public, inlined at build time) |
| `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Firebase Admin credentials for the server |
| `GLM_API_KEY`, `GLM_API_ENDPOINT`, `GLM_MODEL` | AI provider |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Payments (missing keys disable checkout gracefully) |
| `STRIPE_CURRENCY`, `PLATFORM_FEE_RATE` | Currency and platform commission |
| `NEXT_PUBLIC_APP_URL` | Public base URL used for Stripe redirects |
| `ADMIN_EMAILS` | Comma-separated emails allowed to review coach applications |
| `CLEANUP_TOKEN` | Header token for the stale-order cleanup endpoint |

## Data model notes

- Orders move through `pending (payment) → paid → confirmed → completed → released`, with `refunded` as a terminal state.
- A slot is locked for 15 minutes while checkout is open; `checkout.session.expired`, the Stripe webhook, and the cleanup endpoint all release it.
- Marketplace collections are written only by the server; Firestore rules grant clients read-only access.

## Deployment

Deployed to Cloud Run in project `pathway-app-512202`:

```bash
gcloud run deploy pathway-frontend --source . --region us-central1 \
  --project pathway-app-512202 --allow-unauthenticated --port 3000 \
  --memory 1Gi --cpu 1
```

Configure the Stripe webhook to point at `https://<service-url>/api/stripe/webhook` and subscribe to
`checkout.session.completed`, `checkout.session.expired`, and `charge.refunded`.

## Operations

- Firestore daily export: Cloud Scheduler jobs `firestore-daily-export` / `firestore-export-d1..d6` export to
  `gs://pathway-backups-865068130811/firestore/d<weekday>` at 03:30 Asia/Shanghai.
- Rate limits are stored in the Firestore `rate_limits` collection (safe across Cloud Run instances).
- Legal pages: `/{locale}/terms`, `/{locale}/privacy`, `/{locale}/refund`.
