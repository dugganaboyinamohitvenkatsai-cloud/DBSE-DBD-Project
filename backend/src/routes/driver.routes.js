import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  listDrivers,
  getDriver,
  createDriver,
  updateDriver,
  deleteDriver,
} from '../controllers/driver.controller.js';

export const driverRouter = Router();

driverRouter.get('/', authenticate, authorize('ADMIN'), listDrivers);
driverRouter.get('/:id', authenticate, authorize('ADMIN'), getDriver);
driverRouter.post('/', authenticate, authorize('ADMIN'), createDriver);
driverRouter.put('/:id', authenticate, authorize('ADMIN'), updateDriver);
driverRouter.delete('/:id', authenticate, authorize('ADMIN'), deleteDriver);
