require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { pool } = require("../db");

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedMigrations() {
  const result = await pool.query("SELECT filename FROM schema_migrations");
  return new Set(result.rows.map((r) => r.filename));
}

async function run() {
  await ensureMigrationsTable();
  const done = await appliedMigrations();
  const migrationsDir = path.join(__dirname, "..", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`Applying migration ${file}`);
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }

  console.log("Migrations complete");
  await pool.end();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
