## Secure Dashboard – Integration Overview

This project hosts the business corpus (\~1,100+ records) plus a small API surface that lets other apps—like the RSVP microsite—pull contacts and push engagement telemetry.

### Environment

Create a `.env` (see `.env.example`) with:

```
DATABASE_URL="postgresql://…"
INTEGRATION_API_KEY="long-random-string"
```

The API key is required for all `/api/integration/*` endpoints.

### Database

Run Prisma client generation (and apply schema changes) with:

```bash
npm install
npx prisma db execute --file prisma/migrations/202509190512_add_campaign_invites/migration.sql --schema prisma/schema.prisma
npx prisma generate
```

The new `campaign_invites` table links every business to a unique campaign token and keeps running tallies for email sends, visits, and RSVPs.

### Integration API

All routes live under `/api/integration` and require the `INTEGRATION_API_KEY` via the `Authorization: Bearer <key>` header (or `x-api-key`).

- `GET /api/integration/businesses`
  - Optional query params:
    - `createMissing=1` – backfills `campaign_invites` for businesses without one.
    - `hasEmail=1` – return only businesses with at least one email.
    - `limit` / `cursor` – pagination (default 200, max 500).
  - Response contains business contact data plus invite stats.

- `POST /api/integration/events`
  - Body: `{ token?: string, businessId?: string, type: 'email_sent' | 'visit' | 'rsvp', meta?: {...} }`
  - Updates invite counters. RSVP events also append a Note on the business record.

### Local development

```bash
npm run dev        # start Next.js locally
npm run lint       # lint
npm run type-check # TypeScript
```

Deploys on Vercel use `npm run vercel:build` (runs `prisma generate` then `next build`).
