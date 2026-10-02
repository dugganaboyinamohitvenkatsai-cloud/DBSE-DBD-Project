import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  updateDriverLocation,
  getDriverActiveTrip,
  listDriverTrips,
  startDriverTrip,
  completeDriverTrip,
  getDriverTripStudents,
  getTripJourney,
  getAdminTripLocation,
} from '../controllers/tracking.controller.js';

export const driverTrackingRouter = Router();
export const tripTrackingRouter = Router();

// ─── Driver Location & Trip Management Routes ────────────────────────────────
// POST /api/driver/location - Send GPS updates (DRIVER or ADMIN)
driverTrackingRouter.post(
  '/location',
  authenticate,
  authorize('DRIVER', 'ADMIN'),
  updateDriverLocation
);

// GET /api/driver/active-trip - Get driver's active trip and route stops
driverTrackingRouter.get(
  '/active-trip',
  authenticate,
  authorize('DRIVER', 'ADMIN'),
  getDriverActiveTrip
);

// GET /api/driver/trips - Get all assigned trips for this driver
driverTrackingRouter.get(
  '/trips',
  authenticate,
  authorize('DRIVER', 'ADMIN'),
  listDriverTrips
);

// POST /api/driver/trips/:id/start - Driver starts their assigned trip
driverTrackingRouter.post(
  '/trips/:id/start',
  authenticate,
  authorize('DRIVER', 'ADMIN'),
  startDriverTrip
);

// POST /api/driver/trips/:id/complete - Driver completes their assigned trip
driverTrackingRouter.post(
  '/trips/:id/complete',
  authenticate,
  authorize('DRIVER', 'ADMIN'),
  completeDriverTrip
);

// GET /api/driver/trips/:id/students - Get students enrolled on this trip
driverTrackingRouter.get(
  '/trips/:id/students',
  authenticate,
  authorize('DRIVER', 'ADMIN'),
  getDriverTripStudents
);

// ─── Trip Tracking & Journey Routes ──────────────────────────────────────────
// GET /api/trips/:tripId/journey - RedBus-style live journey progression (ADMIN, DRIVER, PARENT)
tripTrackingRouter.get(
  '/:tripId/journey',
  authenticate,
  authorize('ADMIN', 'DRIVER', 'PARENT'),
  getTripJourney
);

// GET /api/admin/trips/:id/location - Admin current location telemetry
tripTrackingRouter.get(
  '/admin/:id/location',
  authenticate,
  authorize('ADMIN'),
  getAdminTripLocation
);
