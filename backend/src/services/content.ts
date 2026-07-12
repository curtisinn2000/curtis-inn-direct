import type { DbClient } from '../db.js';
import { attractionFromRow, faqFromRow, galleryImageFromRow, reviewFromRow } from '../transformers.js';

async function getHero(db: DbClient) {
  const result = await db.query(`select key, value from website_content_settings`);
  const settings = Object.fromEntries(result.rows.map(row => [String(row.key), String(row.value ?? '')]));
  return {
    heroTitle: settings.heroTitle || 'Curtis Inn & Suites',
    heroSubtitle: settings.heroSubtitle || 'Your Hollywood, Florida Getaway',
    heroDescription: settings.heroDescription || 'Affordable comfort steps from Hollywood Beach.',
  };
}

export async function getWebsiteContent(db: DbClient, options: { admin?: boolean } = {}) {
  const activeFilter = options.admin ? '' : 'where is_active = true';
  const hero = await getHero(db);
  const [faqs, gallery, reviews, attractions] = await Promise.all([
    db.query(`select * from website_faqs ${activeFilter} order by sort_order, category, question`),
    db.query(`select * from website_gallery_images ${activeFilter} order by sort_order, category, alt`),
    db.query(`select * from website_reviews ${activeFilter} order by sort_order, review_date desc, guest_name`),
    db.query(`select * from website_attractions ${activeFilter} order by sort_order, name`),
  ]);

  return {
    hero,
    faqs: faqs.rows.map(faqFromRow),
    gallery: gallery.rows.map(galleryImageFromRow),
    reviews: reviews.rows.map(reviewFromRow),
    attractions: attractions.rows.map(attractionFromRow),
  };
}
