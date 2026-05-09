import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const { Pool } = pg;

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

const pgPool = new Pool({
  connectionString,
  host: process.env.DB_HOST || undefined,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  user: process.env.DB_USER || undefined,
  password: process.env.DB_PASSWORD || undefined,
  database: process.env.DB_NAME || undefined,
  ssl: String(process.env.DB_SSL || "true") === "true" ? { rejectUnauthorized: false } : false,
});

function toPgPlaceholders(sql) {
  let idx = 0;
  return sql.replace(/\?/g, () => {
    idx += 1;
    return `$${idx}`;
  });
}

async function run(sql, params = []) {
  const convertedSql = toPgPlaceholders(sql);
  const isInsert = /^\s*INSERT\s+/i.test(convertedSql);
  const hasReturning = /\bRETURNING\b/i.test(convertedSql);
  const finalSql = isInsert && !hasReturning ? `${convertedSql} RETURNING id` : convertedSql;
  const result = await pgPool.query(finalSql, params);

  if (/^\s*SELECT\s+/i.test(convertedSql)) {
    return [result.rows, result.fields];
  }
  if (isInsert) {
    return [{ insertId: result.rows[0]?.id ?? null, affectedRows: result.rowCount }, result.fields];
  }
  return [{ affectedRows: result.rowCount }, result.fields];
}

export const pool = {
  execute: run,
  query: run,
};
