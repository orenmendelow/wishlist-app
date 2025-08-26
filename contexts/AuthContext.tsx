'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { Profile } from '@/lib/database.types'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signInWithPhone: (phone: string) => Promise<{ error: any }>
  verifyOtp: (phone: string, otp: string) => Promise<{ error: any }>
  linkInstagram: (handle: string) => Promise<{ error: any }>
  verifyInstagramOtp: (handle: string, otp: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)

  // Mock sign in - accepts any phone
  const signInWithPhone = async (phone: string) => {
    return { error: null }
  }

  // Mock Instagram linking - accepts any handle
  const linkInstagram = async (handle: string) => {
    return { error: null }
  }

  // Mock OTP verification - accepts '123456' for any phone
  const verifyOtp = async (phone: string, otp: string) => {
    if (otp === '123456') {
      // Create mock user with normalized phone
      const normalizedPhone = phone.replace(/\D/g, '')
      
      // Check if profile exists first
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', normalizedPhone)
        .single()
      
      let finalProfile
      let userId
      
      if (existingProfile) {
        // Existing user - use existing profile
        finalProfile = existingProfile
        userId = existingProfile.id
      } else {
        // New user - create profile
        userId = crypto.randomUUID()
        finalProfile = {
          id: userId,
          phone: normalizedPhone,
          instagram_handle: null,
          created_at: new Date().toISOString()
        }
        
        const { error: profileError } = await supabase
          .from('profiles')
          .insert(finalProfile)
        
        if (profileError) {
          console.error('Profile creation failed:', profileError)
          return { error: profileError }
        }
      }
      
      const fakeUser = {
        id: userId,
        phone: normalizedPhone,
        email: `${normalizedPhone}@wishlist.app`,
        user_metadata: { phone: normalizedPhone },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        role: 'authenticated'
      } as any
      
      setUser(fakeUser)
      setProfile(finalProfile)
      localStorage.setItem('wishlist_user', JSON.stringify(fakeUser))
      localStorage.setItem('wishlist_profile', JSON.stringify(finalProfile))
      
      return { error: null }
    }
    return { error: { message: 'Invalid verification code' } }
  }

  // Mock Instagram OTP verification - accepts '123456' and updates profile
  const verifyInstagramOtp = async (handle: string, otp: string) => {
    if (otp === '123456' && user && profile) {
      // Update profile with Instagram handle
      const updatedProfile = {
        ...profile,
        instagram_handle: handle
      }
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ instagram_handle: handle })
        .eq('id', user.id)
      
      if (updateError) {
        console.error('Instagram linking failed:', updateError)
        return { error: updateError }
      }
      
      setProfile(updatedProfile)
      localStorage.setItem('wishlist_profile', JSON.stringify(updatedProfile))
      
      return { error: null }
    }
    return { error: { message: 'Invalid verification code' } }
  }

  // Sign out - clear all data
  const signOut = async () => {
    setUser(null)
    setProfile(null)
    localStorage.removeItem('wishlist_user')
    localStorage.removeItem('wishlist_profile')
  }

  // Restore session from localStorage on mount
  useEffect(() => {
    const restoreSession = async () => {
      const savedUser = localStorage.getItem('wishlist_user')
      const savedProfile = localStorage.getItem('wishlist_profile')
      
      if (savedUser && savedProfile) {
        const user = JSON.parse(savedUser)
        const profile = JSON.parse(savedProfile)
        
        // Verify profile still exists in database
        const { data: dbProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (dbProfile) {
          setUser(user)
          setProfile(dbProfile)
        } else {
          // Profile doesn't exist, clear localStorage
          localStorage.removeItem('wishlist_user')
          localStorage.removeItem('wishlist_profile')
        }
      }
    }
    
    restoreSession()
  }, [])

  const value = {
    user,
    profile,
    loading,
    signInWithPhone,
    verifyOtp,
    linkInstagram,
    verifyInstagramOtp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
