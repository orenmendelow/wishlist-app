'use client'

import { useState, useEffect, useCallback } from 'react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import AuthForm from '@/components/AuthForm'
import WishlistGrid from '@/components/WishlistGrid'
import InstagramLinkModal from '@/components/InstagramLinkModal'
import { supabase } from '@/lib/supabase'
import { Contact, WishlistEntry } from '@/lib/database.types'

// Wishlist entry with contact data for UI display
interface WishlistEntryWithContact extends WishlistEntry {
  contacts: Contact
}

function AppContent() {
  const { user, profile, justLoggedIn, loading, signOut } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [wishlistEntries, setWishlistEntries] = useState<WishlistEntryWithContact[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [showInstagramModal, setShowInstagramModal] = useState(false)

  // Fetch user's contacts from database
  const fetchContacts = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
    if (data) setContacts(data)
  }, [user])

  // Fetch user's wishlist entries with contact data
  const fetchWishlistEntries = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('wishlist_entries')
      .select('*, contacts (*)')
      .eq('user_id', user.id)
      .order('slot_number')
    if (data) setWishlistEntries(data as WishlistEntryWithContact[])
  }, [user])

  // Fetch user's matches (only revealed ones)
  const fetchMatches = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('is_revealed', true)
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    if (data) setMatches(data)
  }, [user])

  // Refresh all data after changes
  const refreshData = useCallback(() => {
    fetchWishlistEntries()
    fetchMatches()
  }, [fetchWishlistEntries, fetchMatches])

  // Load data when user changes
  useEffect(() => {
    if (user && profile) {
      fetchContacts()
      fetchWishlistEntries()
      fetchMatches()
    }
  }, [user, profile, fetchContacts, fetchWishlistEntries, fetchMatches])

  // Show loading spinner
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // Show auth form if not logged in
  if (!user || !profile) {
    return <AuthForm />
  }

  // If user just logged in and Instagram not linked, check if should show flow
  if (user && profile && !profile.instagram_handle && justLoggedIn) {
    const isPermanentlySkipped = localStorage.getItem('instagram_skipped_permanently') === 'true'
    const isTemporarilySkipped = sessionStorage.getItem('instagram_skipped_temporarily') === 'true'
    
    if (!isPermanentlySkipped && !isTemporarilySkipped) {
      return <AuthForm />
    }
  }

  // Main app UI
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Wishlist</h1>
          {profile && (
            <div className="mt-3 space-y-1">
              <div className="text-sm text-gray-600">
                📞 {profile.phone ? profile.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') : 'No phone'}
              </div>
              <div className="text-sm text-gray-600">
                {profile.instagram_handle ? (
                  <span>📸 @{profile.instagram_handle}</span>
                ) : (
                  <button 
                    onClick={() => setShowInstagramModal(true)}
                    className="text-blue-500 hover:text-blue-600"
                  >
                    📸 Link Instagram
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <WishlistGrid
          profile={profile}
          contacts={contacts}
          wishlistEntries={wishlistEntries}
          matches={matches}
          onWishlistUpdated={refreshData}
        />
      </main>

      <footer className="px-4 py-6 border-t border-gray-200">
        <button
          onClick={() => signOut()}
          className="w-full text-center text-red-500 font-medium"
        >
          Sign Out
        </button>
      </footer>

      {/* Instagram Link Modal */}
      <InstagramLinkModal 
        isOpen={showInstagramModal} 
        onClose={() => setShowInstagramModal(false)} 
      />
    </div>
  )
}

// Root app component with auth provider
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
