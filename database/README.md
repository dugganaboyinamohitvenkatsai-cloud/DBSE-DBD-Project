# Database Architecture & Relational Schema Specification

## Overview

The **School Bus Tracking & Student Safety Portal** data tier is powered by **MySQL Community Server 8.0** running the **InnoDB** storage engine. The database enforces ACID transactional guarantees, foreign key cascading referential integrity, and composite unique constraints directly in B+ Tree indexes to guarantee seating and custodial invariants.

---

## Relational Entity Model (14 Tables)

| Table Name | Primary Purpose | Key Constraints / Indexes |
| :--- | :--- | :--- |
| `users` | Core user identity, role (`ADMIN`, `PARENT`, `DRIVER`), and bcrypt password hashes. | `UNIQUE(email)` |
| `parents` | Guardian contact details, addresses, and emergency telephone numbers. | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `drivers` | Commercial bus driver records, employee codes, and license validation. | `UNIQUE(employee_code)`, `UNIQUE(license_number)` |
| `buses` | Fleet vehicle assets, registration plates, and seating capacities (e.g. 55 seats). | `UNIQUE(bus_number)`, `UNIQUE(registration_number)` |
| `routes` | Named transit corridors with codes and estimated journey durations. | `UNIQUE(route_code)` |
| `stops` | Ordered geographical waypoints with WGS84 coordinates and 100m geofence radii. | `UNIQUE(route_id, stop_order)` |
| `students` | Enrolled pupils bound to designated pickup/dropoff stops and parents. | `UNIQUE(admission_number)` |
| `parent_students` | Multi-guardian to student junction supporting flexible custody relations. | `UNIQUE(parent_id, student_id)` |
| `trips` | Daily scheduled bus transit runs binding driver, vehicle, route, and shift. | `INDEX(trip_date, status)` |
| `student_transport_status` | Real-time passenger roster lifecycle (`WAITING`, `BOARDED`, `DROPPED_OFF`). | `UNIQUE(trip_id, student_id)` |
| `bus_locations` | High-frequency GPS telemetry stream ingested from driver mobile devices. | `INDEX(bus_id, recorded_at DESC)` |
| `seat_assignments` | Visual passenger seat allocation preventing duplicate bookings. | `UNIQUE(trip_id, seat_number)`, `UNIQUE(trip_id, student_id)` |
| `notifications` | Persistent parent alert history and in-app message inbox. | `INDEX(user_id, is_read, created_at DESC)` |
| `device_tokens` | FCM multicast push tokens for native mobile notification delivery. | `UNIQUE(token)` |

---

## Critical Invariant Enforcement

### Seating Invariants
- `CONSTRAINT uq_trip_seat UNIQUE (trip_id, seat_number)`: Enforces that within any active trip, a specific physical seat is allocated to at most one student.
- `CONSTRAINT uq_trip_student UNIQUE (trip_id, student_id)`: Enforces that an individual student cannot occupy multiple seats on the same trip.
- Concurrent allocation attempts that conflict trigger MySQL Error 1062, translated into HTTP 409 Conflict at the API layer.

---

## Database Migration & Setup

To apply the complete database schema and demo seeds:

```bash
# Apply schema and initial seeds using the backend migration pipeline:
cd backend
npm run db:migrate
npm run db:seed
```

Or execute directly via MySQL client:

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```
