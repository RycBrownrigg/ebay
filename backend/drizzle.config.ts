import { defineConfig } from 'drizzle-kit';

// drizzle-kit CLI config. Used for `pnpm --filter @ebay/backend run db:generate`
// (emit migration SQL from schema diff) and `db:migrate` (apply pending
// migrations to DATABASE_URL). The runtime app uses src/db/migrate.ts
// instead — this config is dev-tool-only.

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgres://ebay:dev@localhost:5432/ebay',
  },
  strict: true,
  verbose: true,
});
