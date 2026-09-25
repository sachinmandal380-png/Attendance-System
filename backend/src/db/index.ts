import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../config/env";
import * as schema from "./schema";

export const pool = new Pool({ connectionString: env.databaseUrl });

pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("Unexpected PostgreSQL pool error", err);
});

export const db = drizzle(pool, { schema });
