# Wishlist Dating App

## Core Concept
Users create wishlists of people they're interested in. When two users add each other, they match.

## Database Schema
- **profiles**: User accounts (id, phone)
- **contacts**: Imported phone contacts (user_id, name, phone)  
- **wishlist_entries**: Who users added to their 10 slots (user_id, contact_id, slot_number)
- **matches**: Mutual wishlist additions (user1_id, user2_id, contact1_id, contact2_id)
- **slot_unlocks**: When each slot becomes available (user_id, slot_number, unlocks_at)

## Slot System
- 10 total slots per user
- Slots 1-5: Unlock immediately on signup
- Slots 6-10: Unlock weekly (1 per week for 5 weeks)

## Match Logic
1. User A adds User B to wishlist
2. Check if User B has User A in their wishlist  
3. If yes → create match record
4. Show match notification

## Files
- `supabase-schema.sql` - Database setup
- `lib/database.types.ts` - TypeScript types
- `lib/supabase.ts` - Database client
- `contexts/AuthContext.tsx` - Mock authentication
- `components/AuthForm.tsx` - Phone login form
- `components/WishlistGrid.tsx` - Main wishlist interface
- `app/page.tsx` - App entry point
- `app/layout.tsx` - HTML layout
- `app/globals.css` - Minimal CSS

## Usage
1. Enter phone number
2. Enter "123456" as verification code
3. Click empty slots to add contacts
4. When someone adds you back → match created
5. Locked slots show countdown until unlock

Total: 8 essential files, ~500 lines of code.