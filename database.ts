import "server-only";

import { Pool, type QueryResultRow } from "pg";

const globalForPostgres = globalThis as typeof globalThis & {
  qualityfriendPostgresPool?: Pool;
};

function createPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return new Pool({
    connectionString,
    max: 10,
  });
}

export function getDatabasePool() {
  const pool = globalForPostgres.qualityfriendPostgresPool ?? createPool();

  if (process.env.NODE_ENV !== "production") {
    globalForPostgres.qualityfriendPostgresPool = pool;
  }

  return pool;
}

export function queryDatabase<Row extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  return getDatabasePool().query<Row>(text, values);
}
