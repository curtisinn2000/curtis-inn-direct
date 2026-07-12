export const GALLERY_CATEGORY_OPTIONS = [
  { value: 'exterior', label: 'Exterior' },
  { value: 'area', label: 'Area' },
  { value: 'rooms', label: 'Rooms' },
  { value: 'pool', label: 'Pool' },
] as const;

export type GalleryCategoryKey = typeof GALLERY_CATEGORY_OPTIONS[number]['value'];

const categoryLabels = new Map<string, string>(
  GALLERY_CATEGORY_OPTIONS.map(category => [category.value, category.label]),
);

export function formatGalleryCategory(category: string) {
  const normalized = category.trim().toLowerCase();
  if (categoryLabels.has(normalized)) return categoryLabels.get(normalized)!;
  return category
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
