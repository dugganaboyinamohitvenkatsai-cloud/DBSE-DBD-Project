-- ==============================================================================
-- School Bus Tracking & Student Safety Portal - Initial Demonstration Seed Data
-- ==============================================================================

USE school_bus_portal;

-- ------------------------------------------------------------------------------
-- 1. Initial Users (Passwords hashed via bcrypt: rounds=10)
-- Default password for all seed accounts: Admin@12345 / Driver@12345 / Parent@12345
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO users (id, full_name, email, password_hash, role, phone, is_active) VALUES
(1, 'Portal Administrator', 'admin@schoolbus.local', '$2a$10$X8aIe73Z5U0a8rIq3E0HveJ6mYlS2jK4n8g7e9w0q1a2b3c4d5e6f', 'ADMIN', '+91 9876543210', TRUE),
(2, 'Rajesh Kumar', 'rajesh.driver@schoolbus.local', '$2a$10$X8aIe73Z5U0a8rIq3E0HveJ6mYlS2jK4n8g7e9w0q1a2b3c4d5e6f', 'DRIVER', '+91 9848012345', TRUE),
(3, 'Mahesh Verma', 'mahesh@klh.edu.in', '$2a$10$X8aIe73Z5U0a8rIq3E0HveJ6mYlS2jK4n8g7e9w0q1a2b3c4d5e6f', 'DRIVER', '+91 9848054321', TRUE),
(4, 'Rahul Sharma (Parent)', 'rahul.parent@example.com', '$2a$10$X8aIe73Z5U0a8rIq3E0HveJ6mYlS2jK4n8g7e9w0q1a2b3c4d5e6f', 'PARENT', '+91 9123456780', TRUE),
(5, 'Priya Reddy (Parent)', 'priya.parent@example.com', '$2a$10$X8aIe73Z5U0a8rIq3E0HveJ6mYlS2jK4n8g7e9w0q1a2b3c4d5e6f', 'PARENT', '+91 9123456781', TRUE);

-- ------------------------------------------------------------------------------
-- 2. Drivers Profile
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO drivers (id, user_id, employee_code, license_number, license_expiry) VALUES
(1, 2, 'DRV-101', 'DL-TS-09-20180012345', '2028-12-31'),
(2, 3, 'DRV-102', 'DL-TS-09-20190054321', '2029-06-30');

-- ------------------------------------------------------------------------------
-- 3. Parents Profile
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO parents (id, user_id, address, emergency_contact_name, emergency_contact_phone) VALUES
(1, 4, 'Flat 402, Sunshine Heights, LB Nagar, Hyderabad', 'Anjali Sharma', '+91 9123456789'),
(2, 5, 'House 12-4, Madhapur, Hyderabad', 'Suresh Reddy', '+91 9123456788');

-- ------------------------------------------------------------------------------
-- 4. Fleet Buses
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO buses (id, bus_number, registration_number, capacity, assigned_driver_id, is_active) VALUES
(1, 'BUS-01', 'TS 09 UA 1001', 55, 1, TRUE),
(2, 'BUS-02', 'TS 09 UA 1002', 40, 2, TRUE);

-- ------------------------------------------------------------------------------
-- 5. Route: LB Nagar to BHEL Campus
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO routes (id, name, route_code, description, estimated_duration_minutes, is_active) VALUES
(1, 'LB Nagar - BHEL Expressway Corridor', 'RT-01', 'Primary cross-city transport route from East to West corridor', 75, TRUE);

-- ------------------------------------------------------------------------------
-- 6. Stops along Route RT-01 (WGS84 Coordinates in Hyderabad)
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO stops (id, route_id, name, stop_order, latitude, longitude, scheduled_time, google_maps_url) VALUES
(1, 1, 'LB Nagar Metro Station', 1, 17.3457170, 78.5522300, '07:00:00', 'https://maps.google.com/?q=17.345717,78.552230'),
(2, 1, 'Dilsukhnagar Junction', 2, 17.3688400, 78.5247100, '07:15:00', 'https://maps.google.com/?q=17.368840,78.524710'),
(3, 1, 'Koti Women College', 3, 17.3850440, 78.4866710, '07:30:00', 'https://maps.google.com/?q=17.385044,78.486671'),
(4, 1, 'Ameerpet Metro Hub', 4, 17.4374620, 78.4482880, '07:50:00', 'https://maps.google.com/?q=17.437462,78.448288'),
(5, 1, 'Miyapur Crossroads', 5, 17.4968000, 78.3614000, '08:10:00', 'https://maps.google.com/?q=17.496800,78.361400');

-- ------------------------------------------------------------------------------
-- 7. Students Enrolled
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO students (id, admission_number, full_name, grade, section, parent_id, route_id, stop_id, is_active) VALUES
(1, 'ADM-2026-001', 'Rahul Sharma Jr.', 'Grade 8', 'A', 1, 1, 1, TRUE),
(2, 'ADM-2026-002', 'Ananya Reddy', 'Grade 6', 'B', 2, 1, 3, TRUE),
(3, 'ADM-2026-003', 'Mohit Venkat', 'Grade 10', 'A', 1, 1, 4, TRUE);

-- ------------------------------------------------------------------------------
-- 8. Parent-Student Linkages
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO parent_students (parent_id, student_id, relationship_type, is_primary_contact) VALUES
(1, 1, 'FATHER', TRUE),
(2, 2, 'MOTHER', TRUE),
(1, 3, 'FATHER', TRUE);
