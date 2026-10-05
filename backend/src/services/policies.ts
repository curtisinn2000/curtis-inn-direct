export function policyFromRow(row: Record<string, unknown>) {
  return {
    checkInTime: row.check_in_time,
    checkOutTime: row.check_out_time,
    minimumCheckInAge: Number(row.minimum_check_in_age),
    cancellationWindowHours: Number(row.cancellation_window_hours),
    cancellationRule: row.cancellation_rule,
    noShowPolicy: row.no_show_policy,
    depositPolicy: row.deposit_policy,
    smokingPolicy: row.smoking_policy,
    petPolicy: row.pet_policy,
    incidentalsPolicy: row.incidentals_policy,
    acceptedPayments: row.accepted_payments,
    earlyCheckInPolicy: row.early_check_in_policy,
    lateCheckoutPolicy: row.late_checkout_policy,
    guestFacingNotes: row.guest_facing_notes,
    updatedAt: row.updated_at,
  };
}
