'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface InstagramLinkModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function InstagramLinkModal({ isOpen, onClose }: InstagramLinkModalProps) {
  const { linkInstagram, verifyInstagramOtp, loading } = useAuth()
  const [instagramHandle, setInstagramHandle] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'handle' | 'otp'>('handle')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 'handle') {
      await linkInstagram(instagramHandle)
      setStep('otp')
    } else {
      const { error } = await verifyInstagramOtp(instagramHandle, otp)
      if (error) {
        alert('Invalid code. Use 123456')
      } else {
        // Success - refresh the page to show updated profile
        window.location.reload()
      }
    }
  }

  const handleClose = () => {
    setStep('handle')
    setInstagramHandle('')
    setOtp('')
    onClose()
  }

  const isValidInstagram = instagramHandle.trim().length > 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {step === 'handle' ? 'Link Instagram' : 'Verify Instagram'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {step === 'handle' && (
          <div className="space-y-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800 mb-2">
                🎯 <strong>Boost your match chances!</strong>
              </p>
              <p className="text-xs text-blue-700">
                Linking Instagram allows users to add you in other ways, increasing your chances of finding matches.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Instagram handle (without @)"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value.replace(/^@/, ''))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="submit"
                disabled={loading || !isValidInstagram}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Code via DM'}
              </button>
            </form>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                Code sent to @{instagramHandle} via DM
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Enter 123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg tracking-widest"
                required
              />
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
              <button
                type="button"
                onClick={() => setStep('handle')}
                className="w-full text-gray-500 py-2"
              >
                Change Instagram handle
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
