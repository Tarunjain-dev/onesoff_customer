import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const rawDatabaseUrl = process.env.DATABASE_URL!
const parsed = new URL(rawDatabaseUrl)
;['sslmode','sslaccept','ssl','sslcert','sslkey','sslrootcert'].forEach(k => parsed.searchParams.delete(k))
const connectionString = parsed.toString()

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const cats = await prisma.category.findMany({ orderBy: { id: 'asc' } })
  console.log('CATEGORIES IN DB:', JSON.stringify(cats, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2))
  const count = await prisma.category.count()
  console.log('TOTAL COUNT:', count)
}

main().catch(console.error).finally(() => { prisma.$disconnect(); pool.end() })
