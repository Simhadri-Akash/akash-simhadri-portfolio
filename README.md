# Akash Simhadri — Portfolio

React portfolio and Express API for project presentation, contact-message persistence, and a grounded portfolio assistant.

## Stack

React, TypeScript, Vite, Express, PostgreSQL, Drizzle, OpenAPI, and optional OpenAI or Gemini integration.

## Repository structure

- `apps/portfolio` — React portfolio
- `apps/api` — Express API
- `packages/db` — Drizzle schema and migrations
- `packages/api-spec` — OpenAPI contract and code generation
- `packages/api-client-react` — generated React Query client
- `packages/api-zod` — generated request and response schemas

## Local setup

```sh
pnpm install
```

Copy `apps/api/.env.example` to a local environment file and configure `DATABASE_URL`. Copy `apps/portfolio/.env.example` too if the frontend needs to reach an API running on a different origin. Run the two services in separate terminals:

```sh
pnpm --filter @workspace/api-server dev    # http://localhost:8080
pnpm --filter @workspace/portfolio dev     # http://localhost:21113
```

## Verification

```sh
pnpm run typecheck
pnpm run test
pnpm run build
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db exec drizzle-kit check --config ./drizzle.config.ts
```

## Deployment

The frontend (`apps/portfolio`) and API (`apps/api`) can be deployed to any standard static-hosting and Node-hosting provider, together or on separate origins — the frontend's API base URL is configured through `VITE_API_BASE_URL` (see `apps/portfolio/.env.example`). Production uses `https://akashsimhadri.com/` as the canonical URL. Environment requirements, database migration order, optional Resend/AI setup, and custom-domain steps are documented in [docs/deployment.md](docs/deployment.md).
