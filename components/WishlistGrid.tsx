'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Contact, WishlistEntry, SlotUnlock, MatchProcessing } from '@/lib/database.types'

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
  
  // Slot unlock times from database
  const [slotUnlocks, setSlotUnlocks] = useState<SlotUnlock[]>([])
  
  // Match processing info
  const [nextMatchProcessing, setNextMatchProcessing] = useState<Date | null>(null)
  
  // Current time for countdown updates
  const [currentTime, setCurrentTime] = useState(new Date())

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
    if (user) fetchSlotUnlocks()
    fetchMatchProcessing() // This doesn't need user context
  }, [user, fetchSlotUnlocks, fetchMatchProcessing])

  // Add contact to wishlist slot
  const addContact = async (name: string, phone: string, slotNumber: number) => {
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

    // Normalize phone to 10 digits (remove country code and formatting)
    const normalizedPhone = phone.replace(/\D/g, '').replace(/^1/, '')
    if (normalizedPhone.length !== 10) {
      alert('Please enter a valid 10-digit phone number')
      return
    }

    console.log('Adding contact with normalized phone:', normalizedPhone)

    // Check if phone already exists in wishlist
    const existingEntry = wishlistEntries.find(e => e.contacts.phone === normalizedPhone)
    if (existingEntry) {
      alert(`This contact is already in slot ${existingEntry.slot_number}`)
      return
    }

    try {
      // Find or create contact
      let contact = contacts.find(c => c.phone === normalizedPhone)
      if (!contact) {
        console.log('Creating new contact for user:', user.id)
        const { data, error } = await supabase
          .from('contacts')
          .insert({ user_id: user.id, name: name.trim(), phone: normalizedPhone })
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
      
      // Refresh UI
      onWishlistUpdated()
      setShowContactForm(false)
      setSelectedSlot(null)
      setContactName('')
      setContactPhone('')
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
      
      // Refresh UI
      onWishlistUpdated()
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

    console.log('Checking match for contact:', contact.phone)

    // Find if contact is a user of the app (normalize phone for comparison)
    const normalizedContactPhone = contact.phone.replace(/\D/g, '').replace(/^1/, '')
    const { data: contactProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, phone')
      .eq('phone', normalizedContactPhone)
      .single()
    
    if (profileError || !contactProfile) {
      console.log('Contact is not a user of the app')
      return
    }

    console.log('Contact is a user:', contactProfile.id)

    // Normalize current user's phone for lookup
    const currentUserPhone = currentProfile.phone.replace(/\D/g, '').replace(/^1/, '')
    
    // Check if they have current user in their contacts
    const { data: theirContact, error: contactError } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', contactProfile.id)
      .eq('phone', currentUserPhone)
      .single()
    
    if (contactError || !theirContact) {
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
    const isLocked = unlock && new Date(unlock.unlocks_at) > currentTime
    const hasFilled = wishlistEntries.find(e => e.slot_number === slotNumber)
    
    if (isLocked || hasFilled) return
    
    setSelectedSlot(slotNumber)
    setShowContactForm(true)
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

  // Submit contact form
  const handleSubmit = () => {
    if (!contactName.trim() || !contactPhone.trim() || !selectedSlot) return
    addContact(contactName, contactPhone, selectedSlot)
  }

  // Create sorted slots array - unlocked slots first by number, then locked slots by unlock time
  const getSortedSlots = () => {
    const slots = Array.from({ length: 10 }, (_, i) => i + 1)
    
    const unlockedSlots = slots.filter(slotNumber => {
      const unlock = slotUnlocks.find(u => u.slot_number === slotNumber)
      return !unlock || new Date(unlock.unlocks_at) <= currentTime
    }).sort((a, b) => a - b)
    
    const lockedSlots = slots.filter(slotNumber => {
      const unlock = slotUnlocks.find(u => u.slot_number === slotNumber)
      return unlock && new Date(unlock.unlocks_at) > currentTime
    }).sort((a, b) => {
      const unlockA = slotUnlocks.find(u => u.slot_number === a)!
      const unlockB = slotUnlocks.find(u => u.slot_number === b)!
      return new Date(unlockA.unlocks_at).getTime() - new Date(unlockB.unlocks_at).getTime()
    })
    
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

      {/* Match processing countdown */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
        <p className="text-sm font-medium text-blue-900">Next Match Reveal</p>
        <p className="text-lg font-bold text-blue-700">{getMatchCountdown()}</p>
        <p className="text-xs text-blue-600">Thursdays at 5:00 PM EST</p>
      </div>

      {/* 10 slots in single column */}
      <div className="grid grid-cols-1 gap-3">
        {getSortedSlots().map((slotNumber) => {
          const unlock = slotUnlocks.find(u => u.slot_number === slotNumber)
          const isLocked = unlock && new Date(unlock.unlocks_at) > currentTime
          const entry = wishlistEntries.find(e => e.slot_number === slotNumber)
          const isMatched = entry ? isContactMatched(entry.contact_id) : false
          
          return (
            <div
              key={slotNumber}
              onClick={() => handleSlotClick(slotNumber)}
              className={`p-4 border-2 rounded-lg transition-all min-h-[60px] flex items-center ${
                isMatched ? 'bg-green-50 border-green-300 shadow-md' :
                entry ? 'bg-blue-50 border-blue-200' : 
                isLocked ? 'bg-gray-50 border-gray-200 cursor-not-allowed' : 
                'bg-white border-gray-300 hover:border-blue-300 cursor-pointer'
              }`}
            >
              {isLocked ? (
                // Locked slot with countdown
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 text-gray-400">🔒</div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Slot {slotNumber}</p>
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
                    <p className="text-sm text-gray-500">{formatPhone(entry.contacts.phone)}</p>
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
                  <p className="text-sm font-medium text-gray-500">Add to Slot {slotNumber}</p>
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
              <input
                type="text"
                placeholder="Name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={formatPhone(contactPhone)}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={14}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowContactForm(false)
                    setSelectedSlot(null)
                    setContactName('')
                    setContactPhone('')
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!contactName.trim() || !contactPhone.trim()}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
