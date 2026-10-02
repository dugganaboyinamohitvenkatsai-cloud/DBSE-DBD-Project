import bcrypt from "bcryptjs";
import { pool } from "../src/config/database.js";

async function run() {
  const [existingUser] = await pool.execute("SELECT id FROM users WHERE email = ?", ["rahul.mother@example.com"]);
  let motherUserId;
  if (existingUser.length > 0) {
    motherUserId = existingUser[0].id;
  } else {
    const pwdHash = await bcrypt.hash("Portal@2025", 12);
    const [uRes] = await pool.execute(
      "INSERT INTO users (full_name, email, password_hash, role, phone, is_active) VALUES (?, ?, ?, ?, ?, 1)",
      ["Priya Sharma", "rahul.mother@example.com", pwdHash, "PARENT", "9876543211"]
    );
    motherUserId = uRes.insertId;
  }

  const [existingParent] = await pool.execute("SELECT parent_id FROM parents WHERE email = ?", ["rahul.mother@example.com"]);
  let motherParentId;
  if (existingParent.length > 0) {
    motherParentId = existingParent[0].parent_id;
  } else {
    const [pRes] = await pool.execute(
      "INSERT INTO parents (user_id, name, phone, email) VALUES (?, ?, ?, ?)",
      [motherUserId, "Priya Sharma (Rahul Mother)", "9876543211", "rahul.mother@example.com"]
    );
    motherParentId = pRes.insertId;
  }

  // Link Mother to Student 1 (Rahul) with MOTHER
  await pool.execute(
    "INSERT IGNORE INTO parent_students (parent_id, student_id, relationship_type, is_primary_contact) VALUES (?, 1, 'MOTHER', FALSE)",
    [motherParentId]
  );

  // Update Rahul Father to FATHER in parent_students
  await pool.execute(
    "UPDATE parent_students SET relationship_type = 'FATHER', is_primary_contact = TRUE WHERE parent_id = 2 AND student_id = 1"
  );

  // Link Rahul Parent (Father, parent_id: 2) also to Student 3 (Mohit) as GUARDIAN to demonstrate ONE parent -> MULTIPLE students
  await pool.execute(
    "INSERT IGNORE INTO parent_students (parent_id, student_id, relationship_type, is_primary_contact) VALUES (2, 3, 'GUARDIAN', FALSE)"
  );

  const [links] = await pool.execute(`
    SELECT ps.id, p.name AS parent_name, s.name AS student_name, ps.relationship_type, ps.is_primary_contact
    FROM parent_students ps
    JOIN parents p ON p.parent_id = ps.parent_id
    JOIN students s ON s.student_id = ps.student_id
    ORDER BY s.student_id, p.parent_id
  `);
  console.log("UPDATED_PARENT_STUDENT_RELATIONSHIPS:", JSON.stringify(links, null, 2));

  process.exit(0);
}
run().catch(console.error);
