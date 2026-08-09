#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Database migrations are intentionally deliberate and are never applied on merge.
pnpm run typecheck
