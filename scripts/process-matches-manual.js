#!/usr/bin/env node

/**
 * Manual Match Processing Script
 * 
 * This script processes pending matches and reveals valid ones.
 * Run this instead of using the UI button for match processing.
 * 
 * Usage:
 *   node scripts/process-matches-manual.js
 * 
 * Or in your package.json scripts:
 *   "process-matches": "node scripts/process-matches-manual.js"
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for admin operations
)

async function processMatches() {
  try {
    console.log('🔄 Processing matches...')
    
    // Get all unprocessed matches
    const { data: unprocessedMatches, error: fetchError } = await supabase
      .from('matches')
      .select('*')
      .eq('is_revealed', false)
    
    if (fetchError) {
      console.error('Error fetching matches:', fetchError)
      return
    }

    if (!unprocessedMatches || unprocessedMatches.length === 0) {
      console.log('No new matches to process!')
      return
    }

    console.log(`Found ${unprocessedMatches.length} potential matches to validate...`)

    // Validate and reveal matches
    const validMatches = []
    const invalidMatches = []

    for (const match of unprocessedMatches) {
      // Check if user1 still has user2's contact in their wishlist
      const { data: user1Entries } = await supabase
        .from('wishlist_entries')
        .select('*')
        .eq('user_id', match.user1_id)
        .eq('contact_id', match.contact1_id)

      // Check if user2 still has user1's contact in their wishlist  
      const { data: user2Entries } = await supabase
        .from('wishlist_entries')
        .select('*')
        .eq('user_id', match.user2_id)
        .eq('contact_id', match.contact2_id)

      if (user1Entries && user1Entries.length > 0 && user2Entries && user2Entries.length > 0) {
        validMatches.push(match)
        console.log(`✅ Match valid: ${match.user1_id} ↔ ${match.user2_id}`)
      } else {
        invalidMatches.push(match)
        console.log(`❌ Match invalid (one removed the other): ${match.user1_id} ↔ ${match.user2_id}`)
      }
    }

    // Delete invalid matches
    if (invalidMatches.length > 0) {
      const invalidIds = invalidMatches.map(m => m.id)
      const { error: deleteError } = await supabase
        .from('matches')
        .delete()
        .in('id', invalidIds)

      if (deleteError) {
        console.error('Error deleting invalid matches:', deleteError)
      } else {
        console.log(`🗑️ Deleted ${invalidMatches.length} invalid matches`)
      }
    }

    // Reveal valid matches
    if (validMatches.length > 0) {
      const validIds = validMatches.map(m => m.id)
      const { error: updateError } = await supabase
        .from('matches')
        .update({ 
          is_revealed: true, 
          revealed_at: new Date().toISOString() 
        })
        .in('id', validIds)

      if (updateError) {
        console.error('Error revealing matches:', updateError)
      } else {
        console.log(`✅ Revealed ${validMatches.length} valid matches`)
      }
    } else {
      console.log('No valid matches found to reveal.')
    }

    // Update next processing time (optional - you can handle this with cron jobs)
    const nextProcessing = new Date()
    nextProcessing.setDate(nextProcessing.getDate() + 5)
    nextProcessing.setHours(17, 0, 0, 0) // 5 PM
    
    const { error: scheduleError } = await supabase
      .from('match_processing')
      .upsert({
        last_processed_at: new Date().toISOString(),
        next_processing_at: nextProcessing.toISOString()
      })

    if (scheduleError) {
      console.error('Error updating schedule:', scheduleError)
    } else {
      console.log('📅 Next processing scheduled for:', nextProcessing.toLocaleString())
    }

    console.log('✅ Match processing complete!')
    
  } catch (error) {
    console.error('Error processing matches:', error)
  }
}

// Run the script
if (require.main === module) {
  processMatches().then(() => {
    process.exit(0)
  }).catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })
}

module.exports = { processMatches }
