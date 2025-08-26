-- Core database schema for wishlist matching app

-- Profiles: User accounts with slot unlock progression
create table public.profiles (
  id uuid primary key,
  phone text not null unique,
  instagram_handle text unique,
  created_at timestamp with time zone default now() not null
);

-- Contacts: User's imported phone contacts and Instagram handles
create table public.contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  phone text,
  instagram_handle text,
  contact_type text default 'phone' not null check (contact_type in ('phone', 'instagram')),
  created_at timestamp with time zone default now() not null,
  unique(user_id, phone),
  unique(user_id, instagram_handle),
  check (
    (contact_type = 'phone' and phone is not null and instagram_handle is null) or
    (contact_type = 'instagram' and instagram_handle is not null and phone is null)
  )
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

-- Slot locks: Track when slots are locked (e.g., after matches for 3 months, after deletion for 1 month)
create table public.slot_locks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  slot_number integer not null check (slot_number >= 1 and slot_number <= 10),
  locked_until timestamp with time zone not null,
  reason text not null check (reason in ('match', 'cooldown', 'admin')),
  match_id uuid references public.matches(id) on delete set null,
  created_at timestamp with time zone default now() not null,
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
  -- Start with current time in EST/EDT
  next_thursday := now() at time zone 'America/New_York';
  
  -- Find next Thursday (4 = Thursday in extract(dow))
  next_thursday := next_thursday + ((4 - extract(dow from next_thursday) + 7) % 7) * interval '1 day';
  
  -- Set to 5pm (17:00) in the local timezone
  next_thursday := date_trunc('day', next_thursday) + interval '17 hours';
  
  -- If it's already past 5pm Thursday, move to next Thursday
  if next_thursday <= (now() at time zone 'America/New_York') then
    next_thursday := next_thursday + interval '7 days';
  end if;
  
  -- Convert back to UTC for storage
  return next_thursday at time zone 'America/New_York';
end;
$$ language plpgsql;

-- Function: Lock slots after match for 3 months
create or replace function public.lock_slots_after_match()
returns trigger as $$
begin
  -- Only lock slots when a match is revealed
  if new.is_revealed = true and old.is_revealed = false then
    -- Lock the specific slot for user1 for 3 months (don't remove wishlist entry)
    insert into public.slot_locks (user_id, slot_number, locked_until, reason, match_id)
    select 
      new.user1_id,
      we.slot_number,
      now() + interval '3 months',
      'match',
      new.id
    from public.wishlist_entries we
    where we.user_id = new.user1_id and we.contact_id = new.contact1_id;
    
    -- Lock the specific slot for user2 for 3 months (don't remove wishlist entry)
    insert into public.slot_locks (user_id, slot_number, locked_until, reason, match_id)
    select 
      new.user2_id,
      we.slot_number,
      now() + interval '3 months',
      'match',
      new.id
    from public.wishlist_entries we
    where we.user_id = new.user2_id and we.contact_id = new.contact2_id;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Function: Lock slot for 1 month when user deletes a contact
create or replace function public.lock_slot_after_deletion()
returns trigger as $$
begin
  -- Lock the slot for 1 month when a wishlist entry is deleted
  insert into public.slot_locks (user_id, slot_number, locked_until, reason)
  values (
    old.user_id,
    old.slot_number,
    now() + interval '1 month',
    'cooldown'
  )
  on conflict (user_id, slot_number) do update set
    locked_until = greatest(public.slot_locks.locked_until, now() + interval '1 month'),
    reason = case 
      when public.slot_locks.reason = 'match' then 'match'
      else 'cooldown'
    end;
  
  return old;
end;
$$ language plpgsql security definer;

-- Function: Check if a slot is available for use
create or replace function public.is_slot_available(p_user_id uuid, p_slot_number integer)
returns boolean as $$
declare
  slot_unlocked boolean;
  slot_locked boolean;
begin
  -- Check if slot is unlocked
  select exists(
    select 1 from public.slot_unlocks 
    where user_id = p_user_id 
    and slot_number = p_slot_number 
    and unlocks_at <= now()
  ) into slot_unlocked;
  
  -- Check if slot is locked
  select exists(
    select 1 from public.slot_locks 
    where user_id = p_user_id 
    and slot_number = p_slot_number 
    and locked_until > now()
  ) into slot_locked;
  
  -- Slot is available if it's unlocked and not locked
  return slot_unlocked and not slot_locked;
end;
$$ language plpgsql security definer;

-- Trigger: Auto-create slots on user signup
create trigger on_user_created
  after insert on public.profiles
  for each row execute procedure public.initialize_user_slots();

-- Trigger: Auto-lock slots when matches are revealed
create trigger on_match_revealed
  after update on public.matches
  for each row execute procedure public.lock_slots_after_match();

-- Trigger: Auto-lock slot for 1 month when user deletes a contact
create trigger on_wishlist_entry_deleted
  after delete on public.wishlist_entries
  for each row execute procedure public.lock_slot_after_deletion();

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
alter table public.slot_locks enable row level security;
alter table public.match_processing enable row level security;

-- Users can only access their own data (simplified for mock auth)
create policy "allow_all" on public.profiles for all using (true);
create policy "allow_all" on public.contacts for all using (true);
create policy "allow_all" on public.wishlist_entries for all using (true);
create policy "allow_all" on public.slot_unlocks for all using (true);
create policy "allow_all" on public.slot_locks for all using (true);
create policy "allow_all" on public.matches for all using (true);
create policy "allow_all" on public.match_processing for all using (true);
