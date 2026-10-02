import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  listBuses,
  getAvailableDrivers,
  getBus,
  createBus,
  updateBus,
  deleteBus,
} from '../controllers/bus.controller.js';

export const busRouter = Router();

// Available drivers route before param route
busRouter.get('/available-drivers', authenticate, authorize('ADMIN'), getAvailableDrivers);

busRouter.get('/', authenticate, authorize('ADMIN'), listBuses);
busRouter.get('/:id', authenticate, authorize('ADMIN'), getBus);
busRouter.post('/', authenticate, authorize('ADMIN'), createBus);
busRouter.put('/:id', authenticate, authorize('ADMIN'), updateBus);
busRouter.delete('/:id', authenticate, authorize('ADMIN'), deleteBus);
