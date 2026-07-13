create table if not exists website_content_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references app_users(id)
);

create table if not exists website_faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text not null default 'General',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references app_users(id)
);
create index if not exists website_faqs_public_sort_idx on website_faqs (is_active, category, sort_order);

create table if not exists website_gallery_images (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  alt text not null default '',
  category text not null default 'exterior',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references app_users(id)
);
create index if not exists website_gallery_public_sort_idx on website_gallery_images (is_active, category, sort_order);

create table if not exists website_reviews (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  rating int not null check (rating >= 1 and rating <= 5),
  comment text not null,
  review_date date not null default current_date,
  source text not null default 'Direct',
  is_featured boolean not null default true,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references app_users(id)
);
create index if not exists website_reviews_public_sort_idx on website_reviews (is_active, is_featured, sort_order);

create table if not exists website_attractions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  distance text not null default '',
  image text not null default '',
  category text not null default 'Area',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references app_users(id)
);
create index if not exists website_attractions_public_sort_idx on website_attractions (is_active, sort_order);

insert into website_content_settings(key, value)
values
  ('heroTitle', 'Curtis Inn & Suites'),
  ('heroSubtitle', 'Hollywood, Florida'),
  ('heroDescription', 'Affordable comfort steps from Hollywood Beach. Free parking, pool, and Wi-Fi. Book direct for the best rates.')
on conflict (key) do nothing;

insert into website_faqs(question, answer, category, sort_order)
select * from (values
  ('What time is check-in and check-out?', 'Check-in is at 3:00 PM and check-out is at 11:00 AM. Early check-in and late check-out may be available upon request, subject to availability.', 'General', 1),
  ('Is parking available?', 'Yes, we offer free on-site parking for all guests. No reservation needed.', 'General', 2),
  ('Do you allow pets?', 'Unfortunately, we do not allow pets at Curtis Inn & Suites.', 'Policies', 3),
  ('Is breakfast included?', 'Breakfast is not included with your stay. However, there are many excellent dining options nearby.', 'General', 4),
  ('How far is the hotel from Hollywood Beach?', 'Curtis Inn & Suites is located less than a mile from Hollywood Beach and the famous Broadwalk.', 'Location', 5),
  ('What is your cancellation policy?', 'Free cancellation up to 48 hours before check-in. Cancellations within 48 hours may be subject to a one-night charge.', 'Policies', 6),
  ('Do you have a pool?', 'Yes! We have a beautiful outdoor pool available to all guests during daylight hours.', 'Amenities', 7),
  ('Is Wi-Fi available?', 'Yes, complimentary high-speed Wi-Fi is available throughout the property.', 'Amenities', 8),
  ('What payment methods do you accept?', 'We accept all major credit cards through our secure Stripe payment system.', 'Payments', 9),
  ('Is there an age requirement to check in?', 'Yes, guests must be at least 21 years old to check in. A valid government-issued photo ID is required.', 'Policies', 10)
) as seed(question, answer, category, sort_order)
where not exists (select 1 from website_faqs);

insert into website_gallery_images(url, alt, category, sort_order)
select * from (values
  ('/assets/hero-hotel.jpg', 'Curtis Inn & Suites exterior view', 'exterior', 1),
  ('/assets/pool.jpg', 'Outdoor swimming pool', 'pool', 2),
  ('/assets/room-king.jpg', 'King Room interior', 'rooms', 3),
  ('/assets/beach.jpg', 'Hollywood Beach nearby', 'area', 4)
) as seed(url, alt, category, sort_order)
where not exists (select 1 from website_gallery_images);

insert into website_reviews(guest_name, rating, comment, review_date, source, is_featured, sort_order)
select * from (values
  ('Maria S.', 5, 'Great location, very clean rooms, and the staff was incredibly friendly. Will definitely come back!', '2024-12-15'::date, 'Google', true, 1),
  ('James R.', 4, 'Solid value for the price. The pool was a nice bonus. Close to the beach and easy to find.', '2024-11-28'::date, 'Direct', true, 2),
  ('Patricia L.', 5, 'Perfect for our family vacation. The two-bedroom suite gave us plenty of space. Free parking saved us a lot!', '2024-11-10'::date, 'Google', true, 3),
  ('David K.', 4, 'Clean, comfortable, and affordable. Exactly what we needed for a weekend getaway to Hollywood Beach.', '2024-10-22'::date, 'TripAdvisor', true, 4)
) as seed(guest_name, rating, comment, review_date, source, is_featured, sort_order)
where not exists (select 1 from website_reviews);

insert into website_attractions(name, description, distance, image, category, sort_order)
select * from (values
  ('Hollywood Beach & Broadwalk', 'Famous 2.5-mile promenade along the Atlantic Ocean with shops, restaurants, and entertainment.', '0.8 miles', '/assets/beach.jpg', 'Beach', 1),
  ('Aventura Mall', 'Premier shopping destination featuring over 300 stores, dining, and entertainment options.', '5.2 miles', '', 'Shopping', 2),
  ('Mardi Gras Casino', 'Exciting gaming, live entertainment, and dining just minutes from the hotel.', '2.1 miles', '', 'Entertainment', 3),
  ('Fort Lauderdale-Hollywood International Airport', 'Conveniently located airport for easy arrivals and departures.', '4.5 miles', '', 'Transport', 4)
) as seed(name, description, distance, image, category, sort_order)
where not exists (select 1 from website_attractions);
