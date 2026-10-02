import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  listRoutes,
  getRoute,
  getRouteStops,
  createRoute,
  updateRoute,
  deleteRoute,
  createStop,
  updateStop,
  deleteStop,
  reorderStops,
  resolveLocation,
  searchLocation,
} from '../controllers/route.controller.js';

export const routeRouter = Router();

// All endpoints require ADMIN
routeRouter.use(authenticate, authorize('ADMIN'));

// Location Autocomplete / Search
routeRouter.get('/search-location', searchLocation);
routeRouter.post('/search-location', searchLocation);

// Google Maps URL coordinate resolution
routeRouter.post('/resolve-location', resolveLocation);
routeRouter.post('/stops/resolve-location', resolveLocation);

// Route CRUD
routeRouter.get('/', listRoutes);
routeRouter.post('/', createRoute);
routeRouter.get('/:id', getRoute);
routeRouter.put('/:id', updateRoute);
routeRouter.delete('/:id', deleteRoute);

// Stop Management under Route
routeRouter.get('/:id/stops', getRouteStops);
routeRouter.post('/:id/stops', createStop);
// Note: reorder route MUST be before /:id/stops/:stopId
routeRouter.put('/:id/stops/reorder', reorderStops);
routeRouter.put('/:id/stops/:stopId', updateStop);
routeRouter.delete('/:id/stops/:stopId', deleteStop);
