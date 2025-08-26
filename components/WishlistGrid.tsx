'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Contact, WishlistEntry, SlotUnlock, SlotLock, MatchProcessing } from '@/lib/database.types'
import MatchesModal from './MatchesModal'

// Wishlist entry with contact data for display
interface WishlistEntryWithContact extends WishlistEntry {
  contacts: Contact
}

// Props passed from app page
interface Props {
  profile: any
  contacts: Contact[]
  wishlistEntries: WishlistEntryWithContact[]
  matches: any[]
  onWishlistUpdated: () => void
}

export default function WishlistGrid({ profile, contacts, wishlistEntries, matches, onWishlistUpdated }: Props) {
  const { user } = useAuth()
  
  // Form state for adding contacts
  const [showContactForm, setShowContactForm] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactInstagram, setContactInstagram] = useState('')
  const [contactType, setContactType] = useState<'phone' | 'instagram'>('phone')
  
  // Slot unlock times from database
  const [slotUnlocks, setSlotUnlocks] = useState<SlotUnlock[]>([])
  
  // Slot lock times from database
  const [slotLocks, setSlotLocks] = useState<SlotLock[]>([])
  
  // Match processing info
  const [nextMatchProcessing, setNextMatchProcessing] = useState<Date | null>(null)
  
  // Current time for countdown updates
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // Matches modal state
  const [showMatchesModal, setShowMatchesModal] = useState(false)
  
  // Admin/testing state
  const [processingMatches, setProcessingMatches] = useState(false)

  // Fetch slot unlock times for countdown display
  const fetchSlotUnlocks = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('slot_unlocks')
      .select('*')
      .eq('user_id', user.id)
      .order('slot_number')
    if (data) setSlotUnlocks(data)
  }, [user])

  // Fetch slot lock times for countdown display
  const fetchSlotLocks = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('slot_locks')
      .select('*')
      .eq('user_id', user.id)
      .gt('locked_until', new Date().toISOString()) // Only active locks
      .order('slot_number')
    if (data) setSlotLocks(data)
  }, [user])

  // Fetch next match processing time
  const fetchMatchProcessing = useCallback(async () => {
    const { data } = await supabase
      .from('match_processing')
      .select('next_processing_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (data) {
      setNextMatchProcessing(new Date(data.next_processing_at))
    }
  }, [])

  // Update current time every second for countdowns
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Load slot unlock data on mount
  useEffect(() => {
    if (user) {
      fetchSlotUnlocks()
      fetchSlotLocks()
    }
    fetchMatchProcessing() // This doesn't need user context
  }, [user, fetchSlotUnlocks, fetchSlotLocks, fetchMatchProcessing])

  // Add contact to wishlist slot (phone or Instagram)
  const addContact = async (name: string, identifier: string, slotNumber: number, type: 'phone' | 'instagram') => {
    if (!user) return

    // Verify user profile exists in database
    console.log('Verifying user profile for:', user.id)
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, phone')
      .eq('id', user.id)
      .single()
    
    if (profileError || !userProfile) {
      console.error('Profile verification failed:', profileError)
      alert('User profile not found. Please sign out and sign in again.')
      return
    }
    
    console.log('User profile verified:', userProfile)

    let normalizedIdentifier: string
    
    if (type === 'phone') {
      // Normalize phone to 10 digits (only remove leading 1 if it results in 10 digits)
      let cleaned = identifier.replace(/\D/g, '')
      if (cleaned.length === 11 && cleaned.startsWith('1')) {
        cleaned = cleaned.slice(1) // Remove country code
      }
      normalizedIdentifier = cleaned
      
      if (normalizedIdentifier.length !== 10) {
        alert('Please enter a valid 10-digit phone number')
        return
      }
    } else {
      // Normalize Instagram handle (remove @ and convert to lowercase)
      normalizedIdentifier = identifier.replace(/^@/, '').toLowerCase()
      if (normalizedIdentifier.length < 1) {
        alert('Please enter a valid Instagram handle')
        return
      }
    }

    console.log(`Adding ${type} contact with normalized identifier:`, normalizedIdentifier)

    // Check if contact already exists in wishlist
    const existingEntry = wishlistEntries.find(e => 
      type === 'phone' ? e.contacts.phone === normalizedIdentifier 
                       : e.contacts.instagram_handle === normalizedIdentifier
    )
    if (existingEntry) {
      alert(`This contact is already in slot ${existingEntry.slot_number}`)
      return
    }

    try {
      // Find or create contact
      let contact = contacts.find(c => 
        type === 'phone' ? c.phone === normalizedIdentifier 
                         : c.instagram_handle === normalizedIdentifier
      )
      
      if (!contact) {
        console.log(`Creating new ${type} contact for user:`, user.id)
        const contactData = {
          user_id: user.id,
          name: name.trim(),
          contact_type: type,
          ...(type === 'phone' ? { phone: normalizedIdentifier } : { instagram_handle: normalizedIdentifier })
        }
        
        const { data, error } = await supabase
          .from('contacts')
          .insert(contactData)
          .select()
          .single()
        if (error) {
          console.error('Contact creation error:', error)
          throw error
        }
        contact = data
        console.log('Created contact:', contact)
      } else {
        console.log('Using existing contact:', contact)
      }

      // Create wishlist entry
      if (!contact) throw new Error('Failed to create contact')
      
      console.log('Creating wishlist entry for:', { user_id: user.id, contact_id: contact.id, slot_number: slotNumber })
      
      const { error: wishlistError } = await supabase
        .from('wishlist_entries')
        .insert({
          user_id: user.id,
          contact_id: contact.id,
          slot_number: slotNumber
        })
      if (wishlistError) {
        console.error('Wishlist entry error:', wishlistError)
        throw wishlistError
      }

      console.log('Wishlist entry created successfully')

      // Check for match
      await checkForMatch(contact.id, userProfile, contact)
      
      // Refresh UI and slot locks
      onWishlistUpdated()
      fetchSlotLocks() // Refresh locks in case there were any changes
      setShowContactForm(false)
      setSelectedSlot(null)
      setContactName('')
      setContactPhone('')
      setContactInstagram('')
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  // Delete contact from wishlist slot and lock for 1 month
  const deleteContact = async (slotNumber: number) => {
    if (!user) return

    const confirmed = confirm(`Remove contact from slot ${slotNumber}? This will lock the slot for 1 month.`)
    if (!confirmed) return

    try {
      // Get the wishlist entry to find contact info
      const entryToDelete = wishlistEntries.find(e => e.slot_number === slotNumber)
      
      // Remove wishlist entry
      const { error: deleteError } = await supabase
        .from('wishlist_entries')
        .delete()
        .eq('user_id', user.id)
        .eq('slot_number', slotNumber)

      if (deleteError) {
        console.error('Delete error:', deleteError)
        throw deleteError
      }

      // Clean up any unrevealed matches involving this contact
      if (entryToDelete) {
        await supabase
          .from('matches')
          .delete()
          .eq('is_revealed', false)
          .or(`contact1_id.eq.${entryToDelete.contact_id},contact2_id.eq.${entryToDelete.contact_id}`)
      }

      // Update slot unlock time to 1 month from now
      const lockUntil = new Date()
      lockUntil.setMonth(lockUntil.getMonth() + 1)

      const { error: lockError } = await supabase
        .from('slot_unlocks')
        .update({ unlocks_at: lockUntil.toISOString() })
        .eq('user_id', user.id)
        .eq('slot_number', slotNumber)

      if (lockError) {
        console.error('Lock error:', lockError)
        throw lockError
      }

      console.log(`Slot ${slotNumber} deleted and locked until:`, lockUntil)
      
      // Refresh UI and slot locks
      onWishlistUpdated()
      fetchSlotLocks() // Refresh locks since we just added one
      fetchSlotUnlocks()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  // Check if adding this contact creates a mutual match
  const checkForMatch = async (contactId: string, userProfile?: any, contactObj?: any) => {
    console.log('checkForMatch called with:', { contactId, userProfile: !!userProfile, contactObj: !!contactObj })
    
    if (!user) {
      console.log('No user found, exiting checkForMatch')
      return
    }
    
    // Use passed profile or fallback to context profile
    const currentProfile = userProfile || profile
    if (!currentProfile) {
      console.log('No current profile found, exiting checkForMatch')
      return
    }

    // Use passed contact object or find in contacts array
    const contact = contactObj || contacts.find(c => c.id === contactId)
    if (!contact) {
      console.log('No contact found with id:', contactId)
      return
    }

    console.log('Checking match for contact:', contact)

    let contactProfile = null

    if (contact.contact_type === 'phone' && contact.phone) {
      // For phone contacts, find if they're a user by phone number
      let normalizedContactPhone = contact.phone.replace(/\D/g, '')
      if (normalizedContactPhone.length === 11 && normalizedContactPhone.startsWith('1')) {
        normalizedContactPhone = normalizedContactPhone.slice(1) // Remove country code
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, phone, instagram_handle')
        .eq('phone', normalizedContactPhone)
        .single()
      
      if (!error && data) {
        contactProfile = data
      }
    } else if (contact.contact_type === 'instagram' && contact.instagram_handle) {
      // For Instagram contacts, find if they're a user by Instagram handle
      const { data, error } = await supabase
        .from('profiles')
        .select('id, phone, instagram_handle')
        .eq('instagram_handle', contact.instagram_handle)
        .single()
      
      if (!error && data) {
        contactProfile = data
      }
    }
    
    if (!contactProfile) {
      console.log('Contact is not a user of the app')
      return
    }

    console.log('Contact is a user:', contactProfile.id)

    // Check if they have current user in their contacts
    let theirContact = null

    if (currentProfile.phone) {
      // Check if they have current user by phone
      let currentUserPhone = currentProfile.phone.replace(/\D/g, '')
      if (currentUserPhone.length === 11 && currentUserPhone.startsWith('1')) {
        currentUserPhone = currentUserPhone.slice(1) // Remove country code
      }
      
      const { data, error } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', contactProfile.id)
        .eq('phone', currentUserPhone)
        .eq('contact_type', 'phone')
        .single()
      
      if (!error && data) {
        theirContact = data
      }
    }

    if (!theirContact && currentProfile.instagram_handle) {
      // Check if they have current user by Instagram
      const { data, error } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', contactProfile.id)
        .eq('instagram_handle', currentProfile.instagram_handle)
        .eq('contact_type', 'instagram')
        .single()
      
      if (!error && data) {
        theirContact = data
      }
    }
    
    if (!theirContact) {
      console.log('They do not have current user in their contacts')
      return
    }

    console.log('They have current user in contacts:', theirContact.id)

    // Check if they have current user in their wishlist
    const { data: theirEntries, error: entryError } = await supabase
      .from('wishlist_entries')
      .select('*')
      .eq('user_id', contactProfile.id)
      .eq('contact_id', theirContact.id)
    
    if (entryError || !theirEntries || theirEntries.length === 0) {
      console.log('They do not have current user in their wishlist')
      return
    }
    
    const theirEntry = theirEntries[0]

    console.log('POTENTIAL MATCH FOUND! Creating match record for scheduled reveal')
    console.log('Match details:', {
      currentUser: user.id,
      contactUser: contactProfile.id,
      currentUserContact: contactId,
      theirContact: theirContact.id
    })

    // Check if match already exists to avoid duplicates
    const { data: existingMatches, error: matchCheckError } = await supabase
      .from('matches')
      .select('id, user1_id, user2_id')

    if (matchCheckError) {
      console.error('Error checking existing matches:', matchCheckError)
      return
    }

    const existingMatch = existingMatches?.find(match => 
      (match.user1_id === user.id && match.user2_id === contactProfile.id) ||
      (match.user1_id === contactProfile.id && match.user2_id === user.id)
    )

    if (existingMatch) {
      console.log('Match already exists')
      return
    }

    // Create match record (not yet revealed)
    const { error: matchError } = await supabase
      .from('matches')
      .insert({
        user1_id: user.id,
        user2_id: contactProfile.id,
        contact1_id: contactId,
        contact2_id: theirContact.id,
        is_revealed: false
      })

    if (matchError) {
      console.error('Error creating match:', matchError)
    } else {
      console.log('✅ Potential match saved! Will be revealed on next scheduled processing.')
    }
  }

  // Handle slot click (open form or ignore if locked/filled)
  const handleSlotClick = (slotNumber: number) => {
    const unlock = slotUnlocks.find(u => u.slot_number === slotNumber)
    const lock = slotLocks.find(l => l.slot_number === slotNumber)
    const hasFilled = wishlistEntries.find(e => e.slot_number === slotNumber)
    
    // Check if slot is not yet unlocked
    const isNotYetUnlocked = unlock && new Date(unlock.unlocks_at) > currentTime
    // Check if slot is locked (cooldown)
    const isLocked = lock && new Date(lock.locked_until) > currentTime
    
    if (isNotYetUnlocked || isLocked || hasFilled) return
    
    setSelectedSlot(slotNumber)
    setShowContactForm(true)
    setContactType('phone') // Default to phone
    setContactName('')
    setContactPhone('')
    setContactInstagram('')
  }

  // Format countdown timer display
  const getCountdown = (unlockTime: string) => {
    const diff = new Date(unlockTime).getTime() - currentTime.getTime()
    if (diff <= 0) return 'Unlocked'
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  // Format phone for display
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`
  }

  // Check if a contact is matched (only revealed matches count)
  const isContactMatched = (contactId: string) => {
    if (!user || !matches) return false
    return matches.some(match => 
      match.is_revealed && (
        (match.user1_id === user.id && match.contact1_id === contactId) ||
        (match.user2_id === user.id && match.contact2_id === contactId)
      )
    )
  }

  // Format countdown for match processing
  const getMatchCountdown = () => {
    if (!nextMatchProcessing) return 'Loading...'
    
    const diff = nextMatchProcessing.getTime() - currentTime.getTime()
    if (diff <= 0) return 'Processing matches...'
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  // Manual match processing for testing
  const processMatchesManually = async () => {
    if (!user) return
    
    setProcessingMatches(true)
    
    try {
      console.log('🔄 Manually processing matches...')
      
      // Get all unprocessed matches
      const { data: unprocessedMatches, error: fetchError } = await supabase
        .from('matches')
        .select('*')
        .eq('is_revealed', false)
      
      if (fetchError) {
        console.error('Error fetching matches:', fetchError)
        alert('Error fetching matches')
        return
      }

      if (!unprocessedMatches || unprocessedMatches.length === 0) {
        alert('No new matches to process!')
        return
      }

      console.log(`Found ${unprocessedMatches.length} potential matches to validate...`)

      // Validate and reveal matches (same logic as the server script)
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
          console.error('Error updating matches:', updateError)
          alert('Error revealing matches')
          return
        }

        console.log(`🎉 ${validMatches.length} valid match(es) revealed!`)
        alert(`🎉 ${validMatches.length} match(es) revealed! Check your matches.`)
      }

      // Update next processing time
      const { data: latestProcessing } = await supabase
        .from('match_processing')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (latestProcessing) {
        // Get next Thursday 5pm EST using the SQL function
        const { data: nextThursday } = await supabase.rpc('next_thursday_5pm')
        
        const { error: scheduleError } = await supabase
          .from('match_processing')
          .update({ 
            last_processed_at: new Date().toISOString(),
            next_processing_at: nextThursday
          })
          .eq('id', latestProcessing.id)

        if (scheduleError) {
          console.error('Error updating schedule:', scheduleError)
        } else {
          console.log('📅 Next processing scheduled for next Thursday at 5pm EST')
          // Refresh the next processing time
          fetchMatchProcessing()
        }
      }

      // Refresh data
      onWishlistUpdated()
      
    } catch (error) {
      console.error('Error processing matches:', error)
      alert('Error processing matches')
    } finally {
      setProcessingMatches(false)
    }
  }

  // Submit contact form
  const handleSubmit = () => {
    if (!contactName.trim() || !selectedSlot) return
    
    if (contactType === 'phone') {
      if (!contactPhone.trim()) return
      addContact(contactName, contactPhone, selectedSlot, 'phone')
    } else {
      if (!contactInstagram.trim()) return
      addContact(contactName, contactInstagram, selectedSlot, 'instagram')
    }
  }

  // Create sorted slots array - unlocked slots first, then locked slots by unlock time
  const getSortedSlots = () => {
    const slots = Array.from({ length: 10 }, (_, i) => i + 1)
    
    // Separate unlocked and locked slots
    const unlockedSlots: number[] = []
    const lockedSlots: number[] = []
    
    slots.forEach(slotNumber => {
      const unlock = slotUnlocks.find(u => u.slot_number === slotNumber)
      const lock = slotLocks.find(l => l.slot_number === slotNumber)
      
      // Check if slot is currently locked due to cooldown
      const isCurrentlyLocked = lock && new Date(lock.locked_until) > currentTime
      
      // Check if slot is not yet unlocked
      const isNotYetUnlocked = unlock && new Date(unlock.unlocks_at) > currentTime
      
      if (isCurrentlyLocked || isNotYetUnlocked) {
        lockedSlots.push(slotNumber)
      } else {
        unlockedSlots.push(slotNumber)
      }
    })
    
    // Sort unlocked slots by slot number
    unlockedSlots.sort((a, b) => a - b)
    
    // Sort locked slots by earliest unlock/unlock time
    lockedSlots.sort((a, b) => {
      const unlockA = slotUnlocks.find(u => u.slot_number === a)
      const unlockB = slotUnlocks.find(u => u.slot_number === b)
      const lockA = slotLocks.find(l => l.slot_number === a)
      const lockB = slotLocks.find(l => l.slot_number === b)
      
      // Get the earliest time when the slot becomes available
      let timeA = Infinity
      let timeB = Infinity
      
      if (lockA && new Date(lockA.locked_until) > currentTime) {
        timeA = new Date(lockA.locked_until).getTime()
      } else if (unlockA && new Date(unlockA.unlocks_at) > currentTime) {
        timeA = new Date(unlockA.unlocks_at).getTime()
      }
      
      if (lockB && new Date(lockB.locked_until) > currentTime) {
        timeB = new Date(lockB.locked_until).getTime()
      } else if (unlockB && new Date(unlockB.unlocks_at) > currentTime) {
        timeB = new Date(unlockB.unlocks_at).getTime()
      }
      
      return timeA - timeB
    })
    
    // Return unlocked slots first, then locked slots
    return [...unlockedSlots, ...lockedSlots]
  }

  return (
    <div className="space-y-4">
      {/* User's phone number display */}
      {profile?.phone && (
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">Logged in as: {formatPhone(profile.phone)}</p>
        </div>
      )}

      {/* Match processing countdown and matches button */}
      <div className="space-y-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-sm font-medium text-blue-900">Next Match Reveal</p>
          <p className="text-lg font-bold text-blue-700">{getMatchCountdown()}</p>
          <p className="text-xs text-blue-600">
            {nextMatchProcessing 
              ? nextMatchProcessing.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'short', 
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZoneName: 'short'
                })
              : 'Thursdays at 5:00 PM EST'
            }
          </p>
        </div>
        
        {/* View matches button */}
        {matches.length > 0 && (
          <button
            onClick={() => setShowMatchesModal(true)}
            className="w-full bg-green-50 border border-green-200 rounded-lg p-3 hover:bg-green-100 transition-colors"
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-green-700 font-medium">🎉 View Your {matches.length} Match{matches.length !== 1 ? 'es' : ''}</span>
            </div>
          </button>
        )}
        
        {/* Manual match processing button (for testing) */}
        <button
          onClick={processMatchesManually}
          disabled={processingMatches}
          className="w-full bg-purple-50 border border-purple-200 rounded-lg p-3 hover:bg-purple-100 transition-colors disabled:opacity-50"
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-purple-700 font-medium">
              {processingMatches ? '⏳ Processing...' : '🔧 Process Matches Now (Testing)'}
            </span>
          </div>
        </button>
      </div>

      {/* 10 slots in single column */}
      <div className="grid grid-cols-1 gap-3">
        {getSortedSlots().map((slotNumber, index) => {
          const unlock = slotUnlocks.find(u => u.slot_number === slotNumber)
          const lock = slotLocks.find(l => l.slot_number === slotNumber)
          const entry = wishlistEntries.find(e => e.slot_number === slotNumber)
          const isMatched = entry ? isContactMatched(entry.contact_id) : false
          
          // Determine slot status
          const isUnlocked = !unlock || new Date(unlock.unlocks_at) <= currentTime
          const isLocked = lock && new Date(lock.locked_until) > currentTime
          const isNotYetUnlocked = !isUnlocked
          const isAvailable = isUnlocked && !isLocked && !entry
          
          const displayNumber = index + 1
          
          return (
            <div
              key={slotNumber}
              onClick={() => handleSlotClick(slotNumber)}
              className={`p-4 border-2 rounded-lg transition-all min-h-[60px] flex items-center ${
                isMatched ? 'bg-green-50 border-green-300 shadow-md' :
                entry ? 'bg-blue-50 border-blue-200' : 
                isLocked ? 'bg-red-50 border-red-200 cursor-not-allowed' :
                isNotYetUnlocked ? 'bg-gray-50 border-gray-200 cursor-not-allowed' : 
                'bg-white border-gray-300 hover:border-blue-300 cursor-pointer'
              }`}
            >
              {isLocked ? (
                // Locked slot with countdown and reason
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 text-red-400">🔒</div>
                  <div>
                    <p className="text-sm font-medium text-red-600">Slot {displayNumber} - Locked</p>
                    <p className="text-xs text-red-400">
                      {lock!.reason === 'match' ? 'Match cooldown' : 'Deletion cooldown'}: {getCountdown(lock!.locked_until)}
                    </p>
                  </div>
                </div>
              ) : isNotYetUnlocked ? (
                // Locked slot with countdown
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 text-gray-400">🔒</div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Slot {displayNumber}</p>
                    <p className="text-xs text-gray-400">
                      Unlocks in {getCountdown(unlock!.unlocks_at)}
                    </p>
                  </div>
                </div>
              ) : entry ? (
                // Filled slot with contact
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isMatched ? 'bg-green-100' : 'bg-blue-100'
                  }`}>
                    <span className={`font-semibold ${
                      isMatched ? 'text-green-700' : 'text-blue-700'
                    }`}>
                      {entry.contacts.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{entry.contacts.name}</p>
                      {isMatched && <span className="text-green-600 font-bold">🎉 MATCH!</span>}
                    </div>
                    <p className="text-sm text-gray-500">
                      {entry.contacts.contact_type === 'phone' && entry.contacts.phone
                        ? formatPhone(entry.contacts.phone)
                        : entry.contacts.instagram_handle
                        ? `@${entry.contacts.instagram_handle}`
                        : 'No contact info'
                      }
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteContact(slotNumber)
                    }}
                    className="ml-2 p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    title="Remove contact"
                  >
                    ❌
                  </button>
                </div>
              ) : (
                // Empty slot
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 text-gray-400">➕</div>
                  <p className="text-sm font-medium text-gray-500">Empty slot</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Contact form modal */}
      {showContactForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Add to Slot {selectedSlot}</h3>
            <div className="space-y-4">
              {/* Contact type selector */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setContactType('phone')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    contactType === 'phone' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📞 Phone
                </button>
                <button
                  onClick={() => setContactType('instagram')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    contactType === 'instagram' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📸 Instagram
                </button>
              </div>
              
              {/* Name input */}
              <input
                type="text"
                placeholder="Name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              
              {/* Contact input based on type */}
              {contactType === 'phone' ? (
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={formatPhone(contactPhone)}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={14}
                />
              ) : (
                <input
                  type="text"
                  placeholder="Instagram Handle (without @)"
                  value={contactInstagram}
                  onChange={(e) => setContactInstagram(e.target.value.replace(/^@/, ''))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowContactForm(false)
                    setSelectedSlot(null)
                    setContactName('')
                    setContactPhone('')
                    setContactInstagram('')
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!contactName.trim() || (contactType === 'phone' ? !contactPhone.trim() : !contactInstagram.trim())}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Matches modal */}
      {showMatchesModal && (
        <MatchesModal 
          matches={matches}
          onClose={() => setShowMatchesModal(false)}
        />
      )}
    </div>
  )
}
