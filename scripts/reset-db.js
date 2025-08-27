#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function resetDatabase() {
  console.log('🗑️  Resetting database...')
  
  try {
    // Clear all tables in the correct order to avoid foreign key constraints
    console.log('Clearing matches...')
    const { error: matchesError } = await supabase
      .from('matches')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000') // Delete all rows
    
    if (matchesError) throw matchesError
    
    console.log('Clearing wishlist entries...')
    const { error: wishlistError } = await supabase
      .from('wishlist_entries')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000') // Delete all rows
    
    if (wishlistError) throw wishlistError
    
    console.log('Clearing contacts...')
    const { error: contactsError } = await supabase
      .from('contacts')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000') // Delete all rows
    
    if (contactsError) throw contactsError
    
    console.log('Clearing profiles...')
    const { error: profilesError } = await supabase
      .from('profiles')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000') // Delete all rows
    
    if (profilesError) throw profilesError
    
    console.log('✅ Database reset complete!')
    console.log('🔄 You can now use any phone number for testing')
    
  } catch (error) {
    console.error('❌ Error resetting database:', error.message)
    process.exit(1)
  }
}

// Run the reset
resetDatabase()
