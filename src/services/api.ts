import type {
  AvailabilitySearch,
  AvailabilityResult,
  RoomType,
  Reservation,
  Payment,
  DashboardStats,
  BookingFormData,
  RoomRateRule,
  PromoCode,
  AuditLog,
} from '@/types';
import { apiRequest, jsonBody } from './client';

export async function searchAvailability(search: AvailabilitySearch): Promise<AvailabilityResult[]> {
  return apiRequest<AvailabilityResult[]>('/availability/search', jsonBody(search));
}

export async function getRoomTypes(): Promise<RoomType[]> {
  return apiRequest<RoomType[]>('/rooms');
}

export async function getRoomBySlug(slug: string): Promise<RoomType | null> {
  return apiRequest<RoomType>(`/rooms/${encodeURIComponent(slug)}`);
}

export async function createReservation(data: BookingFormData): Promise<Reservation> {
  return apiRequest<Reservation>('/reservations', jsonBody({
    ...data,
    idempotencyKey: crypto.randomUUID(),
    roomSlug: data.selectedRoom?.roomType.slug,
  }));
}

export async function validatePromoCode(code: string): Promise<PromoCode | null> {
  return apiRequest<PromoCode | null>('/promo/validate', jsonBody({ code }));
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return apiRequest<DashboardStats>('/admin/dashboard');
}

export async function getReservations(): Promise<Reservation[]> {
  return apiRequest<Reservation[]>('/admin/reservations');
}

export async function getReservationById(id: string): Promise<Reservation | null> {
  return apiRequest<Reservation>(`/admin/reservations/${encodeURIComponent(id)}`);
}

export async function updateReservationStatus(id: string, status: Reservation['status']): Promise<Reservation> {
  return apiRequest<Reservation>(`/admin/reservations/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function getPayments(): Promise<Payment[]> {
  return apiRequest<Payment[]>('/admin/payments');
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  return apiRequest<AuditLog[]>('/admin/audit-log');
}

export async function getRateRules(): Promise<RoomRateRule[]> {
  return [];
}

export async function createStripeCheckoutSession(reservationId: string): Promise<{ sessionUrl: string; sessionId: string }> {
  return apiRequest<{ sessionUrl: string; sessionId: string }>('/stripe/session', jsonBody({ reservationId }));
}
