import expediaLogo from '@/assets/ota/expedia.svg';
import bookingLogo from '@/assets/ota/booking.svg';
import agodaLogo from '@/assets/ota/agoda.svg';

export interface OTARating {
  provider: string;
  logo: string;
  rating: number;
  scale: number;
  reviewCount: number;
  /** Optional link to the listing page */
  url?: string;
}

export const OTA_RATINGS: OTARating[] = [
  { provider: 'Expedia', logo: expediaLogo, rating: 8.4, scale: 10, reviewCount: 510 },
  { provider: 'Booking.com', logo: bookingLogo, rating: 8.4, scale: 10, reviewCount: 890 },
  { provider: 'Agoda', logo: agodaLogo, rating: 9.6, scale: 10, reviewCount: 1 },
];
