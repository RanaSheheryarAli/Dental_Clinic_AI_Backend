import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler.js';
import { clinicController } from './clinic.controller.js';

const clinicRouter = Router();

clinicRouter.get('/info', asyncHandler((req, res) => clinicController.getInfo(req, res)));
clinicRouter.get('/services', asyncHandler((req, res) => clinicController.getServices(req, res)));
clinicRouter.get('/dentists', asyncHandler((req, res) => clinicController.getDentists(req, res)));

export { clinicRouter };
