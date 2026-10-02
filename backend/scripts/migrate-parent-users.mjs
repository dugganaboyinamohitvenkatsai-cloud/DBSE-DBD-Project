import bcrypt from "bcryptjs";
import { pool } from "../src/config/database.js";

async function migrate() {
  console.log("=== Parent User Migration ===\n");

  const [cols] = await pool.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "parents" AND COLUMN_NAME = "user_id"
  `);

  if (cols.length === 0) {
    console.log("Adding user_id column to parents table...");
    await pool.execute(`
      ALTER TABLE parents
      ADD COLUMN user_id BIGINT UNSIGNED NULL DEFAULT NULL,
      ADD CONSTRAINT fk_parents_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    `);
    console.log("Column added.");
  } else {
    console.log("user_id column already exists — skipping ALTER.");
  }

  const [parents] = await pool.execute("SELECT parent_id, name, phone, email, user_id FROM parents");

  for (const parent of parents) {
    if (parent.user_id) {
      console.log("Skipping " + parent.name + " (already linked to user_id=" + parent.user_id + ")");
      continue;
    }

    const loginEmail = parent.email
      ? parent.email.trim().toLowerCase()
      : "parent." + parent.phone + "@schoolbus.local";

    const passwordHash = await bcrypt.hash("Portal@2025", 12);

    const [existingUser] = await pool.execute(
      "SELECT id FROM users WHERE email = ? AND role = ?",
      [loginEmail, "PARENT"]
    );

    let userId;
    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      console.log("Found existing PARENT user for " + parent.name + " (user_id=" + userId + ")");
    } else {
      const [insertRes] = await pool.execute(
        "INSERT INTO users (full_name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1)",
        [parent.name, loginEmail, passwordHash, "PARENT"]
      );
      userId = insertRes.insertId;
      console.log("Created PARENT user: " + parent.name + " -> user_id=" + userId + ", email=" + loginEmail);
    }

    await pool.execute("UPDATE parents SET user_id = ? WHERE parent_id = ?", [userId, parent.parent_id]);
    console.log("Linked parent_id=" + parent.parent_id + " -> user_id=" + userId);
  }

  const [result] = await pool.execute(`
    SELECT p.parent_id, p.name, p.user_id, u.email AS login_email
    FROM parents p JOIN users u ON u.id = p.user_id
  `);
  console.log("\nParent accounts created:");
  result.forEach(r => console.log("  " + r.name + ": " + r.login_email + " / Portal@2025"));

  console.log("\nMigration Complete.");
  process.exit(0);
}

migrate().catch((err) => { console.error(err); process.exit(1); });
