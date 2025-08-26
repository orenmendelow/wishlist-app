-- Reset script to clean up existing Supabase database before applying new schema
-- Run this in the Supabase SQL editor BEFORE running supabase-schema.sql

-- Drop all triggers first (if they exist)
drop trigger if exists on_user_created on public.profiles;
drop trigger if exists on_match_revealed on public.matches;
drop trigger if exists on_wishlist_entry_deleted on public.wishlist_entries;

-- Drop all functions (if they exist)
drop function if exists public.initialize_user_slots() cascade;
drop function if exists public.next_thursday_5pm() cascade;
drop function if exists public.lock_slots_after_match() cascade;
drop function if exists public.lock_slot_after_deletion() cascade;
drop function if exists public.is_slot_available(uuid, integer) cascade;

-- Drop all RLS policies first (ignore errors if they don't exist)
do $$
begin
    drop policy if exists "allow_all" on public.profiles;
    drop policy if exists "allow_all" on public.contacts;
    drop policy if exists "allow_all" on public.wishlist_entries;
    drop policy if exists "allow_all" on public.matches;
    drop policy if exists "allow_all" on public.slot_unlocks;
    drop policy if exists "allow_all" on public.slot_locks;
    drop policy if exists "allow_all" on public.match_processing;
exception
    when others then null;
end
$$;

-- Drop all tables (in correct order to handle foreign key constraints)
drop table if exists public.slot_locks cascade;
drop table if exists public.match_processing cascade;
drop table if exists public.slot_unlocks cascade;
drop table if exists public.matches cascade;
drop table if exists public.wishlist_entries cascade;
drop table if exists public.contacts cascade;
drop table if exists public.profiles cascade;

-- Note: This script will delete ALL your data!
-- Make sure to backup any important data before running this.
