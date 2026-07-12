import type {
  Reservation, Payment, Review, FAQ, GalleryImage,
  NearbyAttraction, DashboardStats, PromoCode, AuditLog, EmailLog,
} from '@/types';

export const MOCK_REVIEWS: Review[] = [
  { id: '1', guestName: 'Maria S.', rating: 5, comment: 'Great location, very clean rooms, and the staff was incredibly friendly. Will definitely come back!', date: '2024-12-15', source: 'Google', isFeatured: true },
  { id: '2', guestName: 'James R.', rating: 4, comment: 'Solid value for the price. The pool was a nice bonus. Close to the beach and easy to find.', date: '2024-11-28', source: 'Direct', isFeatured: true },
  { id: '3', guestName: 'Patricia L.', rating: 5, comment: 'Perfect for our family vacation. The two-bedroom suite gave us plenty of space. Free parking saved us a lot!', date: '2024-11-10', source: 'Google', isFeatured: true },
  { id: '4', guestName: 'David K.', rating: 4, comment: 'Clean, comfortable, and affordable. Exactly what we needed for a weekend getaway to Hollywood Beach.', date: '2024-10-22', source: 'TripAdvisor', isFeatured: true },
];

export const MOCK_FAQS: FAQ[] = [
  { id: '1', question: 'What time is check-in and check-out?', answer: 'Check-in is at 3:00 PM and check-out is at 11:00 AM. Early check-in and late check-out may be available upon request, subject to availability.', category: 'General', sortOrder: 1 },
  { id: '2', question: 'Is parking available?', answer: 'Yes, we offer free on-site parking for all guests. No reservation needed.', category: 'General', sortOrder: 2 },
  { id: '3', question: 'Do you allow pets?', answer: 'Unfortunately, we do not allow pets at Curtis Inn & Suites.', category: 'Policies', sortOrder: 3 },
  { id: '4', question: 'Is breakfast included?', answer: 'Breakfast is not included with your stay. However, there are many excellent dining options nearby.', category: 'General', sortOrder: 4 },
  { id: '5', question: 'How far is the hotel from Hollywood Beach?', answer: 'Curtis Inn & Suites is located less than a mile from Hollywood Beach and the famous Broadwalk.', category: 'Location', sortOrder: 5 },
  { id: '6', question: 'What is your cancellation policy?', answer: 'Free cancellation up to 48 hours before check-in. Cancellations within 48 hours may be subject to a one-night charge.', category: 'Policies', sortOrder: 6 },
  { id: '7', question: 'Do you have a pool?', answer: 'Yes! We have a beautiful outdoor pool available to all guests during daylight hours.', category: 'Amenities', sortOrder: 7 },
  { id: '8', question: 'Is Wi-Fi available?', answer: 'Yes, complimentary high-speed Wi-Fi is available throughout the property.', category: 'Amenities', sortOrder: 8 },
  { id: '9', question: 'What payment methods do you accept?', answer: 'We accept all major credit cards through our secure Stripe payment system.', category: 'Payments', sortOrder: 9 },
  { id: '10', question: 'Is there an age requirement to check in?', answer: 'Yes, guests must be at least 21 years old to check in. A valid government-issued photo ID is required.', category: 'Policies', sortOrder: 10 },
];

export const MOCK_GALLERY: GalleryImage[] = [
  { id: '1', url: '/placeholder.svg', alt: 'Curtis Inn & Suites exterior view', category: 'exterior', sortOrder: 1 },
  { id: '2', url: '/placeholder.svg', alt: 'Outdoor swimming pool', category: 'pool', sortOrder: 2 },
  { id: '3', url: '/placeholder.svg', alt: 'King Room interior', category: 'rooms', sortOrder: 3 },
  { id: '4', url: '/placeholder.svg', alt: 'Suite living area', category: 'rooms', sortOrder: 4 },
  { id: '5', url: '/placeholder.svg', alt: 'BBQ and picnic area', category: 'amenities', sortOrder: 5 },
  { id: '6', url: '/placeholder.svg', alt: 'Hollywood Beach nearby', category: 'area', sortOrder: 6 },
];

export const MOCK_ATTRACTIONS: NearbyAttraction[] = [
  { id: '1', name: 'Hollywood Beach & Broadwalk', description: 'Famous 2.5-mile promenade along the Atlantic Ocean with shops, restaurants, and entertainment.', distance: '0.8 miles', image: '/placeholder.svg', category: 'Beach' },
  { id: '2', name: 'Aventura Mall', description: 'Premier shopping destination featuring over 300 stores, dining, and entertainment options.', distance: '5.2 miles', image: '/placeholder.svg', category: 'Shopping' },
  { id: '3', name: 'Mardi Gras Casino', description: 'Exciting gaming, live entertainment, and dining just minutes from the hotel.', distance: '2.1 miles', image: '/placeholder.svg', category: 'Entertainment' },
  { id: '4', name: 'Fort Lauderdale-Hollywood International Airport', description: 'Conveniently located airport for easy arrivals and departures.', distance: '4.5 miles', image: '/placeholder.svg', category: 'Transport' },
];

