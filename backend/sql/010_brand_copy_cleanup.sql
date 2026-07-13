update website_content_settings
set value = regexp_replace(value, '[[:space:]]+[-–—][[:space:]]+', ', ', 'g'),
    updated_at = now();

update website_content_settings
set value = 'Curtis Inn & Suites', updated_at = now()
where key = 'heroTitle';

update website_content_settings
set value = 'Hollywood, Florida', updated_at = now()
where key = 'heroSubtitle';

update website_content_settings
set value = 'Affordable comfort steps from Hollywood Beach. Free parking, pool, and Wi-Fi. Book direct for the best rates.',
    updated_at = now()
where key = 'heroDescription';

update room_types
set name = regexp_replace(name, '[[:space:]]+[-–—][[:space:]]+', ', ', 'g'),
    short_description = regexp_replace(short_description, '[[:space:]]+[-–—][[:space:]]+', ', ', 'g'),
    long_description = regexp_replace(long_description, '[[:space:]]+[-–—][[:space:]]+', ', ', 'g'),
    cancellation_terms = regexp_replace(cancellation_terms, '[[:space:]]+[-–—][[:space:]]+', ', ', 'g'),
    updated_at = now();

update website_faqs
set question = regexp_replace(question, '[[:space:]]+[-–—][[:space:]]+', ', ', 'g'),
    answer = regexp_replace(answer, '[[:space:]]+[-–—][[:space:]]+', ', ', 'g'),
    updated_at = now();

update website_gallery_images
set alt = regexp_replace(alt, '[[:space:]]+[-–—][[:space:]]+', ', ', 'g'),
    updated_at = now();

update website_reviews
set comment = regexp_replace(comment, '[[:space:]]+[-–—][[:space:]]+', ', ', 'g'),
    updated_at = now();

update website_attractions
set name = regexp_replace(name, '[[:space:]]+[-–—][[:space:]]+', ', ', 'g'),
    description = regexp_replace(description, '[[:space:]]+[-–—][[:space:]]+', ', ', 'g'),
    updated_at = now();
