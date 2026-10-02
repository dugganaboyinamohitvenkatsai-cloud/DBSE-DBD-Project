import { pool } from "../src/config/database.js";

async function run() {
  console.log("=== PHASE 1 MIGRATION: parent_students table ===");

  // 1. Create table if not exists
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS parent_students (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      parent_id INT NOT NULL,
      student_id INT NOT NULL,
      relationship_type ENUM('FATHER', 'MOTHER', 'GUARDIAN', 'OTHER') NOT NULL DEFAULT 'GUARDIAN',
      is_primary_contact BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_parent_student (parent_id, student_id),
      INDEX idx_ps_parent (parent_id),
      INDEX idx_ps_student (student_id),
      CONSTRAINT fk_ps_parent FOREIGN KEY (parent_id) REFERENCES parents(parent_id) ON DELETE CASCADE,
      CONSTRAINT fk_ps_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log("✓ parent_students table verified/created.");

  // 2. Safe relationship migration: inspect matches between parents and students via phone
  const [matches] = await pool.execute(`
    SELECT p.parent_id, p.name AS parent_name, p.phone AS parent_phone,
           s.student_id, s.name AS student_name, s.parent_phone AS student_parent_phone
    FROM parents p
    JOIN students s ON s.parent_phone = p.phone
  `);

  console.log(`Found ${matches.length} safe relationship match(es) via phone:`);
  for (const m of matches) {
    console.log(`  -> Match: Parent "${m.parent_name}" (ID:${m.parent_id}) <-> Student "${m.student_name}" (ID:${m.student_id})`);
    // Determine default relationship_type based on name if obvious
    let rel = 'GUARDIAN';
    if (/father/i.test(m.parent_name)) rel = 'FATHER';
    else if (/mother/i.test(m.parent_name)) rel = 'MOTHER';

    await pool.execute(`
      INSERT IGNORE INTO parent_students (parent_id, student_id, relationship_type, is_primary_contact)
      VALUES (?, ?, ?, TRUE)
    `, [m.parent_id, m.student_id, rel]);
  }

  // 3. Inspect unmatched records
  const [unmatchedStudents] = await pool.execute(`
    SELECT s.student_id, s.name, s.parent_phone
    FROM students s
    LEFT JOIN parents p ON p.phone = s.parent_phone
    WHERE p.parent_id IS NULL
  `);
  console.log("\nUnmatched students (no phone match with parents):");
  unmatchedStudents.forEach(s => console.log(`  -> Student ID ${s.student_id} ("${s.name}") with parent_phone: "${s.parent_phone}"`));

  const [unmatchedParents] = await pool.execute(`
    SELECT p.parent_id, p.name, p.phone
    FROM parents p
    LEFT JOIN students s ON s.parent_phone = p.phone
    WHERE s.student_id IS NULL
  `);
  console.log("\nUnmatched parents (no student with this phone):");
  unmatchedParents.forEach(p => console.log(`  -> Parent ID ${p.parent_id} ("${p.name}") with phone: "${p.phone}"`));

  const [totalLinks] = await pool.execute("SELECT COUNT(*) AS c FROM parent_students");
  console.log(`\nTotal links in parent_students: ${totalLinks[0].c}`);

  console.log("=== PHASE 1 MIGRATION COMPLETE ===");
  process.exit(0);
}

run().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
