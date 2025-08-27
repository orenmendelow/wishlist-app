'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function AuthForm() {
  const { signInWithPhone, verifyOtp, linkInstagram, verifyInstagramOtp, loading } = useAuth()
  const [phone, setPhone] = useState('')
  const [instagramHandle, setInstagramHandle] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'phone-otp' | 'instagram-choice' | 'instagram' | 'instagram-otp'>('phone')

  // Format phone as user types: (555) 123-4567
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`
  }

  // Send phone verification
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await signInWithPhone(phone)
    setStep('phone-otp')
  }

  // Verify phone OTP
  const handlePhoneOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await verifyOtp(phone, otp)
    if (error) {
      alert('Invalid code. Use 123456')
    } else {
      setOtp('')
      setStep('instagram-choice')
    }
  }

  // Handle Instagram choice
  const handleInstagramChoice = (choice: 'link' | 'skip') => {
    if (choice === 'link') {
      setStep('instagram')
    } else {
      // Mark Instagram as skipped so user won't be asked again
      localStorage.setItem('instagram_skipped', 'true')
      // Complete login without Instagram
      window.location.reload() // This will trigger the auth context to refresh
    }
  }

  // Send Instagram verification
  const handleInstagramSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await linkInstagram(instagramHandle)
    setStep('instagram-otp')
  }

  // Verify Instagram OTP
  const handleInstagramOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await verifyInstagramOtp(instagramHandle, otp)
    if (error) {
      alert('Invalid code. Use 123456')
    } else {
      // Complete login with Instagram linked
      window.location.reload()
    }
  }

  const isValidPhone = phone.replace(/\D/g, '').length === 10
  const isValidInstagram = instagramHandle.trim().length > 0

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Wishlist</h1>
          <p className="mt-2 text-gray-600">
            {step === 'phone' && 'Enter your phone number'}
            {step === 'phone-otp' && 'Enter verification code'}
            {step === 'instagram-choice' && 'Link your Instagram?'}
            {step === 'instagram' && 'Enter your Instagram handle'}
            {step === 'instagram-otp' && 'Enter Instagram verification code'}
          </p>
        </div>

        {step === 'phone' && (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <input
              type="tel"
              placeholder="Phone number"
              value={formatPhone(phone)}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={14}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              disabled={loading || !isValidPhone}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Code via SMS'}
            </button>
          </form>
        )}

        {step === 'phone-otp' && (
          <form onSubmit={handlePhoneOtpSubmit} className="space-y-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                Code sent to {formatPhone(phone)}
              </p>
            </div>
            
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
              onClick={() => setStep('phone')}
              className="w-full text-gray-500 py-2"
            >
              Change phone number
            </button>
          </form>
        )}

        {step === 'instagram-choice' && (
          <div className="space-y-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800 mb-2">
                🎯 <strong>Boost your match chances!</strong>
              </p>
              <p className="text-xs text-blue-700">
                Linking Instagram allows users to add you in other ways, increasing your chances of finding matches.
              </p>
            </div>
            
            <button
              onClick={() => handleInstagramChoice('link')}
              className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600"
            >
              📸 Link Instagram
            </button>
            
            <div className="space-y-2">
              <button
                onClick={() => handleInstagramChoice('skip')}
                className="w-full text-gray-500 py-2 text-sm"
              >
                Skip for now
              </button>
              <button
                onClick={() => handleInstagramChoice('skip')}
                className="w-full text-gray-500 py-2 text-sm"
              >
                I don&apos;t have Instagram
              </button>
            </div>
          </div>
        )}

        {step === 'instagram' && (
          <form onSubmit={handleInstagramSubmit} className="space-y-4">
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
            <button
              type="button"
              onClick={() => setStep('instagram-choice')}
              className="w-full text-gray-500 py-2"
            >
              Back
            </button>
          </form>
        )}

        {step === 'instagram-otp' && (
          <form onSubmit={handleInstagramOtpSubmit} className="space-y-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                Code sent to @{instagramHandle} via DM
              </p>
            </div>
            
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
              onClick={() => setStep('instagram')}
              className="w-full text-gray-500 py-2"
            >
              Change Instagram handle
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
