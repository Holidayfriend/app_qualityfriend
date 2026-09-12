import { Pool } from "pg";

const state = globalThis as typeof globalThis & { jobDatabase?: Pool };
export function jobDatabase() {
  return state.jobDatabase ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
}
