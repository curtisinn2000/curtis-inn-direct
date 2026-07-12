import type {
  AvailabilitySearch,
  AvailabilityResult,
  RoomType,
  Reservation,
  Payment,
  DashboardStats,
  BookingFormData,
  BookingCartItem,
  BookingQuote,
  RoomRateRule,
  PromoCode,
  AuditLog,
  AdminCalendarResponse,
  InventoryStatus,
  FAQ,
  GalleryImage,
  NearbyAttraction,
  PropertyContent,
  Review,
  WebsiteContent,
} from '@/types';
import { apiRequest, jsonBody } from './client';

export interface RoomTypeWritePayload {
  name: string;
  slug?: string;
  shortDescription: string;
  longDescription: string;
  occupancy: number;
  bedType: string;
  baseInventory: number;
  basePrice: number;
  isActive: boolean;
  images: string[];
  amenities?: string[];
  policies?: string[];
  cancellationTerms?: string;
  sortOrder?: number;
}

export interface ContentImageUploadResult {
  url: string;
  objectName: string;
  contentType: string;
  size: number;
}

export async function searchAvailability(search: AvailabilitySearch): Promise<AvailabilityResult[]> {
  return apiRequest<AvailabilityResult[]>('/availability/search', jsonBody(search));
}

export async function quoteAvailability(search: AvailabilitySearch, items: BookingCartItem[]): Promise<BookingQuote> {
  return apiRequest<BookingQuote>('/availability/quote', jsonBody({ search, items }));
}

export async function getRoomTypes(): Promise<RoomType[]> {
  return apiRequest<RoomType[]>('/rooms');
}

export async function getRoomBySlug(slug: string): Promise<RoomType | null> {
  return apiRequest<RoomType>(`/rooms/${encodeURIComponent(slug)}`);
}

export async function getWebsiteContent(): Promise<WebsiteContent> {
  return apiRequest<WebsiteContent>('/content');
}

export async function createReservation(data: BookingFormData): Promise<Reservation> {
  return apiRequest<Reservation>('/reservations', jsonBody({
    ...data,
    idempotencyKey: crypto.randomUUID(),
    roomSlug: data.selectedRoom?.roomType.slug,
    items: data.items,
  }));
}

export async function validatePromoCode(code: string): Promise<PromoCode | null> {
  return apiRequest<PromoCode | null>('/promo/validate', jsonBody({ code }));
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return apiRequest<DashboardStats>('/admin/dashboard');
}

export async function getAdminWebsiteContent(): Promise<WebsiteContent> {
  return apiRequest<WebsiteContent>('/admin/content');
}

export async function updateHeroContent(data: Pick<PropertyContent, 'heroTitle' | 'heroSubtitle' | 'heroDescription'>): Promise<PropertyContent> {
  return apiRequest<PropertyContent>('/admin/content/hero', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function createFaq(data: Omit<FAQ, 'id'>): Promise<FAQ> {
  return apiRequest<FAQ>('/admin/content/faqs', jsonBody(data));
}

export async function deleteFaq(id: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/admin/content/faqs/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function createGalleryImage(data: Omit<GalleryImage, 'id'>): Promise<GalleryImage> {
  return apiRequest<GalleryImage>('/admin/content/gallery', jsonBody(data));
}

export async function uploadContentImage(file: File): Promise<ContentImageUploadResult> {
  const formData = new FormData();
  formData.append('image', file);
  return apiRequest<ContentImageUploadResult>('/admin/content/uploads', {
    method: 'POST',
    body: formData,
  });
}

export async function deleteGalleryImage(id: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/admin/content/gallery/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function createReview(data: Omit<Review, 'id'>): Promise<Review> {
  return apiRequest<Review>('/admin/content/reviews', jsonBody(data));
}

export async function deleteReview(id: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/admin/content/reviews/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function createAttraction(data: Omit<NearbyAttraction, 'id'>): Promise<NearbyAttraction> {
  return apiRequest<NearbyAttraction>('/admin/content/attractions', jsonBody(data));
}

export async function deleteAttraction(id: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/admin/content/attractions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function getAdminRoomTypes(): Promise<RoomType[]> {
  return apiRequest<RoomType[]>('/admin/rooms');
}

export async function createAdminRoomType(data: RoomTypeWritePayload): Promise<RoomType> {
  return apiRequest<RoomType>('/admin/rooms', jsonBody(data));
}

export async function updateAdminRoomType(id: string, data: RoomTypeWritePayload): Promise<RoomType> {
  return apiRequest<RoomType>(`/admin/rooms/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteAdminRoomType(id: string): Promise<RoomType> {
  return apiRequest<RoomType>(`/admin/rooms/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function getReservations(): Promise<Reservation[]> {
  return apiRequest<Reservation[]>('/admin/reservations');
}

export async function getAdminCalendar(params: {
  start: string;
  days: number;
  roomId?: string;
}): Promise<AdminCalendarResponse> {
  const query = new URLSearchParams({
    start: params.start,
    days: String(params.days),
    roomId: params.roomId ?? 'all',
  });
  return apiRequest<AdminCalendarResponse>(`/admin/calendar?${query.toString()}`);
}

export async function setRoomRate(roomId: string, date: string, rate: number): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>('/admin/rates/set', jsonBody({ roomId, date, rate }));
}

export async function bulkUpdateRates(roomId: string, dates: string[], rate: number): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>('/admin/rates/bulk', jsonBody({
    roomId,
    dates,
    rule: { kind: 'set', amount: rate },
  }));
}

export async function clearRoomRates(roomId: string, from?: string): Promise<{ ok: true }> {
  const query = from ? `?${new URLSearchParams({ from }).toString()}` : '';
  return apiRequest<{ ok: true }>(`/admin/rates/${encodeURIComponent(roomId)}${query}`, {
    method: 'DELETE',
  });
}

export async function setRemainingAvailability(
  roomId: string,
  date: string,
  remaining: number,
): Promise<{ ok: true; inventory: number; booked: number }> {
  return apiRequest<{ ok: true; inventory: number; booked: number }>('/admin/inventory/remaining', jsonBody({ roomId, date, remaining }));
}

export async function bulkUpdateInventory(
  roomId: string,
  dates: string[],
  patch: { inventory?: number; status?: InventoryStatus },
): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>('/admin/inventory/bulk', jsonBody({ roomId, dates, patch }));
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
