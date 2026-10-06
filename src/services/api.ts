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
  AdminCalendarDay,
  InventoryStatus,
  FAQ,
  GalleryImage,
  NearbyAttraction,
  PropertyContent,
  Review,
  RoomOption,
  RoomOptionsCatalog,
  WebsiteContent,
  AdminAccount,
  AdminRoleDefinition,
  AdminSessionUser,
  HotelPolicies,
  IntegrationSettings,
} from '@/types';
import { apiRequest, jsonBody } from './client';

export interface RoomTypeWritePayload {
  category: RoomType['category'];
  standardName: string;
  customName?: string | null;
  slug?: string;
  shortDescription: string;
  longDescription: string;
  maxGuests: number;
  maxAdults: number;
  maxChildren: number;
  bedrooms: RoomType['bedrooms'];
  baseInventory: number;
  isActive: boolean;
  extraBedsAllowed: boolean;
  maxExtraBeds: number;
  extraBedTypes: string[];
  roomSizeSqFt?: number | null;
  smokingDesignation: RoomType['smokingDesignation'];
  bathroomType: RoomType['bathroomType'];
  bathroomFeatures: string[];
  viewTypes: string[];
  images: string[];
  amenities?: string[];
  policies?: string[];
  cancellationTerms?: string | null;
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

export async function uploadRoomImage(file: File): Promise<ContentImageUploadResult> {
  const formData = new FormData();
  formData.append('image', file);
  return apiRequest<ContentImageUploadResult>('/admin/rooms/uploads', { method: 'POST', body: formData });
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

export async function getRoomOptionsCatalog(): Promise<RoomOptionsCatalog> {
  return apiRequest<RoomOptionsCatalog>('/admin/content/room-options');
}

export async function createRoomAmenityOption(data: { label: string; sortOrder?: number }): Promise<RoomOption> {
  return apiRequest<RoomOption>('/admin/content/amenities', jsonBody(data));
}

export async function deleteRoomAmenityOption(id: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/admin/content/amenities/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function createRoomPolicyOption(data: { label: string; sortOrder?: number }): Promise<RoomOption> {
  return apiRequest<RoomOption>('/admin/content/policies', jsonBody(data));
}

export async function deleteRoomPolicyOption(id: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/admin/content/policies/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function getAdminRoomTypes(): Promise<RoomType[]> {
  return apiRequest<RoomType[]>('/admin/rooms');
}

export async function getRoomTypeOptions(): Promise<RoomOptionsCatalog> {
  return apiRequest<RoomOptionsCatalog>('/admin/rooms/options');
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

export async function deleteAdminRoomType(id: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/admin/rooms/${encodeURIComponent(id)}`, {
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

export async function setDefaultRoomRate(roomId: string, rate: number): Promise<RoomType> {
  return apiRequest<RoomType>('/admin/rates/default', { method: 'PUT', body: JSON.stringify({ roomId, rate }) });
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

export async function setDailyInventory(input: {
  roomId: string;
  date: string;
  inventory: number;
  expectedUpdatedAt?: string | null;
}): Promise<AdminCalendarDay> {
  return apiRequest<AdminCalendarDay>('/admin/inventory', { method: 'PATCH', body: JSON.stringify(input) });
}

export async function bulkUpdateInventory(
  roomId: string,
  dates: string[],
  patch: { inventory?: number; status?: InventoryStatus },
): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>('/admin/inventory/bulk', jsonBody({ roomId, dates, patch }));
}

export async function setInventoryStatus(input: {
  roomId: string;
  date: string;
  status: InventoryStatus;
  expectedUpdatedAt?: string | null;
}): Promise<AdminCalendarDay> {
  return apiRequest<AdminCalendarDay>('/admin/inventory/status', { method: 'PATCH', body: JSON.stringify(input) });
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

export async function getAdminSession(): Promise<{ user: AdminSessionUser }> {
  return apiRequest<{ user: AdminSessionUser }>('/auth/me');
}

export async function getAdminProfile() {
  return apiRequest<{ id: string; email: string; displayName: string; roleNames: string[]; lastLoginAt: string | null }>('/admin/settings/profile');
}

export async function updateAdminProfile(displayName: string) {
  return apiRequest<{ ok: true; displayName: string }>('/admin/settings/profile', { method: 'PUT', body: JSON.stringify({ displayName }) });
}

export async function changeAdminPassword(currentPassword: string, newPassword: string) {
  return apiRequest<{ ok: true }>('/admin/settings/profile/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) });
}

export async function getAdminAccounts(): Promise<AdminAccount[]> {
  return apiRequest<AdminAccount[]>('/admin/settings/users');
}

export async function getAdminRoles(): Promise<AdminRoleDefinition[]> {
  return apiRequest<AdminRoleDefinition[]>('/admin/settings/roles');
}

export async function inviteAdminUser(data: { displayName: string; email: string; roleKey: string }) {
  return apiRequest<{ ok: true; userId: string; expiresAt: string }>('/admin/settings/users/invitations', jsonBody(data));
}

export async function resendAdminInvitation(userId: string) {
  return apiRequest<{ ok: true }>(`/admin/settings/users/${encodeURIComponent(userId)}/resend-invitation`, { method: 'POST' });
}

export async function updateAdminUserRole(userId: string, roleKey: string) {
  return apiRequest<{ ok: true }>(`/admin/settings/users/${encodeURIComponent(userId)}/role`, { method: 'PATCH', body: JSON.stringify({ roleKey }) });
}

export async function updateAdminUserStatus(userId: string, isActive: boolean) {
  return apiRequest<{ ok: true }>(`/admin/settings/users/${encodeURIComponent(userId)}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
}

export async function inspectAdminInvitation(token: string) {
  return apiRequest<{ email: string; displayName: string; roleName: string; expiresAt: string }>('/auth/invitations/inspect', jsonBody({ token }));
}

export async function acceptAdminInvitation(data: { token: string; displayName: string; password: string }) {
  return apiRequest<{ ok: true }>('/auth/invitations/accept', jsonBody(data));
}

export async function getHotelPolicies(): Promise<HotelPolicies> {
  return apiRequest<HotelPolicies>('/policies');
}

export async function getAdminHotelPolicies(): Promise<HotelPolicies> {
  return apiRequest<HotelPolicies>('/admin/settings/policies');
}

export async function updateHotelPolicies(data: HotelPolicies): Promise<HotelPolicies> {
  return apiRequest<HotelPolicies>('/admin/settings/policies', { method: 'PUT', body: JSON.stringify(data) });
}

export async function getIntegrationSettings(): Promise<IntegrationSettings> {
  return apiRequest<IntegrationSettings>('/admin/settings/integrations');
}

export async function updateEmailIntegration(data: Record<string, unknown>) {
  return apiRequest<{ ok: true; configured: boolean; secretMask: string; message: string }>('/admin/settings/integrations/email', { method: 'PUT', body: JSON.stringify(data) });
}

export async function updateStripeIntegration(data: Record<string, unknown>) {
  return apiRequest<{ ok: true; configured: boolean; secretMask: string; message: string }>('/admin/settings/integrations/stripe', { method: 'PUT', body: JSON.stringify(data) });
}

export async function testIntegration(provider: 'email' | 'stripe') {
  return apiRequest<{ ok: true; message: string }>(`/admin/settings/integrations/${provider}/test`, { method: 'POST' });
}

export async function getRateRules(): Promise<RoomRateRule[]> {
  return [];
}

export async function createStripeCheckoutSession(reservationId: string): Promise<{ sessionUrl: string; sessionId: string }> {
  return apiRequest<{ sessionUrl: string; sessionId: string }>('/stripe/session', jsonBody({ reservationId }));
}
