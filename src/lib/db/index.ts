import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let client: ReturnType<typeof postgres> | null = null;
let dbInstance: Db | null = null;

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and start Postgres.");
  }
  if (!dbInstance) {
    client = postgres(url, { max: 1, prepare: false });
    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
}

export { schema };