export const MOCK_RESERVATIONS: Reservation[] = [
  {
    id: 'res-001', confirmationNumber: 'CIS-2024-001', roomTypeId: 'king-room', roomTypeName: 'King Room',
    checkIn: '2024-12-20', checkOut: '2024-12-23', nights: 3, guests: 2, rooms: 1,
    guest: { firstName: 'John', lastName: 'Anderson', email: 'john@example.com', phone: '(305) 555-1234' },
    specialRequests: 'Late check-in around 9 PM', arrivalTime: '9:00 PM',
    status: 'confirmed', paymentStatus: 'paid', paymentMethod: 'stripe_pay_now',
    totalAmount: 369.69, taxAmount: 42.51, depositAmount: 0, source: 'direct_website',
    notes: ['Guest called to confirm late arrival'], addedToMotelPro: true,
    createdAt: '2024-12-10T14:30:00Z', updatedAt: '2024-12-10T14:30:00Z',
  },
  {
    id: 'res-002', confirmationNumber: 'CIS-2024-002', roomTypeId: 'two-bedroom-suite', roomTypeName: 'Two-Bedroom Suite',
    checkIn: '2024-12-21', checkOut: '2024-12-26', nights: 5, guests: 5, rooms: 1,
    guest: { firstName: 'Sarah', lastName: 'Williams', email: 'sarah@example.com', phone: '(954) 555-5678' },
    specialRequests: 'Extra towels please', arrivalTime: '4:00 PM',
    status: 'confirmed', paymentStatus: 'paid', paymentMethod: 'stripe_pay_now',
    totalAmount: 1237.35, taxAmount: 142.35, depositAmount: 219,  source: 'direct_website',
    notes: [], addedToMotelPro: false,
    createdAt: '2024-12-12T09:15:00Z', updatedAt: '2024-12-12T09:15:00Z',
  },
  {
    id: 'res-003', confirmationNumber: 'CIS-2024-003', roomTypeId: 'standard-room', roomTypeName: 'Standard Room',
    checkIn: '2024-12-22', checkOut: '2024-12-24', nights: 2, guests: 1, rooms: 1,
    guest: { firstName: 'Michael', lastName: 'Chen', email: 'mchen@example.com', phone: '(786) 555-9012' },
    specialRequests: '', arrivalTime: '3:00 PM',
    status: 'confirmed', paymentStatus: 'paid', paymentMethod: 'stripe_pay_now',
    totalAmount: 178.54, taxAmount: 20.54, depositAmount: 0, source: 'direct_website',
    notes: ['Awaiting confirmation call'], addedToMotelPro: false,
    createdAt: '2024-12-15T18:45:00Z', updatedAt: '2024-12-15T18:45:00Z',
  },
];

export const MOCK_PAYMENTS: Payment[] = [
  { id: 'pay-001', reservationId: 'res-001', confirmationNumber: 'CIS-2024-001', guestName: 'John Anderson', amount: 369.69, method: 'stripe_pay_now', status: 'paid', stripePaymentIntentId: 'pi_mock_12345', createdAt: '2024-12-10T14:32:00Z', updatedAt: '2024-12-10T14:32:00Z' },
  { id: 'pay-002', reservationId: 'res-002', confirmationNumber: 'CIS-2024-002', guestName: 'Sarah Williams', amount: 219, method: 'stripe_pay_now', status: 'paid', stripePaymentIntentId: 'pi_mock_12346', createdAt: '2024-12-12T09:20:00Z', updatedAt: '2024-12-12T09:20:00Z' },
];

export const MOCK_PROMO_CODES: PromoCode[] = [
  { id: 'promo-001', code: 'WELCOME10', description: '10% off first booking', discountType: 'percentage', discountValue: 10, validFrom: '2024-01-01', validTo: '2025-12-31', maxUses: 100, currentUses: 23, isActive: true },
  { id: 'promo-002', code: 'SUMMER25', description: '$25 off summer stays', discountType: 'fixed', discountValue: 25, validFrom: '2024-06-01', validTo: '2024-09-30', maxUses: 50, currentUses: 50, isActive: false },
];

export const MOCK_DASHBOARD: DashboardStats = {
  arrivalsToday: 3,
  departuresToday: 2,
  activeStays: 8,
  pendingRequests: 4,
  confirmedBookings: 12,
  occupancyPercent: 72,
  availableRooms: 11,
  totalRooms: 33,
  revenueToday: 1285,
  revenueThisMonth: 28450,
};

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  { id: 'log-001', adminId: 'admin-1', adminName: 'Front Desk', action: 'reservation.confirmed', details: 'Confirmed reservation CIS-2024-001', entityType: 'reservation', entityId: 'res-001', createdAt: '2024-12-10T14:35:00Z' },
  { id: 'log-002', adminId: 'admin-1', adminName: 'Front Desk', action: 'reservation.checked_in', details: 'Guest checked in for CIS-2024-001', entityType: 'reservation', entityId: 'res-001', createdAt: '2024-12-20T15:10:00Z' },
];

export const MOCK_EMAIL_LOGS: EmailLog[] = [
  { id: 'email-001', recipientEmail: 'john@example.com', templateType: 'booking_confirmed', subject: 'Booking Confirmed - CIS-2024-001', status: 'sent', reservationId: 'res-001', createdAt: '2024-12-10T14:33:00Z' },
  { id: 'email-002', recipientEmail: 'sarah@example.com', templateType: 'booking_confirmed', subject: 'Booking Confirmed - CIS-2024-002', status: 'sent', reservationId: 'res-002', createdAt: '2024-12-12T09:22:00Z' },
];
