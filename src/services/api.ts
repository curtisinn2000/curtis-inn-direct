/**
 * API Service Layer
 * 
 * Mock implementations that mirror the shape of future backend API calls.
 * Replace individual functions with real fetch/axios calls when backend is ready.
 */

import type {
  AvailabilitySearch, AvailabilityResult, RoomType, Reservation,
  Payment, DashboardStats, BookingFormData, RoomRateRule, PromoCode,
} from '@/types';
import { MOCK_ROOMS } from '@/data/mock-rooms';
import {
  MOCK_RESERVATIONS, MOCK_PAYMENTS, MOCK_DASHBOARD,
  MOCK_PROMO_CODES,
} from '@/data/mock-data';
import { TAX_RATE } from '@/config/constants';

// Simulate network delay
const delay = (ms = 600) => new Promise(r => setTimeout(r, ms));

// ─── Public API ─────────────────────────────────────────────

export async function searchAvailability(search: AvailabilitySearch): Promise<AvailabilityResult[]> {
  await delay();
  const { useInventoryStore, isRangeBookable, totalRateForRange, listRoomTypes } = await import('@/store/inventoryStore');
  const state = useInventoryStore.getState();

  const checkIn = new Date(search.checkIn);
  const checkOut = new Date(search.checkOut);
  const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

  return listRoomTypes(state)
    .filter(r => r.isActive && r.occupancy >= search.guests)
    .map(room => {
      const bookable = isRangeBookable(state, room.id, search.checkIn, search.checkOut, search.rooms);
      const { total, nightly } = totalRateForRange(state, room.id, search.checkIn, search.checkOut);
      const taxes = Math.round(total * TAX_RATE * 100) / 100;
      const fallback = MOCK_ROOMS.find(r => r.id === room.id);
      const roomType: RoomType = fallback
        ? { ...fallback, name: room.name, slug: fallback.slug, basePrice: room.basePrice, inventoryCount: room.baseInventory, isActive: room.isActive, occupancy: room.occupancy, bedType: room.bedType, shortDescription: room.shortDescription, longDescription: room.longDescription, images: room.images.length ? room.images : fallback.images }
        : {
            id: room.id, slug: room.slug as RoomType['slug'], name: room.name,
            shortDescription: room.shortDescription, longDescription: room.longDescription,
            occupancy: room.occupancy, bedType: room.bedType,
            images: room.images.length ? room.images : ['/placeholder.svg'],
            amenities: ['Free Wi-Fi', 'Air Conditioning', 'Flat-screen TV', 'Private Bathroom'],
            policies: ['Non-smoking', 'No pets'],
            basePrice: room.basePrice, taxRate: TAX_RATE, isActive: room.isActive,
            inventoryCount: room.baseInventory,
            cancellationTerms: 'Free cancellation up to 48 hours before check-in.',
            sortOrder: room.sortOrder,
          };
      return {
        roomType,
        available: bookable ? Math.max(1, room.baseInventory) : 0,
        nightlyRate: nightly,
        totalRate: total,
        taxes,
        grandTotal: Math.round((total + taxes) * 100) / 100,
        nights,
      };
    });
}

export async function getRoomTypes(): Promise<RoomType[]> {
  await delay(400);
  return MOCK_ROOMS.filter(r => r.isActive);
}

export async function getRoomBySlug(slug: string): Promise<RoomType | null> {
  await delay(300);
  return MOCK_ROOMS.find(r => r.slug === slug) || null;
}

export async function createReservation(data: BookingFormData): Promise<Reservation> {
  await delay(1000);
  const confNum = `CIS-${Date.now().toString().slice(-6)}`;
  const nights = data.selectedRoom?.nights || 1;
  const reservation: Reservation = {
    id: `res-${Date.now()}`,
    confirmationNumber: confNum,
    roomTypeId: data.selectedRoom?.roomType.id || '',
    roomTypeName: data.selectedRoom?.roomType.name || '',
    checkIn: data.search.checkIn,
    checkOut: data.search.checkOut,
    nights,
    guests: data.search.guests,
    rooms: data.search.rooms,
    guest: data.guestInfo,
    specialRequests: data.specialRequests,
    arrivalTime: data.arrivalTime,
    status: data.paymentMethod === 'pay_at_property' ? 'pending' : 'confirmed',
    paymentStatus: data.paymentMethod === 'clover_pay_now' ? 'paid' : data.paymentMethod === 'clover_deposit' ? 'deposit_paid' : 'unpaid',
    paymentMethod: data.paymentMethod,
    totalAmount: data.selectedRoom?.grandTotal || 0,
    taxAmount: data.selectedRoom?.taxes || 0,
    depositAmount: data.paymentMethod === 'clover_deposit' ? (data.selectedRoom?.roomType.basePrice || 0) : 0,
    source: 'direct_website',
    notes: [],
    addedToMotelPro: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return reservation;
}

export async function validatePromoCode(code: string): Promise<PromoCode | null> {
  await delay(400);
  const promo = MOCK_PROMO_CODES.find(p => p.code.toLowerCase() === code.toLowerCase() && p.isActive);
  return promo || null;
}

// ─── Admin API ──────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  await delay(500);
  return MOCK_DASHBOARD;
}

export async function getReservations(): Promise<Reservation[]> {
  await delay(500);
  return MOCK_RESERVATIONS;
}

export async function getReservationById(id: string): Promise<Reservation | null> {
  await delay(300);
  return MOCK_RESERVATIONS.find(r => r.id === id) || null;
}

export async function updateReservationStatus(id: string, status: Reservation['status']): Promise<Reservation> {
  await delay(500);
  const res = MOCK_RESERVATIONS.find(r => r.id === id);
  if (!res) throw new Error('Reservation not found');
  return { ...res, status, updatedAt: new Date().toISOString() };
}

export async function getPayments(): Promise<Payment[]> {
  await delay(500);
  return MOCK_PAYMENTS;
}

export async function getRateRules(): Promise<RoomRateRule[]> {
  await delay(400);
  return MOCK_ROOMS.map(room => ({
    id: `rate-${room.id}`,
    roomTypeId: room.id,
    roomTypeName: room.name,
    startDate: '2024-01-01',
    endDate: '2025-12-31',
    weekdayRate: room.basePrice,
    weekendRate: Math.round(room.basePrice * 1.15),
    minimumStay: 1,
    maximumStay: 30,
    isActive: true,
  }));
}

// ─── Payment Session (Clover placeholder) ───────────────────

export async function createCloverPaymentSession(_amount: number): Promise<{ sessionUrl: string; sessionId: string }> {
  await delay(800);
  // In production, this would call your backend which creates a Clover payment session
  return {
    sessionUrl: '#clover-payment-redirect',
    sessionId: `clv-session-${Date.now()}`,
  };
}

export async function getCloverPaymentStatus(_sessionId: string): Promise<{ status: 'success' | 'pending' | 'failed' }> {
  await delay(400);
  return { status: 'success' };
}
