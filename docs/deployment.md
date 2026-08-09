# Production deployment

Production domain: `https://akashsimhadri.com`

The frontend (`apps/portfolio`) and API (`apps/api`) are independently deployable services. They can be hosted together (same origin) or separately (two origins), on any standard static-hosting and Node-hosting provider. No specific provider is assumed by the code.

## Required environment — API (`apps/api`)

- `DATABASE_URL` — PostgreSQL connection string used by contact persistence and `/api/readyz`.
- `FRONTEND_ORIGIN=https://akashsimhadri.com` — production CORS origin.
- `PORT` — supplied by the hosting provider; defaults to `8080` if unset.
- `TRUST_PROXY_HOPS` — number of reverse-proxy hops in front of the API in production; set to match the actual deployed topology.

Use `apps/api/.env.example` as the complete environment reference. Never commit real credentials.

## Required environment — frontend (`apps/portfolio`)

- `VITE_API_BASE_URL` — optional. Leave unset for a same-origin deployment (requests to the API stay relative, e.g. `/api/portfolio/stats`). Set to the API's origin (e.g. `https://api.akashsimhadri.com`) when the frontend and API are hosted separately.

Use `apps/portfolio/.env.example` as the reference.

## Database release sequence

1. Provision PostgreSQL (Neon or any standard Postgres host).
2. Configure `DATABASE_URL` in the production environment.
3. If attaching an existing database, inspect it and reconcile or baseline migration history deliberately.
4. Run `pnpm --filter @workspace/db run migrate` only against the intended production database.
5. Verify `GET /api/readyz` returns `200` with `{ "status": "ready" }`.

Migrations are not run automatically during install, build, or deployment.

## Optional contact notifications

Set all three variables to enable Resend notifications:

- `RESEND_API_KEY`
- `CONTACT_TO_EMAIL`
- `CONTACT_FROM_EMAIL`

Without them, validated contact messages continue to persist in PostgreSQL and notification delivery is skipped.

## Optional AI provider

For OpenAI, configure `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and optionally `OPENAI_MODEL`.

For Gemini, configure `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, and optionally `GEMINI_MODEL`.

Without provider credentials, the chatbot uses its deterministic local portfolio fallback. Paid AI credentials are not required to deploy.

## Custom domain

`akashsimhadri.com` is the intended production domain. DNS/verification records are supplied by whichever hosting provider is ultimately chosen — do not invent records ahead of that. General flow:

1. Deploy the frontend and API to the chosen hosting provider(s).
2. Connect `akashsimhadri.com` in that provider's custom-domain configuration.
3. Add the exact DNS records the provider supplies in GoDaddy (the domain registrar).
4. Complete domain verification and wait for SSL issuance.
5. Run production UI and API smoke tests.

If the deployed configuration supports it, redirect `www.akashsimhadri.com` to the canonical apex domain instead of serving duplicate content; otherwise document the manual redirect configuration needed for the chosen provider.

## Production smoke tests

- Load `/`, the favicon, `/robots.txt`, and `/sitemap.xml` over HTTPS.
- Verify `/api/healthz` returns `200`.
- Verify `/api/readyz` returns `200` after the database migration.
- Submit a valid contact message and confirm persistence.
- Verify chatbot fallback behavior before adding optional provider credentials.
- Check mobile/desktop rendering, the resume dialog, theme switch, chatbot, and assistant launcher.

## Optional release follow-ups

- Create and approve a dedicated social-sharing image before adding `og:image` or switching Twitter metadata to `summary_large_image`.
- Consider a short contact-form privacy note such as "Your message is stored securely so I can respond." It is intentionally not added in this release because the approved contact layout is frozen.
