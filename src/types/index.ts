// ============================================================
// Core domain types for Curtis Inn & Suites
// ============================================================

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export type PaymentStatus =
  | 'unpaid'
  | 'deposit_paid'
  | 'paid'
  | 'refunded'
  | 'partial_refund'
  | 'failed';

export type PaymentMethod =
  | 'stripe_pay_now'
  // Legacy values can still appear on historical reservations.
  | 'clover_pay_now'
  | 'pay_at_property'
  | 'clover_deposit';

export type RoomCategorySlug = string;

// --- Room Types ---
export interface RoomType {
  id: string;
  slug: RoomCategorySlug;
  name: string;
  shortDescription: string;
  longDescription: string;
  occupancy: number;
  bedType: string;
  images: string[];
  amenities: string[];
  policies: string[];
  basePrice: number;
  taxRate: number;
  isActive: boolean;
  inventoryCount: number;
  cancellationTerms: string;
  sortOrder: number;
}

// --- Reservation ---
export interface Reservation {
  id: string;
  confirmationNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  rooms: number;
  guest: GuestInfo;
  specialRequests: string;
  arrivalTime: string;
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  taxAmount: number;
  depositAmount: number;
  source: 'direct_website' | 'admin_manual' | 'phone';
  notes: string[];
  addedToMotelPro: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GuestInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

// --- Payment ---
export interface Payment {
  id: string;
  reservationId: string;
  confirmationNumber: string;
  guestName: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  cloverTransactionRef?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Rate Rules ---
export interface RoomRateRule {
  id: string;
  roomTypeId: string;
  roomTypeName: string;
  startDate: string;
  endDate: string;
  weekdayRate: number;
  weekendRate: number;
  overrideRate?: number;
  minimumStay: number;
  maximumStay: number;
  isActive: boolean;
}

// --- Inventory Calendar ---
export interface RoomInventoryDay {
  date: string;
  roomTypeId: string;
  available: number;
  total: number;
  isBlocked: boolean;
  isStopSell: boolean;
  rate: number;
}

export type InventoryStatus = 'open' | 'closed';

export interface AdminCalendarDay {
  date: string;
  inventory: number;
  booked: number;
  remaining: number;
  status: InventoryStatus;
  rate: number;
}

export interface AdminCalendarRoom {
  roomType: RoomType;
  days: AdminCalendarDay[];
}

export interface AdminCalendarOccupancy {
  date: string;
  booked: number;
  total: number;
  pct: number;
}

export interface AdminCalendarResponse {
  start: string;
  dates: string[];
  rooms: AdminCalendarRoom[];
  occupancy: AdminCalendarOccupancy[];
}

// --- Promo Codes ---
export interface PromoCode {
  id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  validFrom: string;
  validTo: string;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
}

// --- Content ---
export interface PropertyContent {
  heroTitle: string;
  heroSubtitle: string;
  heroImages: string[];
  aboutText: string;
}

export interface Amenity {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'room' | 'property' | 'nearby';
}

export interface NearbyAttraction {
  id: string;
  name: string;
  description: string;
  distance: string;
  image: string;
  category: string;
}

export interface GalleryImage {
  id: string;
  url: string;
  alt: string;
  category: 'exterior' | 'rooms' | 'pool' | 'amenities' | 'area';
  sortOrder: number;
}

export interface Review {
  id: string;
  guestName: string;
  rating: number;
  comment: string;
  date: string;
  source: string;
  isFeatured: boolean;
}

// --- Admin ---
export interface Admin {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'manager' | 'staff';
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  details: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

export interface EmailLog {
  id: string;
  recipientEmail: string;
  templateType: string;
  subject: string;
  status: 'sent' | 'failed' | 'pending';
  reservationId?: string;
  createdAt: string;
}

// --- Dashboard ---
export interface DashboardStats {
  arrivalsToday: number;
  departuresToday: number;
  activeStays: number;
  pendingRequests: number;
  confirmedBookings: number;
  occupancyPercent: number;
  availableRooms: number;
  totalRooms: number;
  revenueToday: number;
  revenueThisMonth: number;
}

// --- Booking Flow ---
export interface AvailabilitySearch {
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
}

export interface AvailabilityResult {
  roomType: RoomType;
  available: number;
  nightlyRate: number;
  totalRate: number;
  taxes: number;
  grandTotal: number;
  nights: number;
}

export interface BookingFormData {
  search: AvailabilitySearch;
  selectedRoom: AvailabilityResult | null;
  guestInfo: GuestInfo;
  specialRequests: string;
  arrivalTime: string;
  paymentMethod: PaymentMethod;
  agreedToPolicies: boolean;
  promoCode?: string;
}

// --- FAQ ---
export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
}
