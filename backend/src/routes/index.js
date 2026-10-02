import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { studentRouter } from './student.routes.js';
import { parentRouter } from './parent.routes.js';
import { driverRouter } from './driver.routes.js';
import { busRouter } from './bus.routes.js';
import { routeRouter } from './route.routes.js';
import { tripRouter } from './trip.routes.js';
import { driverTrackingRouter, tripTrackingRouter } from './tracking.routes.js';
import { parentDashboardRouter } from './parent-dashboard.routes.js';

import { pool } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { resolveLocation, searchLocation } from '../controllers/route.controller.js';

export const apiRouter = Router();
apiRouter.get('/health', (req, res) => res.json({ status: 'ok', service: 'school-bus-portal-api' }));

// GET /api/admin/overview - System overview metrics & recent trips
apiRouter.get(
  '/admin/overview',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const [[counts]] = await pool.execute(`
      SELECT
        (SELECT COUNT(*) FROM students) AS student_count,
        (SELECT COUNT(*) FROM parents) AS parent_count,
        (SELECT COUNT(*) FROM drivers d JOIN users u ON u.id = d.user_id WHERE u.is_active = TRUE) AS active_driver_count,
        (SELECT COUNT(*) FROM buses WHERE is_active = TRUE) AS active_bus_count,
        (SELECT COUNT(*) FROM routes WHERE is_active = TRUE) AS active_route_count,
        (SELECT COUNT(*) FROM trips WHERE status IN ('STARTED', 'IN_PROGRESS')) AS active_trip_count,
        (SELECT COUNT(*) FROM trips WHERE trip_date = CURDATE()) AS today_trip_count
    `);

    const [recentTrips] = await pool.execute(`
      SELECT 
        t.id, t.bus_id, t.route_id, t.direction, t.status, t.trip_date, t.scheduled_start_at,
        b.bus_number, r.name AS route_name, u.full_name AS driver_name
      FROM trips t
      JOIN buses b ON b.id = t.bus_id
      JOIN routes r ON r.id = t.route_id
      JOIN drivers d ON d.id = t.driver_id
      JOIN users u ON u.id = d.user_id
      ORDER BY t.id DESC
      LIMIT 5
    `);

    res.json({
      metrics: {
        students: Number(counts.student_count || 0),
        parents: Number(counts.parent_count || 0),
        drivers: Number(counts.active_driver_count || 0),
        buses: Number(counts.active_bus_count || 0),
        routes: Number(counts.active_route_count || 0),
        active_trips: Number(counts.active_trip_count || 0),
        today_trips: Number(counts.today_trip_count || 0),
      },
      recent_trips: recentTrips,
    });
  })
);
apiRouter.use('/auth', authRouter);
apiRouter.use('/admin/students', studentRouter);
apiRouter.use('/admin/parents', parentRouter);
apiRouter.use('/admin/drivers', driverRouter);
apiRouter.use('/admin/buses', busRouter);
apiRouter.use('/admin/routes', routeRouter);
apiRouter.post('/admin/stops/resolve-location', authenticate, authorize('ADMIN'), resolveLocation);
apiRouter.get('/admin/stops/search-location', authenticate, authorize('ADMIN'), searchLocation);
apiRouter.post('/admin/stops/search-location', authenticate, authorize('ADMIN'), searchLocation);
apiRouter.use('/admin/trips', tripRouter);
apiRouter.use('/driver', driverTrackingRouter);
apiRouter.use('/trips', tripTrackingRouter);
apiRouter.use('/parent', parentDashboardRouter);
