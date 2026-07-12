import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, withTransaction } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = path.resolve(__dirname, '../../sql');

async function main() {
  const files = (await fs.readdir(sqlDir)).filter(file => file.endsWith('.sql')).sort();

  await pool.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  for (const filename of files) {
    const already = await pool.query(`select 1 from schema_migrations where filename = $1`, [filename]);
    if (already.rowCount) {
      console.log(`skip ${filename}`);
      continue;
    }

    const sql = await fs.readFile(path.join(sqlDir, filename), 'utf8');
    await withTransaction(async client => {
      await client.query(sql);
      await client.query(`insert into schema_migrations(filename) values ($1)`, [filename]);
    });
    console.log(`applied ${filename}`);
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
