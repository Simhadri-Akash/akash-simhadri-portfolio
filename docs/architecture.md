# Architecture

The portfolio is a Vite-built React application in `apps/portfolio`. It calls the Express API in `apps/api` through `/api/...` requests.

The frontend and API can be deployed to the same origin or to two separate origins. `packages/api-client-react`'s `setBaseUrl` — called once in `apps/portfolio/src/main.tsx` from the `VITE_API_BASE_URL` environment variable — is the single place that controls this: unset (or empty) keeps requests relative for same-origin deployments; set it to the API's origin when the two are hosted separately. No other code reads that environment variable directly.

PostgreSQL access, the Drizzle schema, and committed migrations live in `packages/db`. Migrations run only through explicit database commands.

`packages/api-spec/openapi.yaml` is the API contract. Orval generates the React Query client in `packages/api-client-react` and Zod schemas in `packages/api-zod`.
