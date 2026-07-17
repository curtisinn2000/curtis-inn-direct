import { describe, expect, it } from 'vitest';
import { createReservationConfirmationPdf } from './confirmationPdf.js';
import type { ReservationNotification } from './notifications.js';

const reservation: ReservationNotification = {
  id: '11111111-1111-4111-8111-111111111111',
  confirmationNumber: 'CIS-20260716-0000001',
  checkIn: '2026-08-10',
  checkOut: '2026-08-12',
  nights: 2,
  guests: 4,
  rooms: 2,
  guestFirstName: 'Test',
  guestLastName: 'Guest',
  guestEmail: 'guest@example.com',
  guestPhone: '9545550100',
  arrivalTime: '4:00 PM',
  specialRequests: 'A quiet room away from the elevator, if available.',
  subtotalCents: 41600,
  taxCents: 5408,
  totalCents: 47008,
  createdAt: '2026-07-16T12:00:00.000Z',
  stripeCheckoutSessionId: 'cs_test_123',
  stripePaymentIntentId: 'pi_test_123',
  stripeChargeId: 'ch_test_123',
  stripeReceiptUrl: 'https://pay.stripe.com/receipts/test',
  roomLines: [
    { roomTypeName: 'King Room', rooms: 1, subtotalCents: 21800 },
    { roomTypeName: 'Superior Room with Two Double Beds', rooms: 1, subtotalCents: 19800 },
  ],
  nightlyRates: [],
};

describe('createReservationConfirmationPdf', () => {
  it('creates a non-empty PDF document', async () => {
    const pdf = await createReservationConfirmationPdf(reservation);

    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(2_000);
  });

  it('supports maximum-length special requests', async () => {
    const pdf = await createReservationConfirmationPdf({
      ...reservation,
      specialRequests: 'Long guest request. '.repeat(100).slice(0, 2_000),
    });

    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(2_000);
  });
});
