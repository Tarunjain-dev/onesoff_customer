"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
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
}
catch {
    connectionString = rawDatabaseUrl;
}
const pool = new pg_1.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
exports.default = prisma;
