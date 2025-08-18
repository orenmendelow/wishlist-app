#!/usr/bin/env node

// CLI script to process matches manually for testing
// Usage: node scripts/process-matches.js

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qmxypyxmykffmosydiwu.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteHlweXhteWtmZm1vc3lkaXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzMTUxODEsImV4cCI6MjA3MDg5MTE4MX0.StRyHNP2HMIyvGNR0TXoydJP6N_sAnvwgl5CMG2G3ZM'

const supabase = createClient(supabaseUrl, supabaseKey)

async function processMatches() {
  console.log('🔄 Processing matches...')
  
  try {
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

    // Validate each match - both users must still have each other in wishlists
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

      if (user1Entries?.length > 0 && user2Entries?.length > 0) {
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
        console.error('Error updating matches:', updateError)
        return
      }

      console.log(`🎉 ${validMatches.length} valid match(es) revealed!`)
    }

    console.log(`Summary: ${validMatches.length} revealed, ${invalidMatches.length} removed`)

    // Update next processing time
    const { data: latestProcessing } = await supabase
      .from('match_processing')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (latestProcessing) {
      const { error: scheduleError } = await supabase
        .from('match_processing')
        .update({ 
          last_processed_at: new Date().toISOString(),
          next_processing_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // +1 week for testing
        })
        .eq('id', latestProcessing.id)

      if (scheduleError) {
        console.error('Error updating schedule:', scheduleError)
      } else {
        console.log('📅 Next processing scheduled for +1 week')
      }
    }
    
  } catch (error) {
    console.error('Error processing matches:', error)
  }
}

processMatches()
