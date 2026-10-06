alter table room_types add column if not exists category text;
alter table room_types add column if not exists standard_name text;
alter table room_types add column if not exists custom_name text;
alter table room_types add column if not exists bedrooms jsonb;
alter table room_types add column if not exists max_adults int;
alter table room_types add column if not exists max_children int;
alter table room_types add column if not exists extra_beds_allowed boolean;
alter table room_types add column if not exists max_extra_beds int;
alter table room_types add column if not exists extra_bed_types text[];
alter table room_types add column if not exists room_size_sq_ft int;
alter table room_types add column if not exists smoking_designation text;
alter table room_types add column if not exists bathroom_type text;
alter table room_types add column if not exists bathroom_features text[];
alter table room_types add column if not exists view_types text[];

update room_types set
  category = coalesce(category, case
    when lower(name) like '%apartment%' then 'apartment'
    when lower(name) like '%studio%' then 'studio'
    when lower(name) like '%suite%' then 'suite'
    else 'room'
  end),
  standard_name = coalesce(standard_name, 'Other'),
  custom_name = coalesce(custom_name, name),
  bedrooms = coalesce(bedrooms, jsonb_build_array(jsonb_build_object(
    'name', case when lower(name) like '%studio%' then 'Main sleeping area' else 'Bedroom 1' end,
    'beds', jsonb_build_array(jsonb_build_object('type', 'other', 'quantity', 1, 'customLabel', bed_type))
  ))),
  max_adults = coalesce(max_adults, occupancy),
  max_children = coalesce(max_children, occupancy),
  extra_beds_allowed = coalesce(extra_beds_allowed, false),
  max_extra_beds = coalesce(max_extra_beds, 0),
  extra_bed_types = coalesce(extra_bed_types, '{}'),
  smoking_designation = coalesce(smoking_designation,
    case when policies @> array['Non-smoking']::text[] then 'non_smoking' else 'unspecified' end),
  bathroom_type = coalesce(bathroom_type,
    case when amenities @> array['Private Bathroom']::text[] then 'private' else 'unspecified' end),
  bathroom_features = coalesce(bathroom_features, '{}'),
  view_types = coalesce(view_types, '{}');

alter table room_types alter column category set default 'room';
alter table room_types alter column category set not null;
alter table room_types alter column standard_name set default 'Other';
alter table room_types alter column standard_name set not null;
alter table room_types alter column bedrooms set default '[]'::jsonb;
alter table room_types alter column bedrooms set not null;
alter table room_types alter column max_adults set default 2;
alter table room_types alter column max_adults set not null;
alter table room_types alter column max_children set default 2;
alter table room_types alter column max_children set not null;
alter table room_types alter column extra_beds_allowed set default false;
alter table room_types alter column extra_beds_allowed set not null;
alter table room_types alter column max_extra_beds set default 0;
alter table room_types alter column max_extra_beds set not null;
alter table room_types alter column extra_bed_types set default '{}';
alter table room_types alter column extra_bed_types set not null;
alter table room_types alter column smoking_designation set default 'unspecified';
alter table room_types alter column smoking_designation set not null;
alter table room_types alter column bathroom_type set default 'unspecified';
alter table room_types alter column bathroom_type set not null;
alter table room_types alter column bathroom_features set default '{}';
alter table room_types alter column bathroom_features set not null;
alter table room_types alter column view_types set default '{}';
alter table room_types alter column view_types set not null;
alter table room_types alter column cancellation_terms drop not null;
alter table room_types alter column cancellation_terms drop default;

do $$ begin
  alter table room_types add constraint room_types_category_check check (category in ('room','suite','studio','apartment'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table room_types add constraint room_types_occupancy_caps_check check (
    occupancy > 0 and max_adults > 0 and max_children >= 0 and
    max_adults <= occupancy and max_children <= occupancy
  );
exception when duplicate_object then null; end $$;
do $$ begin
  alter table room_types add constraint room_types_extra_beds_check check (
    max_extra_beds >= 0 and (extra_beds_allowed or max_extra_beds = 0)
  );
exception when duplicate_object then null; end $$;
do $$ begin
  alter table room_types add constraint room_types_size_check check (room_size_sq_ft is null or room_size_sq_ft > 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table room_types add constraint room_types_smoking_check check (smoking_designation in ('non_smoking','smoking','unspecified'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table room_types add constraint room_types_bathroom_check check (bathroom_type in ('private','shared','unspecified'));
exception when duplicate_object then null; end $$;

alter table reservations add column if not exists adults int;
alter table reservations add column if not exists children int;
update reservations set adults = coalesce(adults, guests), children = coalesce(children, 0);
alter table reservations alter column adults set not null;
alter table reservations alter column children set not null;
alter table reservations alter column adults set default 1;
alter table reservations alter column children set default 0;
do $$ begin
  alter table reservations add constraint reservations_guest_split_check check (
    adults > 0 and children >= 0 and adults + children = guests
  );
exception when duplicate_object then null; end $$;
