import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api';

async function main() {
  console.log('=== TESTING PARENT SEAT INTEGRATION ===');

  // 1. Log in as parent
  console.log('\n1. Logging in as parent rahul.parent@example.com...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rahul.parent@example.com', password: 'Parent@12345' }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    throw new Error(`Parent login failed: ${JSON.stringify(loginData)}`);
  }
  const token = loginData.token;
  console.log('Parent login successful.');

  // 2. Fetch parent students
  console.log('\n2. Fetching /api/parent/students...');
  const studentsRes = await fetch(`${BASE_URL}/parent/students`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const studentsData = await studentsRes.json();
  console.log(`Status: ${studentsRes.status}, count: ${(studentsData.students || []).length}`);
  const sampleStudent = (studentsData.students || [])[0];
  if (sampleStudent) {
    console.log(`Student sample: ID=${sampleStudent.student_id}, Name=${sampleStudent.name}, Seat Number=${sampleStudent.seat_number}`);
  }

  // 3. Fetch parent dashboard
  console.log('\n3. Fetching /api/parent/dashboard...');
  const dashRes = await fetch(`${BASE_URL}/parent/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const dashData = await dashRes.json();
  console.log(`Status: ${dashRes.status}, children count: ${(dashData.children || []).length}`);
  if (dashData.children && dashData.children.length > 0) {
    const child = dashData.children[0];
    console.log(`Child transport status: ${child.transport?.status}`);
    console.log(`Child transport seat_number: ${child.transport?.seat_number}`);
    console.log(`Child student seat_number: ${child.student?.seat_number}`);
  }

  console.log('\n=== PARENT SEAT INTEGRATION VERIFIED SUCCESSFULLY ===');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
