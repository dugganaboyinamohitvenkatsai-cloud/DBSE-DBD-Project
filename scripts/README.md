# Verification & Testing Scripts Suite

This directory contains standalone integration tests, end-to-end scenario verifications, and diagnostics suites for the **School Bus Tracking & Student Safety Portal**.

---

## Prerequisites

1. Ensure the MySQL database is running and migrated (`npm run db:migrate`).
2. Ensure the backend REST API is running (`cd backend && npm start`) on port 5000.

---

## Test Scripts Directory

| Test Script | Focus Area & Coverage | Execution Command |
| :--- | :--- | :--- |
| **`test-seat-and-location.mjs`** | Admin authentication, visual bus seat matrix allocation, duplicate seat/student collision prevention (HTTP 409), seat deallocation, and Nominatim geocoding. | `node scripts/test-seat-and-location.mjs` |
| **`test-parent-seat-integration.mjs`** | Parent login, student registration linkage, seat assignment visibility, and child transit state in parent dashboard. | `node scripts/test-parent-seat-integration.mjs` |
| **`test-fcm-backend.mjs`** | 13-test suite verifying FCM device token registration, unregistration, idempotency (`ON DUPLICATE KEY UPDATE`), role-based authorization, and tenant isolation. | `node scripts/test-fcm-backend.mjs` |
| **`test-live-map-pipeline.mjs`** | Live GPS telemetry ingestion from driver, OSRM road geometry fetching/caching, real-time stop proximity detection, and parent map view synchronization. | `node scripts/test-live-map-pipeline.mjs` |
| **`test-driver-endpoints.mjs`** | Driver authentication, assigned shift retrieval, student attendance roster updates, and trip lifecycle transitions. | `node scripts/test-driver-endpoints.mjs` |
| **`test-parent.mjs`** | Parent authentication, multi-child switching, notification retrieval, and profile management. | `node scripts/test-parent.mjs` |
| **`verify-e2e-scenario.mjs`** | Comprehensive end-to-end workflow tracing a complete student commute from trip scheduling to dropoff. | `node scripts/verify-e2e-scenario.mjs` |
| **`check-db-state.mjs`** | Quick diagnostic inspection of registered drivers and active shifts in the database. | `node scripts/check-db-state.mjs` |
| **`reset-demo.mjs`** | Resets demonstration trips, student transport statuses, and temporary test telemetry. | `node scripts/reset-demo.mjs` |

---

## Automated Suite Execution

To run all primary test suites sequentially:

```bash
# From repository root:
node scripts/test-seat-and-location.mjs
node scripts/test-parent-seat-integration.mjs
node scripts/test-fcm-backend.mjs
node scripts/test-live-map-pipeline.mjs
```
