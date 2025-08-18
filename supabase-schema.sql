-- Core database schema for wishlist matching app

-- Profiles: User accounts with slot unlock progression
create table public.profiles (
  id uuid primary key,
  phone text not null unique,
  created_at timestamp with time zone default now() not null
);

-- Contacts: User's imported phone contacts
create table public.contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  phone text not null,
  created_at timestamp with time zone default now() not null,
  unique(user_id, phone)
);

-- Wishlist entries: Who users have added to their 10 slots
create table public.wishlist_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete cascade not null,
  slot_number integer not null check (slot_number >= 1 and slot_number <= 10),
  created_at timestamp with time zone default now() not null,
  unique(user_id, slot_number)
);

-- Matches: Mutual wishlist entries between users
create table public.matches (
  id uuid default gen_random_uuid() primary key,
  user1_id uuid references public.profiles(id) on delete cascade not null,
  user2_id uuid references public.profiles(id) on delete cascade not null,
  contact1_id uuid references public.contacts(id) on delete cascade not null,
  contact2_id uuid references public.contacts(id) on delete cascade not null,
  created_at timestamp with time zone default now() not null,
  revealed_at timestamp with time zone null, -- When the match was revealed to users
  is_revealed boolean default false not null, -- Whether users have been notified
  unique(user1_id, user2_id, contact1_id, contact2_id)
);

-- Match processing schedule: Track when matches were last processed
create table public.match_processing (
  id uuid default gen_random_uuid() primary key,
  last_processed_at timestamp with time zone default now() not null,
  next_processing_at timestamp with time zone not null,
  created_at timestamp with time zone default now() not null
);

-- Slot unlocks: When each slot becomes available (1 = immediately, 2-10 = weekly intervals)
create table public.slot_unlocks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  slot_number integer not null check (slot_number >= 1 and slot_number <= 10),
  unlocks_at timestamp with time zone not null,
  unique(user_id, slot_number)
);

-- Function: Initialize user with 10 slot unlock schedule
create or replace function public.initialize_user_slots()
returns trigger as $$
begin
  -- Create 10 slots: slot 1-5 unlock immediately, 6-10 unlock weekly
  for i in 1..10 loop
    insert into public.slot_unlocks (user_id, slot_number, unlocks_at)
    values (
      new.id,
      i,
      case when i <= 5 then now() else now() + ((i - 5) * interval '1 week') end
    );
  end loop;
  return new;
end;
$$ language plpgsql security definer;

-- Function: Calculate next Thursday at 5pm EST
create or replace function public.next_thursday_5pm()
returns timestamp with time zone as $$
declare
  next_thursday timestamp with time zone;
begin
  -- Start with current time in EST
  next_thursday := now() at time zone 'America/New_York';
  
  -- Find next Thursday (4 = Thursday in extract(dow))
  next_thursday := next_thursday + ((4 - extract(dow from next_thursday) + 7) % 7) * interval '1 day';
  
  -- Set to 5pm
  next_thursday := date_trunc('day', next_thursday) + interval '17 hours';
  
  -- If it's already past 5pm Thursday, move to next Thursday
  if next_thursday <= (now() at time zone 'America/New_York') then
    next_thursday := next_thursday + interval '7 days';
  end if;
  
  return next_thursday at time zone 'America/New_York';
end;
$$ language plpgsql;

-- Trigger: Auto-create slots on user signup
create trigger on_user_created
  after insert on public.profiles
  for each row execute procedure public.initialize_user_slots();

-- Initialize match processing schedule
insert into public.match_processing (last_processed_at, next_processing_at)
values (now(), public.next_thursday_5pm())
on conflict do nothing;

-- RLS policies
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.wishlist_entries enable row level security;
alter table public.matches enable row level security;
alter table public.slot_unlocks enable row level security;
alter table public.match_processing enable row level security;

-- Users can only access their own data (simplified for mock auth)
create policy "allow_all" on public.profiles for all using (true);
create policy "allow_all" on public.contacts for all using (true);
create policy "allow_all" on public.wishlist_entries for all using (true);
create policy "allow_all" on public.slot_unlocks for all using (true);
create policy "allow_all" on public.matches for all using (true);
create policy "allow_all" on public.match_processing for all using (true);
