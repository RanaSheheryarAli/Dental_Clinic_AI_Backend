export type ClinicInfoDto = {
  id: string;
  name: string;
  about: string;
  mission?: string | null;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  mapUrl?: string | null;
  hours: unknown;
};

export interface ServiceDto {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  price: number;
  calEventTypeId?: number | null;
}

export interface DentistDto {
  id: string;
  name: string;
  specialty: string;
  bio?: string | null;
  photoUrl?: string | null;
  calUserId?: number | null;
}
