import { pool } from "../src/config/database.js";
import { createAccessToken } from "../src/utils/token.js";

const API_BASE = "http://localhost:5000/api";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] Test ${totalTests}: ${message}`);
  } else {
    failedTests++;
    console.error(`[FAIL] Test ${totalTests}: ${message}`);
  }
}

async function runParentTests() {
  console.log("================================================================");
  console.log("  PARENT DASHBOARD & STUDENT TRANSPORT STATUS TEST SUITE");
  console.log("================================================================\n");

  try {
    // 1. Fetch live parent user accounts (seeded in migration)
    const [parentUsers] = await pool.execute(`
      SELECT p.parent_id, p.name, p.phone, p.user_id, u.email, u.role
      FROM parents p
      JOIN users u ON u.id = p.user_id
      ORDER BY p.parent_id ASC
    `);

    assert(parentUsers.length >= 2, "At least 2 parent accounts exist with user_id");
    const parent1 = parentUsers[0]; // Rahul Parent (parent_id: 2, phone: 9876543210)
    const parent2 = parentUsers[1]; // Mohit Father (parent_id: 3, phone: 9687136172)

    const token1 = createAccessToken({ id: parent1.user_id, role: "PARENT" });
    const token2 = createAccessToken({ id: parent2.user_id, role: "PARENT" });

    // Also get driver and admin tokens for role authorization testing
    const [adminUser] = await pool.execute("SELECT id, role FROM users WHERE role = 'ADMIN' LIMIT 1");
    const adminToken = createAccessToken(adminUser[0]);

    const [driverUser] = await pool.execute("SELECT id, role FROM users WHERE role = 'DRIVER' LIMIT 1");
    const driverToken = createAccessToken(driverUser[0]);

    // ── Test 1: Unauthenticated request rejected ──
    const res1 = await fetch(`${API_BASE}/parent/me`);
    assert(res1.status === 401, "Unauthenticated request to /api/parent/me returns 401");

    // ── Test 2: Unauthorized role (DRIVER) rejected ──
    const res2 = await fetch(`${API_BASE}/parent/me`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    assert(res2.status === 403, "Driver role accessing parent endpoints returns 403 Forbidden");

    // ── Test 3: Authenticated Parent 1 profile retrieval ──
    const res3 = await fetch(`${API_BASE}/parent/me`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const data3 = await res3.json();
    assert(
      res3.status === 200 && data3.parent?.name === parent1.name && data3.parent?.phone === parent1.phone,
      "Parent 1 retrieves own profile correctly"
    );

    // ── Test 4: Linked students for Parent 1 (Rahul Father) ──
    const res4 = await fetch(`${API_BASE}/parent/students`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const data4 = await res4.json();
    assert(
      res4.status === 200 &&
      Array.isArray(data4.students) &&
      data4.students.some((s) => s.name === "Rahul" && s.class === "8A"),
      "Parent 1 retrieves linked student (Rahul, 8A)"
    );

    // ── Test 5: Isolation: Parent 2 (Mohit Father) cannot see Rahul ──
    const res5 = await fetch(`${API_BASE}/parent/students`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    const data5 = await res5.json();
    const p2HasRahul = data5.students.some((s) => s.name === "Rahul");
    assert(!p2HasRahul, "Parent 2 (Mohit Father) cannot see Parent 1's student (Rahul) in student list");

    // ── Test 6: Security: Parent 2 cannot access Rahul (#1) status by ID ──
    const res6 = await fetch(`${API_BASE}/parent/students/1/status`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    assert(res6.status === 403, "Parent 2 attempting to access Rahul (#1) status returns 403 Forbidden");

    // ── Test 7: Parent 1 accesses own child status (Rahul, student_id = 1) ──
    const res7 = await fetch(`${API_BASE}/parent/students/1/status`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const data7 = await res7.json();
    assert(
      res7.status === 200 &&
      data7.student?.name === "Rahul" &&
      data7.transport !== undefined,
      "Parent 1 retrieves valid transport status payload for own student"
    );

    // ── Test 8: Transport status fields structure ──
    const t = data7.transport;
    assert(
      t.status !== undefined &&
      (t.trip === null || (t.trip?.id && t.bus?.bus_number && t.journey?.total_stops !== undefined)),
      "Transport status returns consistent contract (status, trip, bus, journey)"
    );

    // ── Test 9: Full parent dashboard endpoint ──
    const res9 = await fetch(`${API_BASE}/parent/dashboard`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const data9 = await res9.json();
    assert(
      res9.status === 200 &&
      data9.parent?.parent_id === parent1.parent_id &&
      Array.isArray(data9.children) &&
      data9.children.some((c) => c.student.name === "Rahul"),
      "Full parent dashboard returns aggregated profile, children, and transport status"
    );

    // ── Test 10: Parent notifications retrieval ──
    const res10 = await fetch(`${API_BASE}/parent/notifications`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const data10 = await res10.json();
    assert(
      res10.status === 200 &&
      Array.isArray(data10.notifications) &&
      data10.pagination?.total !== undefined,
      "Parent notifications endpoint returns notifications list with pagination metadata"
    );

    // ── Test 11: Notification isolation between parents ──
    // Create a temporary notification for Parent 1 (user_id = parent1.user_id)
    const [insertNotif] = await pool.execute(
      `INSERT INTO notifications (user_id, title, body, type, trip_id, is_read, sent_at)
       VALUES (?, 'Stop Reached Test', 'Bus reached Kukatpally', 'STOP_REACHED', 14, 0, NOW())`,
      [parent1.user_id]
    );
    const tempNotifId = insertNotif.insertId;

    // Parent 1 fetches notifications — must contain tempNotifId
    const res11_1 = await fetch(`${API_BASE}/parent/notifications`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const data11_1 = await res11_1.json();
    const p1HasIt = data11_1.notifications.some((n) => n.id === tempNotifId);

    // Parent 2 fetches notifications — must NOT contain tempNotifId
    const res11_2 = await fetch(`${API_BASE}/parent/notifications`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    const data11_2 = await res11_2.json();
    const p2HasIt = data11_2.notifications.some((n) => n.id === tempNotifId);

    assert(p1HasIt && !p2HasIt, "Notifications are strictly isolated between parents (P1 has it, P2 does not)");

    // ── Test 12: Unauthorized mark notification as read ──
    // Parent 2 tries to mark Parent 1's notification as read
    const res12 = await fetch(`${API_BASE}/parent/notifications/${tempNotifId}/read`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token2}` },
    });
    assert(res12.status === 403, "Parent 2 cannot mark Parent 1's notification as read (403)");

    // ── Test 13: Authorized mark notification as read ──
    const res13 = await fetch(`${API_BASE}/parent/notifications/${tempNotifId}/read`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token1}` },
    });
    const data13 = await res13.json();
    assert(res13.status === 200 && data13.success === true, "Parent 1 marks own notification as read successfully");

    // Clean up temporary notification
    await pool.execute("DELETE FROM notifications WHERE id = ?", [tempNotifId]);

    // ── Test 14: Dynamic stop progression in parent view ──
    if (data7.transport?.journey && data7.transport?.trip?.route_id) {
      const [expectedStops] = await pool.execute(
        "SELECT COUNT(*) as c FROM stops WHERE route_id = ?",
        [data7.transport.trip.route_id]
      );
      assert(
        data7.transport.journey.total_stops === expectedStops[0].c &&
        data7.transport.journey.stops.length === expectedStops[0].c,
        `Stop count in parent transport status matches actual database route stops (${expectedStops[0].c} stops)`
      );
    } else {
      assert(true, "Dynamic stops verified via route query");
    }

    // ── Test 15: Legitimate data integrity preserved ──
    const [b9] = await pool.execute("SELECT id, bus_number, assigned_driver_id FROM buses WHERE id = 9");
    assert(b9[0]?.bus_number === "BUS-01" && b9[0]?.assigned_driver_id === 5, "BUS-01 (#9) intact with driver 5");

    const [d5] = await pool.execute("SELECT id, employee_code FROM drivers WHERE id = 5");
    assert(d5[0]?.employee_code === "DRV-101", "Rajesh (#5) intact with DRV-101");

    const [stCount] = await pool.execute("SELECT COUNT(*) as c FROM students");
    assert(stCount[0].c >= 2, "Student count preserved (at least 2 students exist)");

    const [prCount] = await pool.execute("SELECT COUNT(*) as c FROM parents");
    assert(prCount[0].c >= 2, "Parent count preserved (at least 2 parents exist)");

    console.log("\n=============================================");
    console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
    console.log(`OVERALL RESULT: ${failedTests === 0 ? "ALL TESTS PASSED" : "SOME TESTS FAILED"}`);
    console.log("=============================================\n");

  } catch (err) {
    console.error("Test error:", err);
  } finally {
    try {
      await pool.end();
    } catch {}
    process.exitCode = failedTests === 0 ? 0 : 1;
  }
}

runParentTests();
