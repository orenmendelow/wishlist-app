# Database Update Instructions

## Step 1: Reset Your Current Database

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `supabase-reset.sql` 
4. Run the script - this will delete ALL current data and schema
5. ⚠️ **WARNING**: This will delete all your existing data! Make sure to backup anything important first.

## Step 2: Apply New Schema

1. After the reset script completes successfully
2. Copy and paste the contents of `supabase-schema.sql`
3. Run the script to create the new schema with all the improvements

## Step 3: Verify the Setup

After running both scripts, you should have:

### Tables:
- `profiles` - User accounts with phone and optional Instagram handle
- `contacts` - Phone and Instagram contacts 
- `wishlist_entries` - 10 slots per user
- `matches` - Mutual wishlist matches
- `slot_unlocks` - When slots become available (1-5 immediate, 6-10 weekly)
- `slot_locks` - When slots are locked (3 months after match, 1 month after deletion)
- `match_processing` - Processing schedule tracking

### Functions:
- `initialize_user_slots()` - Auto-create 10 slot unlocks on signup
- `next_thursday_5pm()` - Calculate next Thursday 5pm EST
- `lock_slots_after_match()` - Lock matched slots for 3 months
- `lock_slot_after_deletion()` - Lock deleted slots for 1 month  
- `is_slot_available()` - Check if slot can be used

### Triggers:
- `on_user_created` - Create slots on signup
- `on_match_revealed` - Lock slots when matches revealed
- `on_wishlist_entry_deleted` - Lock slots when contacts deleted

## New Slot Locking Logic:

1. **After Match (3 months)**: When a match is revealed, ONLY the specific slot that contained the matched contact gets locked for 3 months. The contact stays in the wishlist but the slot can't be reused.

2. **After Deletion (1 month)**: When you delete a contact from a slot, that slot gets locked for 1 month before you can add someone new to it.

3. **Conflict Resolution**: If a slot has both types of locks, it uses the longer lock period.

## Testing:

You can test the system by:
1. Creating a user account
2. Adding contacts to slots
3. Deleting a contact (should lock for 1 month)
4. Creating mutual matches and processing them (should lock for 3 months)
5. Running the `process-matches.js` script to test match processing
