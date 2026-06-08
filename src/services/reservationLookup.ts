/**
 * Public reservation lookup service.
 * Future endpoint: POST /public/reservations/lookup
 */

import { MOCK_RESERVATIONS } from '@/data/mock-data';
import { PROPERTY } from '@/config/constants';
import type { Reservation } from '@/types';

export interface ReservationLookupResult {
  confirmationNumber: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  roomType: string;
  status: Reservation['status'];
  paymentStatus: Reservation['paymentStatus'];
  totalAmount: number;
  propertyPhone: string;
  propertyEmail: string;
}

const delay = (ms = 800) => new Promise(r => setTimeout(r, ms));

export async function getReservationByConfirmation(
  confirmationNumber: string,
  lastName: string,
): Promise<ReservationLookupResult | null> {
  await delay();

  const res = MOCK_RESERVATIONS.find(
    r =>
      r.confirmationNumber.toLowerCase() === confirmationNumber.trim().toLowerCase() &&
      r.guest.lastName.toLowerCase() === lastName.trim().toLowerCase(),
  );

  if (!res) return null;

  return {
    confirmationNumber: res.confirmationNumber,
    guestName: `${res.guest.firstName} ${res.guest.lastName}`,
    checkIn: res.checkIn,
    checkOut: res.checkOut,
    guests: res.guests,
    roomType: res.roomTypeName,
    status: res.status,
    paymentStatus: res.paymentStatus,
    totalAmount: res.totalAmount,
    propertyPhone: PROPERTY.phone,
    propertyEmail: PROPERTY.email,
  };
}
