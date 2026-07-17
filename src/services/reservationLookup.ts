import type { Reservation } from '@/types';
import { apiBlobRequest, apiRequest, jsonBody } from './client';

export interface ReservationLookupRoomLine {
  roomTypeId: string;
  roomTypeName: string;
  roomSlug: string;
  rooms: number;
  subtotalAmount: number;
}

export interface ReservationLookupResult {
  confirmationNumber: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  roomType: string;
  roomLines: ReservationLookupRoomLine[];
  status: Reservation['status'];
  paymentStatus: Reservation['paymentStatus'];
  totalAmount: number;
  propertyPhone: string;
  propertyEmail: string;
}

export async function getReservationByConfirmation(
  confirmationNumber: string,
  lastName: string,
): Promise<ReservationLookupResult | null> {
  return apiRequest<ReservationLookupResult | null>('/reservations/lookup', jsonBody({ confirmationNumber, lastName }));
}

export async function sendReservationConfirmationEmail(input: {
  confirmationNumber: string;
  lastName: string;
  email: string;
}): Promise<{ ok: true; message: string }> {
  return apiRequest('/reservations/confirmation-email', jsonBody(input));
}

export async function downloadReservationConfirmationPdf(input: {
  confirmationNumber: string;
  lastName: string;
}): Promise<Blob> {
  return apiBlobRequest('/reservations/confirmation-pdf', jsonBody(input));
}
