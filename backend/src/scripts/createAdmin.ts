import bcrypt from 'bcryptjs';
import { pool } from '../db.js';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_NAME || 'Front Desk';

  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD before running seed:admin.');
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
  }

  const hash = await bcrypt.hash(password, 12);
  const user = await pool.query(
    `insert into app_users(email, password_hash, display_name)
     values ($1, $2, $3)
     on conflict (email)
     do update set password_hash = excluded.password_hash, display_name = excluded.display_name, updated_at = now()
     returning id`,
    [email, hash, displayName],
  );
  await pool.query(
    `insert into user_roles(user_id, role)
     values ($1, 'admin')
     on conflict (user_id, role) do nothing`,
    [user.rows[0].id],
  );

  console.log(`Admin ready: ${email}`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
