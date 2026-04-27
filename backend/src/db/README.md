# Database layer — `backend/src/db/`

Reference notes on the database tooling used in this directory.
Comments inside `schema.ts`, `client.ts`, and `migrate.ts` cover
project-specific decisions (why fields are nullable, why the pool size
is 5, etc.). This file covers the broader "what _is_ Drizzle" and
"why does the schema need a `customType`" questions.

---

## What Drizzle is

**ORM = Object-Relational Mapper.** A library that lets you define your
database schema in your programming language (TypeScript here) and
write queries against it with type safety, instead of writing raw SQL
strings everywhere.

Drizzle is one such ORM, chosen in `BUILD_PLAN.md` §1 over Prisma for
a "lighter, SQL-native, TypeScript-first" feel. It comes in two
pieces, each with a separate role.

### `drizzle-orm` — the runtime library

Imported from `backend/src/...` at runtime. You define a table once,
in TypeScript:

```ts
// backend/src/db/schema.ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

Then you query it with full type safety:

```ts
const result = await db.select().from(users).where(eq(users.email, 'ryc@brownrigg.mt'));

// `result` is typed as { id: string, email: string, createdAt: Date }[]
// — no manual type assertions, no `any`. If you typo `users.emaill`,
// tsc fails at compile time.
```

The query builder reads like SQL because it _is_ SQL — Drizzle's
philosophy is "no surprise queries." `db.select().from(users).where(eq(...))`
emits `SELECT * FROM users WHERE email = $1` and nothing else. That's
in deliberate contrast to Prisma, where `db.user.findMany({ where: { ... }, include: { ... } })`
generates queries that can be hard to predict.

### `drizzle-kit` — the development CLI

Only run during development. Two main jobs:

- **Generate migrations.** Diff your TypeScript schema against the
  current DB state and emit a SQL migration file in
  `backend/drizzle/`. Each file is human-readable SQL like
  `CREATE TABLE users (...);` — version-controlled, reviewable in PRs,
  hand-editable when needed.
- **Apply migrations.** Run those SQL files against a target database
  (local dev or VPS production) in order, tracking which have
  already been applied in a Drizzle-managed bookkeeping table.

In this project, the CLI is exposed via three pnpm scripts on
`@ebay/backend`:

| Script                                        | What it does                                                                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm --filter @ebay/backend run db:generate` | Diff `schema.ts` against the current snapshot in `backend/drizzle/meta/`, emit a new `0001_*.sql` file plus updated meta files.                                          |
| `pnpm --filter @ebay/backend run db:migrate`  | Apply pending migrations to the DB at `DATABASE_URL`. Used during local dev; in production the api container runs `runMigrations()` programmatically at startup instead. |
| `pnpm --filter @ebay/backend run db:studio`   | Launch Drizzle Studio — a browser-based DB inspector for poking around tables locally.                                                                                   |

### Day-to-day flow

1. Edit `schema.ts` (e.g., add a column).
2. Run `pnpm --filter @ebay/backend run db:generate` — creates
   `backend/drizzle/0001_some_name.sql` with the SQL diff.
3. Commit both `schema.ts` and the migration file.
4. On deploy, the api container's startup runs `runMigrations()`,
   which applies any pending migrations before serving requests.
   Idempotent — Drizzle skips migrations already applied.
5. Your new column is now usable in queries with the right type.

### Why Drizzle (vs. Prisma)

- **SQL-native API.** Queries look like SQL, behave like SQL, no
  hidden N+1 surprises.
- **No code-generation step.** Prisma requires running
  `prisma generate` after every schema change to produce a separate
  generated client file. Drizzle's types come directly from your
  schema definition — no extra step, no generated files to commit
  or `.gitignore`.
- **Lightweight runtime.** Smaller dependency footprint, faster
  cold starts, less magic.
- **Migrations are plain SQL.** Readable, hand-editable when needed,
  no opaque format. If a migration ever needs custom SQL (e.g., a
  data backfill that Drizzle can't infer), you just edit the file.

---

## `customType` — declaring column types Drizzle doesn't ship with

Drizzle exports built-in helpers for most Postgres column types:

```ts
import { text, uuid, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
```

Each is a function that returns a column definition that knows:

- What SQL to emit during migration (`text` ↔ `TEXT`, `uuid` ↔ `UUID`,
  etc.).
- What TypeScript type the column reads/writes as (e.g., `text` ↔
  `string`, `timestamp` ↔ `Date`).

But Postgres has _many_ column types, and Drizzle doesn't ship a
helper for every one. The notable absence for this project is
**`bytea`** — Postgres's column type for raw binary data (think
"blob" in other databases). We need it for the
`ebay_auth.refresh_token_sealed` column, which holds libsodium-sealed
ciphertext bytes.

### Why `bytea` for the refresh token

When libsodium seals a token, the output is raw ciphertext bytes.
Two options for storing it:

- **Base64-encode and store in `text`** — works, but adds ~33%
  storage overhead, an encode/decode step on every read and write,
  and leaks encoding concerns into the DB layer.
- **Store the bytes directly in a `bytea` column** — no encoding,
  no overhead, the column type accurately reflects what's in there.

Option 2 is cleaner and what we do.

### How `customType` works

Drizzle exports a generic helper called `customType` that lets you
declare any column type it doesn't ship a helper for. You give it
two things:

```ts
const bytea = customType<{ data: Buffer; notNull: true }>({
  dataType() {
    return 'bytea';
  },
});
```

1. **The TypeScript generic** `<{ data: Buffer; notNull: true }>`
   says: "in JavaScript-land, the column reads and writes as a Node
   `Buffer`." That's how Drizzle types the column in `select` /
   `insert` results — `db.select(...).then(rows => rows[0].refreshTokenSealed)`
   is typed as `Buffer`.

2. **The `dataType()` method** returns the SQL-side type name
   (`'bytea'`). That's what Drizzle emits in migration SQL:
   `CREATE TABLE ebay_auth (... refresh_token_sealed BYTEA NOT NULL ...);`.

The result, `bytea`, is now a function with the same shape as `text`
or `uuid`. You call it inside `pgTable(...)` like any other column
helper:

```ts
refreshTokenSealed: bytea('refresh_token_sealed').notNull(),
```

All the chained modifiers from the built-ins still work: `.notNull()`,
`.references(...)`, `.default(...)`, etc.

### Reading and writing in practice

When the M1.2 OAuth callback handler stores a sealed refresh token:

```ts
import { db } from './db/client.js';
import { ebayAuth } from './db/schema.js';

const sealedBytes: Buffer = sealRefreshToken(plaintextToken); // libsodium output

await db.insert(ebayAuth).values({
  userId: someUser.id,
  refreshTokenSealed: sealedBytes, // ← Buffer goes in directly
  ebayUserId: 'TestUser_123',
});
```

When reading it back to mint a new access token:

```ts
const row = await db.select().from(ebayAuth).where(...).then(r => r[0]);
const sealedBytes: Buffer = row.refreshTokenSealed; // ← Buffer comes out
const plaintextToken = unsealRefreshToken(sealedBytes);
```

No base64 dance at the boundary. The `postgres-js` driver handles
the binary wire protocol; Drizzle types the value as `Buffer`
because we told it to via the generic.

That's all `customType` is — a generic escape hatch for Postgres
types Drizzle didn't ship a helper for. Other plausible uses in
future milestones: `tsvector` if we ever add full-text search,
`citext` for case-insensitive text columns, `numeric` with custom
precision for currency, `interval`, etc.
