// PostgreSQL connection pool (see docs/DECISION_LOG.md D-002/D-007).
// One pool per process, reused across hot-reloads in dev the same way
// src/lib/db.ts used to cache its single SQLite handle on `global`.
import { Pool, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __zcubsPgPool: Pool | undefined;
}

function makePool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and set a real Postgres connection string — see docs/DEPLOYMENT.md."
    );
  }
  return new Pool({ connectionString, max: 10 });
}

export const pool = global.__zcubsPgPool ?? makePool();
if (!global.__zcubsPgPool) global.__zcubsPgPool = pool;

/** Run a query with parameters. Prefer this over `pool.query` directly so every call site is easy to grep. */
export async function q<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await pool.query<T>(text, params as never[]);
  return res.rows;
}

export async function qOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

/** Run `fn` inside a transaction. `fn` receives a client with the same `query` signature. */
export async function tx<T>(fn: (client: { query: typeof pool.query }) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export const newId = () => crypto.randomUUID();
export const now = () => new Date();
