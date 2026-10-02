# Architectural & System Modeling Diagrams

This directory organizes the formal architectural diagrams and data models illustrating the design of the **School Bus Tracking & Student Safety Portal**.

---

## Directory Organization

### 1. [`architecture/`](architecture/)
- **[`fig1_system_architecture.png`](architecture/fig1_system_architecture.png)**: Comprehensive Three-Tier System Architecture Diagram illustrating Presentation (Admin SPA, Driver App, Parent App), Application Logic (Node.js/Express REST API, Haversine, OSRM, FCM), and Data Persistence (MySQL 8.0 InnoDB).

### 2. [`database/`](database/)
- **[`fig6_er_diagram.png`](database/fig6_er_diagram.png)**: Complete Entity-Relationship (ER) Diagram displaying all 14 relational tables, primary keys, foreign keys, cardinality, and composite unique constraints (`uq_trip_seat`, `uq_trip_student`).

### 3. [`dfd/`](dfd/)
- **[`fig8_dfd_diagram.png`](dfd/fig8_dfd_diagram.png)**: Multi-Level Data Flow Diagram (DFD) showing external entities, core data transformations, and persistent storage interaction.

### 4. [`use-case/`](use-case/)
- **[`fig7_use_case.png`](use-case/fig7_use_case.png)**: Comprehensive Actor Use Case Diagram showing functional boundaries for Transportation Administrators, Bus Drivers, and Student Guardians.

### 5. [`sequence/`](sequence/)
- **[`fig2_admin_flow.png`](sequence/fig2_admin_flow.png)**: Administrative Shift Scheduling & Fleet Assignment Sequence Flow.
- **[`fig3_gps_flow.png`](sequence/fig3_gps_flow.png)**: Driver Mobile GPS Acquisition, Telemetry Buffer, and Server Ingestion Flow.
- **[`fig4_routing_pipeline.png`](sequence/fig4_routing_pipeline.png)**: OSRM Road-Following Route Geometry Fetching & In-Memory Caching Flow.
- **[`fig5_notification_pipeline.png`](sequence/fig5_notification_pipeline.png)**: Proximity Haversine Geofence Arrival & FCM Multicast Push Flow.
- **[`fig9_auth_flow.png`](sequence/fig9_auth_flow.png)**: JWT Authentication & Role-Based Access Control (RBAC) Verification Flow.
- **[`fig10_seat_flow.png`](sequence/fig10_seat_flow.png)**: Interactive Seat Assignment Matrix & Collision Invariant Rejection Sequence Flow.
