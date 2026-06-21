import { prisma } from '../../config/db.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { ClinicInfoDto, DentistDto, ServiceDto } from './clinic.types.js';

function serviceToDto(service: {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  price: { toNumber(): number };
  calEventTypeId: number | null;
}): ServiceDto {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    durationMin: service.durationMin,
    price: service.price.toNumber(),
    calEventTypeId: service.calEventTypeId
  };
}

export class ClinicService {
  async getClinicInfo(): Promise<ClinicInfoDto> {
    const clinic = await prisma.clinic.findFirst();

    if (!clinic) {
      throw new AppError('CLINIC_NOT_FOUND', 'Clinic information is not available.', 404);
    }

    return clinic;
  }

  async getServices(): Promise<ServiceDto[]> {
    const services = await prisma.service.findMany({
      orderBy: {
        name: 'asc'
      }
    });

    return services.map(serviceToDto);
  }

  async getDentists(): Promise<DentistDto[]> {
    return prisma.dentist.findMany({
      orderBy: {
        name: 'asc'
      }
    });
  }
}

export const clinicService = new ClinicService();
