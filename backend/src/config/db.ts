import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const rawDatabaseUrl = process.env.DATABASE_URL;
if (!rawDatabaseUrl) {
  throw new Error("DATABASE_URL is required");
}

// Avoid conflicting SSL behavior coming from URL query params.
// We explicitly control TLS via `ssl` below.
let connectionString = rawDatabaseUrl;
try {
  const parsed = new URL(rawDatabaseUrl);
  [
    "sslmode",
    "sslaccept",
    "ssl",
    "sslcert",
    "sslkey",
    "sslrootcert"
  ].forEach((key) => parsed.searchParams.delete(key));
  connectionString = parsed.toString();
} catch {
  connectionString = rawDatabaseUrl;
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;
