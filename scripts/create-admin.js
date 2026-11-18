import 'dotenv/config';
import { requireDatabaseUrl } from '../src/config/env.js';
import { createDatabase } from '../src/services/database.js';
import { normalizeEmail } from '../src/services/authentication.js';
import { hashPassword, validNewPassword, passwordPolicy } from '../src/services/passwords.js';

let db;
try {
  const url = requireDatabaseUrl();
  const name = process.env.ADMIN_NAME?.trim();
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_PASSWORD;
  if (!name || name.length > 100 || !email || !validNewPassword(password)) {
    console.error(`Set ADMIN_NAME (1–100 characters), ADMIN_EMAIL and ADMIN_PASSWORD privately. ${passwordPolicy}`);
    process.exitCode = 1;
  } else {
    db = createDatabase(url);
    const password_hash = await hashPassword(password);
    // Deliberately no upsert: reruns must never reset an existing account's password.
    await db.adminUser.create({ data: { name, email, password_hash } });
    console.log('Admin created. Sign in at /admin/login; credentials were not printed.');
  }
} catch {
  console.error('Admin was not created. Check migrations, database availability and whether this email is already registered.');
  process.exitCode = 1;
} finally {
  await db?.$disconnect();
}
