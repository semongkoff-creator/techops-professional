const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

(async () => {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
    host: process.env.DB_HOST || undefined,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    user: process.env.DB_USER || undefined,
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME || undefined,
    ssl: String(process.env.DB_SSL || "true") === "true" ? { rejectUnauthorized: false } : false,
  });
  const client = await pool.connect();

  const schema = fs.readFileSync(path.join(__dirname, "../../sql/schema.sql"), "utf8");
  const seed = fs.readFileSync(path.join(__dirname, "../../sql/seed.sql"), "utf8");

  try {
    await client.query("BEGIN");
    await client.query(schema);
    await client.query(seed);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }

  console.log("Migration + seed completed");
})();
