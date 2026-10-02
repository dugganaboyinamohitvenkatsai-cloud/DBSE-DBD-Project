import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  updateStudentTransportStatus,
  getStudentTransport,
} from '../controllers/student.controller.js';

export const studentRouter = Router();

studentRouter.get('/', authenticate, authorize('ADMIN'), listStudents);
studentRouter.get('/:id', authenticate, authorize('ADMIN'), getStudent);
studentRouter.get('/:id/transport-status', authenticate, authorize('ADMIN', 'DRIVER'), getStudentTransport);
studentRouter.post('/', authenticate, authorize('ADMIN'), createStudent);
studentRouter.put('/:id', authenticate, authorize('ADMIN'), updateStudent);
studentRouter.delete('/:id', authenticate, authorize('ADMIN'), deleteStudent);
studentRouter.put('/:id/transport-status', authenticate, authorize('ADMIN', 'DRIVER'), updateStudentTransportStatus);
