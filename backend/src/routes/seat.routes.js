import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getTripSeats,
  assignTripSeat,
  unassignTripSeat,
} from '../controllers/seat.controller.js';

export const seatRouter = Router({ mergeParams: true });

// Admin authorization required for managing seat assignments
seatRouter.use(authenticate, authorize('ADMIN'));

seatRouter.get('/', getTripSeats);
seatRouter.post('/', assignTripSeat);
seatRouter.delete('/:seatNumber', unassignTripSeat);
