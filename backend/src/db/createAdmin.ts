/**
 * Secure initial admin setup.
 * Usage: npm run create-admin -- <username> <email> <password>
 */
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import { admins } from "./schema";

async function main() {
  const [username, email, password] = process.argv.slice(2);

  if (!username || !password) {
    console.error("Usage: npm run create-admin -- <username> <email> <password>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const [existing] = await db.select().from(admins).where(eq(admins.username, username)).limit(1);
  if (existing) {
    console.error(`Admin "${username}" already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [created] = await db
    .insert(admins)
    .values({ username, email: email || null, passwordHash })
    .returning();

  console.log(`Admin created: ${created.username} (id ${created.id})`);
  await pool.end();
}

main().catch((err) => {
  console.error("Failed to create admin:", err);
  process.exit(1);
});
