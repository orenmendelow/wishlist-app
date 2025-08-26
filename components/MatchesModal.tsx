'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Match, Contact } from '@/lib/database.types'

// Extended match interface with contact data
interface MatchWithContacts extends Match {
  user1_contact: Contact
  user2_contact: Contact
  other_user_contact: Contact // The contact representing the other user
}

interface Props {
  matches: Match[]
  onClose: () => void
}

export default function MatchesModal({ matches, onClose }: Props) {
  const { user } = useAuth()
  const [matchesWithContacts, setMatchesWithContacts] = useState<MatchWithContacts[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState<MatchWithContacts | null>(null)
  const [icebreakerMessage, setIcebreakerMessage] = useState('')

  // Fetch contact details for each match
  useEffect(() => {
    const fetchMatchDetails = async () => {
      if (!user || !matches.length) {
        setLoading(false)
        return
      }

      try {
        const enrichedMatches: MatchWithContacts[] = []

        for (const match of matches) {
          // Get both contacts involved in the match
          const { data: contacts, error } = await supabase
            .from('contacts')
            .select('*')
            .in('id', [match.contact1_id, match.contact2_id])

          if (error) {
            console.error('Error fetching match contacts:', error)
            continue
          }

          const user1Contact = contacts.find(c => c.id === match.contact1_id)
          const user2Contact = contacts.find(c => c.id === match.contact2_id)

          if (!user1Contact || !user2Contact) continue

          // Determine which contact represents the other user
          const isUser1 = match.user1_id === user.id
          const otherUserContact = isUser1 ? user1Contact : user2Contact

          enrichedMatches.push({
            ...match,
            user1_contact: user1Contact,
            user2_contact: user2Contact,
            other_user_contact: otherUserContact
          })
        }

        setMatchesWithContacts(enrichedMatches)
      } catch (error) {
        console.error('Error enriching matches:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMatchDetails()
  }, [user, matches])

  // Format contact identifier for display
  const formatContactId = (contact: Contact) => {
    if (contact.contact_type === 'phone' && contact.phone) {
      const numbers = contact.phone.replace(/\D/g, '')
      if (numbers.length <= 3) return numbers
      if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`
      return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`
    }
    return `@${contact.instagram_handle}`
  }

  // Handle sending icebreaker
  const sendIcebreaker = async (match: MatchWithContacts) => {
    if (!icebreakerMessage.trim()) {
      alert('Please enter a message')
      return
    }

    // In a real app, this would integrate with messaging APIs
    // For now, we'll just show a success message
    alert(`Icebreaker sent to ${match.other_user_contact.name}!\\n\\nMessage: "${icebreakerMessage}"\\n\\nNote: This is a demo. In the real app, this would send via SMS or Instagram DM.`)
    
    setSelectedMatch(null)
    setIcebreakerMessage('')
  }

  // Predefined icebreaker templates
  const icebreakerTemplates = [
    "Hey! 👋 Looks like we both added each other to our wishlists!",
    "What a nice surprise! 😊 How have you been?",
    "Well this is exciting! 🎉 Great to connect!",
    "Hey there! Funny how we both thought of each other ✨"
  ]

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="text-center mt-2 text-gray-600">Loading matches...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Your Matches 🎉</h2>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {matchesWithContacts.length} mutual {matchesWithContacts.length === 1 ? 'match' : 'matches'}
          </p>
        </div>

        {/* Matches list */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
          {matchesWithContacts.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">💔</div>
              <p className="text-gray-600">No matches yet!</p>
              <p className="text-sm text-gray-400 mt-2">Matches are revealed every Thursday at 5pm EST</p>
            </div>
          ) : (
            <div className="space-y-3">
              {matchesWithContacts.map((match) => (
                <div 
                  key={match.id}
                  className="bg-green-50 border border-green-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="font-semibold text-green-700">
                          {match.other_user_contact.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{match.other_user_contact.name}</p>
                        <p className="text-sm text-gray-500">{formatContactId(match.other_user_contact)}</p>
                        <p className="text-xs text-green-600">
                          Matched {new Date(match.revealed_at || match.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedMatch(match)}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                    >
                      💬 Say Hi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Icebreaker modal */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold mb-4">
              Send a message to {selectedMatch.other_user_contact.name}
            </h3>
            
            {/* Template buttons */}
            <div className="space-y-2 mb-4">
              <p className="text-sm text-gray-600 mb-2">Quick templates:</p>
              {icebreakerTemplates.map((template, index) => (
                <button
                  key={index}
                  onClick={() => setIcebreakerMessage(template)}
                  className="w-full text-left p-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {template}
                </button>
              ))}
            </div>

            {/* Custom message */}
            <textarea
              placeholder="Or write your own message..."
              value={icebreakerMessage}
              onChange={(e) => setIcebreakerMessage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              rows={3}
              maxLength={280}
            />
            <p className="text-xs text-gray-400 mt-1">{icebreakerMessage.length}/280</p>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setSelectedMatch(null)
                  setIcebreakerMessage('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => sendIcebreaker(selectedMatch)}
                disabled={!icebreakerMessage.trim()}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Send 💬
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
