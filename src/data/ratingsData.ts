export interface OTARating {
  provider: string;
  rating: number;
  scale: number;
  reviewCount: number;
  /** Optional link to the listing page */
  url?: string;
}

export const OTA_RATINGS: OTARating[] = [
  { provider: 'Expedia', rating: 8.4, scale: 10, reviewCount: 510 },
  { provider: 'Booking.com', rating: 8.4, scale: 10, reviewCount: 890 },
  { provider: 'Agoda', rating: 9.6, scale: 10, reviewCount: 1 },
];
