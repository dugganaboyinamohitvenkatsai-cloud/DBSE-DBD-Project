import { pool } from '../src/config/database.js';

const BASE_URL = 'http://localhost:5000/api';

let adminToken = '';
let testRouteId = null;
let testStopId = null;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function loginAdmin() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@schoolbus.local',
      password: 'Admin@12345',
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(`Admin login failed: ${data.message || res.statusText}`);
  }
  adminToken = data.token;
  console.log('Admin login successful.');
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING GOOGLE MAPS LINK RESOLVER & STOP TESTS');
  console.log('====================================================\n');

  await loginAdmin();

  // Test 1: Valid Google Maps coordinate URL
  console.log('\n--- Test 1: Valid Google Maps coordinate URL ---');
  {
    const res = await fetch(`${BASE_URL}/admin/routes/resolve-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        url: 'https://www.google.com/maps/@17.450821,78.357821,17z',
      }),
    });
    const data = await res.json();
    assert(res.status === 200, `Status is 200 (got ${res.status})`);
    assert(data.success === true, 'Success flag is true');
    assert(Math.abs(data.latitude - 17.450821) < 0.0001, `Latitude parsed correctly: ${data.latitude}`);
    assert(Math.abs(data.longitude - 78.357821) < 0.0001, `Longitude parsed correctly: ${data.longitude}`);
  }

  // Also test alias endpoint /admin/stops/resolve-location
  {
    const res = await fetch(`${BASE_URL}/admin/stops/resolve-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        url: 'https://www.google.com/maps/@17.450821,78.357821,17z',
      }),
    });
    const data = await res.json();
    assert(res.status === 200, `/admin/stops/resolve-location alias works (status ${res.status})`);
    assert(data.success === true, 'Alias success flag is true');
  }

  // Test 2: Valid Google Maps place/search URLs
  console.log('\n--- Test 2: Valid Google Maps place/search URLs ---');
  {
    // 2a. Place URL with @coordinates
    const resPlace = await fetch(`${BASE_URL}/admin/routes/resolve-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        url: 'https://www.google.com/maps/place/Kondapur,+Hyderabad/@17.4699,78.3578,15z',
      }),
    });
    const dataPlace = await resPlace.json();
    assert(resPlace.status === 200, `Place URL status is 200`);
    assert(Math.abs(dataPlace.latitude - 17.4699) < 0.0001, `Place latitude is 17.4699 (got ${dataPlace.latitude})`);
    assert(Math.abs(dataPlace.longitude - 78.3578) < 0.0001, `Place longitude is 78.3578 (got ${dataPlace.longitude})`);

    // 2b. Query param URL (?q=lat,lng)
    const resQuery = await fetch(`${BASE_URL}/admin/routes/resolve-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        url: 'https://maps.google.com/?q=17.450821,78.357821',
      }),
    });
    const dataQuery = await resQuery.json();
    assert(resQuery.status === 200, `Query param ?q= URL status is 200`);
    assert(Math.abs(dataQuery.latitude - 17.450821) < 0.0001, `Query latitude is 17.450821`);

    // 2c. Query param URL (?ll=lat,lng)
    const resLl = await fetch(`${BASE_URL}/admin/routes/resolve-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        url: 'https://maps.google.com/?ll=17.450821,78.357821',
      }),
    });
    const dataLl = await resLl.json();
    assert(resLl.status === 200, `Query param ?ll= URL status is 200`);
    assert(Math.abs(dataLl.latitude - 17.450821) < 0.0001, `Query ?ll latitude is 17.450821`);

    // 2d. Place data parameter URL (!3d and !4d)
    const resData = await fetch(`${BASE_URL}/admin/routes/resolve-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        url: 'https://www.google.com/maps/place/Charminar/data=!4m6!3m5!1s0x3bcb978a0c217215:0x5e08b1a8f6d63428!8m2!3d17.3615636!4d78.4746645!16z',
      }),
    });
    const dataCoord = await resData.json();
    assert(resData.status === 200, `Data param !3d!4d URL status is 200`);
    assert(Math.abs(dataCoord.latitude - 17.3615636) < 0.0001, `Data latitude is 17.3615636`);
    assert(Math.abs(dataCoord.longitude - 78.4746645) < 0.0001, `Data longitude is 78.4746645`);
  }

  // Test 3: Invalid Google Maps URL & SSRF prevention
  console.log('\n--- Test 3: Invalid Google Maps URL & SSRF prevention ---');
  {
    const expectedErrorMsg = 'Unable to resolve this Google Maps location. Please check the link or enter coordinates manually.';

    // 3a. Untrusted domain (SSRF attempt)
    const resEvil = await fetch(`${BASE_URL}/admin/routes/resolve-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        url: 'https://attacker.com/maps/@17.45,78.35',
      }),
    });
    const dataEvil = await resEvil.json();
    assert(resEvil.status === 400, `Untrusted domain returns 400 (got ${resEvil.status})`);
    assert(dataEvil.message === expectedErrorMsg, `Returns required error message on untrusted domain`);

    // 3b. Internal IP address (SSRF attempt)
    const resSsrf = await fetch(`${BASE_URL}/admin/routes/resolve-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        url: 'http://169.254.169.254/latest/meta-data/',
      }),
    });
    const dataSsrf = await resSsrf.json();
    assert(resSsrf.status === 400, `Internal IP returns 400 (got ${resSsrf.status})`);
    assert(dataSsrf.message === expectedErrorMsg, `Returns required error message on SSRF IP`);

    // 3c. Malformed string
    const resMalformed = await fetch(`${BASE_URL}/admin/routes/resolve-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        url: 'not a valid url at all',
      }),
    });
    const dataMalformed = await resMalformed.json();
    assert(resMalformed.status === 400, `Malformed string returns 400 (got ${resMalformed.status})`);
    assert(dataMalformed.message === expectedErrorMsg, `Returns required error message on malformed string`);
  }

  // Test 4: Unresolvable location
  console.log('\n--- Test 4: Unresolvable location ---');
  {
    const expectedErrorMsg = 'Unable to resolve this Google Maps location. Please check the link or enter coordinates manually.';

    const resUnresolvable = await fetch(`${BASE_URL}/admin/routes/resolve-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        url: 'https://www.google.com/maps/about/',
      }),
    });
    const dataUnresolvable = await resUnresolvable.json();
    assert(resUnresolvable.status === 400, `Unresolvable location returns 400 (got ${resUnresolvable.status})`);
    assert(dataUnresolvable.message === expectedErrorMsg, `Returns exact required error message`);
  }

  // Test 5: Valid manual latitude/longitude fallback & Stop saving
  console.log('\n--- Test 5: Valid manual latitude/longitude fallback & Stop saving ---');
  {
    // Find an active route to test stop creation
    const [routes] = await pool.execute('SELECT id FROM routes WHERE is_active = 1 LIMIT 1');
    assert(routes.length > 0, 'Found at least 1 route for testing stop management');
    testRouteId = routes[0].id;

    // Create a stop with manual coordinates and google_maps_url
    const createRes = await fetch(`${BASE_URL}/admin/routes/${testRouteId}/stops`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Test QA Resolved Stop',
        latitude: 17.456789,
        longitude: 78.345678,
        scheduled_time: '08:15',
        google_maps_url: 'https://www.google.com/maps/@17.456789,78.345678,17z',
      }),
    });
    const createData = await createRes.json();
    assert(createRes.status === 201, `Stop created successfully with manual fallback coords (status ${createRes.status})`);
    assert(createData.stop && createData.stop.id, 'Stop object returned with ID');
    testStopId = createData.stop.id;

    assert(Math.abs(createData.stop.latitude - 17.456789) < 0.0001, `Stop latitude matches manual input: ${createData.stop.latitude}`);
    assert(Math.abs(createData.stop.longitude - 78.345678) < 0.0001, `Stop longitude matches manual input: ${createData.stop.longitude}`);
    assert(createData.stop.google_maps_url === 'https://www.google.com/maps/@17.456789,78.345678,17z', 'Stop stored google_maps_url metadata');

    // Update stop with another manual coordinate
    const updateRes = await fetch(`${BASE_URL}/admin/routes/${testRouteId}/stops/${testStopId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Test QA Resolved Stop Updated',
        latitude: 17.459999,
        longitude: 78.349999,
        google_maps_url: 'https://maps.google.com/?q=17.459999,78.349999',
      }),
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200, `Stop updated successfully (status ${updateRes.status})`);
    assert(Math.abs(updateData.stop.latitude - 17.459999) < 0.0001, `Updated latitude is 17.459999`);
    assert(Math.abs(updateData.stop.longitude - 78.349999) < 0.0001, `Updated longitude is 78.349999`);

    // Clean up test stop
    const delRes = await fetch(`${BASE_URL}/admin/routes/${testRouteId}/stops/${testStopId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert(delRes.status === 200, 'Cleaned up test stop');
  }

  // Test 6: Invalid latitude/longitude rejection
  console.log('\n--- Test 6: Invalid latitude/longitude rejection ---');
  {
    const badLatRes = await fetch(`${BASE_URL}/admin/routes/${testRouteId}/stops`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Bad Lat Stop',
        latitude: 95.0, // Invalid > 90
        longitude: 78.34,
      }),
    });
    assert(badLatRes.status === 400, `Latitude 95.0 rejected with 400 (got ${badLatRes.status})`);

    const badLngRes = await fetch(`${BASE_URL}/admin/routes/${testRouteId}/stops`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Bad Lng Stop',
        latitude: 17.34,
        longitude: 200.0, // Invalid > 180
      }),
    });
    assert(badLngRes.status === 400, `Longitude 200.0 rejected with 400 (got ${badLngRes.status})`);
  }

  // Test 7: Existing stops with coordinates remain unchanged
  console.log('\n--- Test 7: Existing stops with coordinates remain unchanged ---');
  {
    const [stops35] = await pool.execute(
      'SELECT id, name, stop_order, latitude, longitude FROM stops WHERE route_id = 35 ORDER BY stop_order ASC'
    );
    assert(stops35.length === 10, `Route 35 has all 10 stops intact (found ${stops35.length})`);
    const validCoords = stops35.every(s => s.latitude !== null && s.longitude !== null && s.latitude > 17 && s.longitude > 78);
    assert(validCoords, 'All 10 stops on Route 35 have valid, accurate Hyderabad coordinates');

    const [stops10] = await pool.execute(
      'SELECT id, name, stop_order, latitude, longitude FROM stops WHERE route_id = 10 ORDER BY stop_order ASC'
    );
    assert(stops10.length === 5, `Route 10 has all 5 stops intact (found ${stops10.length})`);
  }

  // Test 8: Security & Role authorization
  console.log('\n--- Test 8: Security & Role authorization ---');
  {
    const unauthRes = await fetch(`${BASE_URL}/admin/routes/resolve-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.google.com/maps/@17.45,78.35' }),
    });
    assert(unauthRes.status === 401, `Unauthenticated request returns 401 (got ${unauthRes.status})`);
  }

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('====================================================');

  await pool.end();
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(async (err) => {
  console.error('Test execution error:', err);
  await pool.end();
  process.exit(1);
});
