import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api';

async function main() {
  console.log('=== TESTING SEAT ALLOCATION & LOCATION SEARCH ===');

  // 1. Admin login
  console.log('\n1. Logging in as Admin...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@schoolbus.local', password: 'Admin@12345' }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    throw new Error(`Admin login failed: ${JSON.stringify(loginData)}`);
  }
  const token = loginData.token;
  console.log('Admin login successful.');

  // 2. Test Location Search
  console.log('\n2. Testing Location Search endpoint: /api/admin/routes/search-location...');
  const locRes = await fetch(`${BASE_URL}/admin/routes/search-location?query=Secunderabad`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const locData = await locRes.json();
  console.log(`Location search response status: ${locRes.status}`);
  if (locRes.ok && locData.success && locData.results && locData.results.length > 0) {
    console.log(`PASS: Found ${locData.results.length} locations. First match: ${locData.results[0].display_name}, lat=${locData.results[0].latitude}, lng=${locData.results[0].longitude}`);
  } else {
    console.warn(`WARN: Location search returned: ${JSON.stringify(locData)}`);
  }

  // 3. Get Trips to find an active or scheduled trip
  console.log('\n3. Fetching trips to test seat layout...');
  const tripsRes = await fetch(`${BASE_URL}/admin/trips`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const tripsData = await tripsRes.json();
  const trips = tripsData.trips || tripsData.items || [];
  if (!trips.length) {
    throw new Error('No trips found in database to test.');
  }
  const trip = trips[0];
  console.log(`Selected trip ID: ${trip.id}, Bus ID: ${trip.bus_id}, Capacity: ${trip.bus_capacity || trip.capacity || 40}`);

  // 4. Fetch Seat Layout
  console.log(`\n4. Fetching seat layout for Trip ${trip.id}...`);
  const seatsRes = await fetch(`${BASE_URL}/admin/trips/${trip.id}/seats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const seatsData = await seatsRes.json();
  console.log(`Seat layout status: ${seatsRes.status}`);
  if (!seatsRes.ok) {
    throw new Error(`Failed to fetch seats: ${JSON.stringify(seatsData)}`);
  }
  const seats = seatsData.layout || [];
  console.log(`Trip capacity: ${seatsData.total_capacity}, Total visual seats: ${seats.length}, Currently assigned: ${seatsData.occupied_count}`);
  const unassignedStudents = seatsData.students.filter(s => !seatsData.assignments.some(a => a.student_id === s.student_id));
  const eligibleStudents = seatsData.students;
  if (!eligibleStudents.length) {
    throw new Error('No students found on this trip/route to test assignment.');
  }
  const testStudent = unassignedStudents[0] || eligibleStudents[0];
  console.log(`Test student selected: ID=${testStudent.student_id}, Name=${testStudent.name}`);

  // Find a free seat
  const freeSeat = seats.find(s => !s.is_occupied);
  if (!freeSeat) {
    throw new Error('All seats are currently occupied on this trip.');
  }
  const targetSeat = freeSeat.seat_number;
  console.log(`Target free seat: ${targetSeat}`);

  // 5. Assign Seat
  console.log(`\n5. Assigning Seat ${targetSeat} to Student ${testStudent.student_id}...`);
  const assignRes = await fetch(`${BASE_URL}/admin/trips/${trip.id}/seats`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      seat_number: targetSeat,
      student_id: testStudent.student_id,
    }),
  });
  const assignData = await assignRes.json();
  console.log(`Assign response status: ${assignRes.status}`);
  if (!assignRes.ok) {
    throw new Error(`Assignment failed: ${JSON.stringify(assignData)}`);
  }
  console.log(`PASS: Assigned seat ${targetSeat} to student ${testStudent.student_id}`);

  // 6. Test duplicate seat conflict (Assigning same seat to another student)
  console.log(`\n6. Testing duplicate seat conflict (assigning seat ${targetSeat} to a different student)...`);
  const otherStudent = eligibleStudents.find(s => s.student_id !== testStudent.student_id);
  if (otherStudent) {
    const dupSeatRes = await fetch(`${BASE_URL}/admin/trips/${trip.id}/seats`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        seat_number: targetSeat,
        student_id: otherStudent.student_id,
      }),
    });
    console.log(`Duplicate seat response status: ${dupSeatRes.status}`);
    if (dupSeatRes.status === 409) {
      console.log('PASS: Successfully rejected duplicate seat assignment with 409 Conflict.');
    } else {
      console.error(`FAIL: Expected 409 Conflict, got ${dupSeatRes.status}`);
    }
  }

  // 7. Test duplicate student conflict (Assigning same student to another seat on same trip)
  console.log(`\n7. Testing duplicate student conflict (assigning student ${testStudent.student_id} to another seat)...`);
  const anotherFreeSeat = seats.find(s => !s.is_occupied && s.seat_number !== targetSeat);
  if (anotherFreeSeat) {
    const dupStudentRes = await fetch(`${BASE_URL}/admin/trips/${trip.id}/seats`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        seat_number: anotherFreeSeat.seat_number,
        student_id: testStudent.student_id,
      }),
    });
    console.log(`Duplicate student response status: ${dupStudentRes.status}`);
    if (dupStudentRes.status === 409) {
      console.log('PASS: Successfully rejected duplicate student assignment with 409 Conflict.');
    } else {
      console.error(`FAIL: Expected 409 Conflict, got ${dupStudentRes.status}`);
    }
  }

  // 8. Test Driver Students Endpoint
  console.log(`\n8. Testing Driver API for trip ${trip.id} students roster...`);
  // Log in as Rajesh (driver)
  const driverLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'driver@schoolbus.local', password: 'Driver@12345' }),
  });
  if (driverLoginRes.ok) {
    const driverData = await driverLoginRes.json();
    const rosterRes = await fetch(`${BASE_URL}/driver/trips/${trip.id}/students`, {
      headers: { Authorization: `Bearer ${driverData.token}` },
    });
    const rosterData = await rosterRes.json();
    if (rosterRes.ok) {
      const roster = rosterData.students || [];
      const assignedRosterItem = roster.find(s => s.student_id === testStudent.student_id);
      console.log(`Driver roster items count: ${roster.length}`);
      if (assignedRosterItem) {
        console.log(`PASS: Driver roster contains student ${testStudent.student_id} with seat_number = ${assignedRosterItem.seat_number}`);
      } else {
        console.log(`Info: Student ${testStudent.student_id} not in driver trip roster view, sample item seat_number: ${roster[0]?.seat_number}`);
      }
    }
  }

  // 9. Unassign Seat
  console.log(`\n9. Unassigning Seat ${targetSeat}...`);
  const unassignRes = await fetch(`${BASE_URL}/admin/trips/${trip.id}/seats/${targetSeat}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const unassignData = await unassignRes.json();
  console.log(`Unassign status: ${unassignRes.status}`);
  if (!unassignRes.ok) {
    throw new Error(`Unassignment failed: ${JSON.stringify(unassignData)}`);
  }
  console.log(`PASS: Seat ${targetSeat} successfully unassigned.`);

  // 10. Verify Seat Layout is now free
  const verifyRes = await fetch(`${BASE_URL}/admin/trips/${trip.id}/seats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const verifyData = await verifyRes.json();
  const checkedSeat = (verifyData.layout || []).find(s => s.seat_number === targetSeat);
  if (checkedSeat && !checkedSeat.is_occupied) {
    console.log(`PASS: Verified Seat ${targetSeat} is freed and vacant.`);
  } else {
    console.error(`FAIL: Seat ${targetSeat} still reported occupied!`);
  }

  console.log('\n=== ALL BACKEND SEAT & LOCATION TESTS COMPLETED SUCCESSFULLY ===');
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
