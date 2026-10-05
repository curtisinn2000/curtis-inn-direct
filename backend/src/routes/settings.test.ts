import { describe, expect, it } from 'vitest';
import { policyFromRow } from '../services/policies.js';

describe('hotel policy persistence mapping', () => {
  it('maps every persisted policy field to the public API shape', () => {
    const policy = policyFromRow({
      check_in_time: '3:00 PM', check_out_time: '11:00 AM', minimum_check_in_age: 21,
      cancellation_window_hours: 48, cancellation_rule: 'One-night charge.', no_show_policy: 'Full charge.',
      deposit_policy: 'Pay now.', smoking_policy: 'No smoking.', pet_policy: 'No pets.',
      incidentals_policy: '$100 hold.', accepted_payments: ['Visa', 'Mastercard'],
      early_check_in_policy: 'Subject to availability.', late_checkout_policy: 'Subject to availability.',
      guest_facing_notes: 'Bring photo ID.', updated_at: '2026-10-04T12:00:00.000Z',
    });
    expect(policy).toMatchObject({
      checkInTime: '3:00 PM', minimumCheckInAge: 21, cancellationWindowHours: 48,
      acceptedPayments: ['Visa', 'Mastercard'], guestFacingNotes: 'Bring photo ID.',
    });
  });
});
