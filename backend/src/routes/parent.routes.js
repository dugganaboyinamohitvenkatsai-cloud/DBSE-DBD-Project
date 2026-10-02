import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  listParents,
  getParent,
  createParent,
  updateParent,
  deleteParent,
  getAvailableStudents,
  linkStudent,
  unlinkStudent,
} from '../controllers/parent.controller.js';

export const parentRouter = Router();

// Specific routes before param routes
parentRouter.get('/available-students', authenticate, authorize('ADMIN'), getAvailableStudents);

parentRouter.get('/', authenticate, authorize('ADMIN'), listParents);
parentRouter.get('/:id', authenticate, authorize('ADMIN'), getParent);
parentRouter.post('/', authenticate, authorize('ADMIN'), createParent);
parentRouter.put('/:id', authenticate, authorize('ADMIN'), updateParent);
parentRouter.delete('/:id', authenticate, authorize('ADMIN'), deleteParent);

// Parent-Student linking routes
parentRouter.post('/:id/students', authenticate, authorize('ADMIN'), linkStudent);
parentRouter.delete('/:id/students/:studentId', authenticate, authorize('ADMIN'), unlinkStudent);
