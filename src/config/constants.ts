export const PROPERTY = {
  name: 'Curtis Inn & Suites',
  tagline: 'Comfort That Feels Like Home.',
  brandLabel: 'Curtis Inn & Suites. Comfort That Feels Like Home.',
  location: 'Hollywood, Florida',
  address: '1501 S Federal Hwy, Hollywood, FL',
  city: 'Hollywood',
  state: 'Florida',
  zip: '33020',
  phone: '(954) 555-0100',
  email: 'curtisinn200@gmail.com',
  checkIn: '3:00 PM',
  checkOut: '11:00 AM',
  website: 'curtisinnsuites.com',
} as const;

export const POLICIES = {
  checkIn: '3:00 PM',
  checkOut: '11:00 AM',
  pets: 'No pets allowed',
  breakfast: 'No breakfast included',
  cancellation: 'Free cancellation up to 48 hours before check-in. Cancellations within 48 hours may be subject to a one-night charge.',
  smoking: 'Non-smoking property',
  ageRequirement: 'Guests must be 21 years or older to check in',
  idRequired: 'Valid government-issued photo ID required at check-in',
  creditCard: 'A valid credit card is required at check-in for incidentals',
} as const;

export const TAX_RATE = 0.13; // 13% combined tax rate

export const AMENITIES_LIST = [
  { icon: 'Waves', name: 'Outdoor Pool', description: 'Relax by our outdoor pool' },
  { icon: 'Wifi', name: 'Free Wi-Fi', description: 'Complimentary high-speed internet' },
  { icon: 'Car', name: 'Free Parking', description: 'On-site parking at no extra charge' },
  { icon: 'Wind', name: 'Air Conditioning', description: 'Climate-controlled rooms' },
  { icon: 'WashingMachine', name: 'Laundry', description: 'On-site laundry facilities' },
  { icon: 'Flame', name: 'BBQ & Picnic Area', description: 'Outdoor barbecue and picnic space' },
] as const;

export const NEARBY_ATTRACTIONS = [
  {
    name: 'Hollywood Beach & Broadwalk',
    distance: '0.8 miles',
    description: 'Famous 2.5-mile promenade along the Atlantic Ocean with shops, restaurants, and entertainment.',
    category: 'Beach',
  },
  {
    name: 'Aventura Mall',
    distance: '5.2 miles',
    description: 'Premier shopping destination featuring over 300 stores, dining, and entertainment options.',
    category: 'Shopping',
  },
  {
    name: 'Mardi Gras Casino',
    distance: '2.1 miles',
    description: 'Exciting gaming, live entertainment, and dining just minutes from the hotel.',
    category: 'Entertainment',
  },
] as const;

export const BOOKING_STEPS = [
  { id: 1, label: 'Search', path: '/booking' },
  { id: 2, label: 'Select Room', path: '/booking' },
  { id: 3, label: 'Guest Details', path: '/booking/checkout' },
  { id: 4, label: 'Payment', path: '/booking/checkout' },
  { id: 5, label: 'Confirmation', path: '/booking/confirmation' },
] as const;
