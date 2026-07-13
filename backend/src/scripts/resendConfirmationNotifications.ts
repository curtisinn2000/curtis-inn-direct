import { pool } from '../db.js';
import { resendReservationConfirmationNotifications } from '../services/notifications.js';

async function main() {
  let confirmationNumber = process.env.CONFIRMATION_NUMBER ?? process.argv[2];
  const guestEmail = process.env.GUEST_EMAIL;

  if (!confirmationNumber && guestEmail) {
    const result = await pool.query(
      `select confirmation_number
       from reservations
       where lower(guest_email) = lower($1)
         and status = 'confirmed'
         and payment_status = 'paid'
       order by created_at desc
       limit 1`,
      [guestEmail],
    );
    if (result.rowCount) {
      confirmationNumber = String(result.rows[0].confirmation_number);
    }
  }

  if (!confirmationNumber) {
    throw new Error('CONFIRMATION_NUMBER env var, first CLI argument, or GUEST_EMAIL env var with a confirmed/paid reservation is required.');
  }
  const targetConfirmationNumber = confirmationNumber;

  const templates = (process.env.NOTIFICATION_TEMPLATES ?? 'guest_booking_confirmed,guest_booking_confirmed_sms')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  await resendReservationConfirmationNotifications(pool, targetConfirmationNumber, templates);
  console.log(`Resent confirmation notifications for ${targetConfirmationNumber}: ${templates.join(', ')}`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
