alter table room_types
  add column if not exists deleted_at timestamptz;

create index if not exists room_types_visible_sort_idx
  on room_types (is_active, sort_order, name)
  where deleted_at is null;
