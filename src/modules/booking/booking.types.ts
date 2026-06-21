export interface GetSlotsInput {
  serviceId: string;
  dentistId?: string;
  date: string;
}

export interface BookingRequestDto {
  serviceId: string;
  dentistId?: string;
  slot: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  notes?: string;
}

export interface SlotsResponseDto {
  slots: string[];
}

export interface BookingResult {
  bookingId: string;
  status: string;
  slot: string;
  serviceName?: string;
  dentistName?: string;
}
