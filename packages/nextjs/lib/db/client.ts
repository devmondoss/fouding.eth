import { neon } from "@neondatabase/serverless";

type SqlClient = ReturnType<typeof neon>;
let client: SqlClient | undefined;

function getClient(): SqlClient {
  if (client) return client;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Falta DATABASE_URL en las variables de entorno");
  }
  client = neon(databaseUrl);
  return client;
}

// Keep the tagged-template API while creating Neon only inside a request or
// script. Importing an API route during `next build` must not require secrets.
const lazySql = (...args: unknown[]) =>
  Reflect.apply(getClient(), undefined, args);

export const sql = lazySql as unknown as SqlClient;
