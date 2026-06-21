import type { Request, Response } from 'express';
import { createSuccessResponse } from '../../shared/types/api-response.js';
import { clinicService } from './clinic.service.js';

export class ClinicController {
  async getInfo(_req: Request, res: Response) {
    const clinic = await clinicService.getClinicInfo();
    res.json(createSuccessResponse(clinic));
  }

  async getServices(_req: Request, res: Response) {
    const services = await clinicService.getServices();
    res.json(createSuccessResponse(services));
  }

  async getDentists(_req: Request, res: Response) {
    const dentists = await clinicService.getDentists();
    res.json(createSuccessResponse(dentists));
  }
}

export const clinicController = new ClinicController();
