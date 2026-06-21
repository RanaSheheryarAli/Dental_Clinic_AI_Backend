export interface VoiceGetSlotsRequest {
  serviceName?: string;
  serviceId?: string;
  dentistName?: string;
  dentistId?: string;
  date: string;
}

export interface VoiceCreateBookingRequest {
  serviceName?: string;
  serviceId?: string;
  dentistName?: string;
  dentistId?: string;
  slot: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  notes?: string;
}

export interface VoiceWebhookPayload {
  callId?: string;
  transcript?: string;
}
