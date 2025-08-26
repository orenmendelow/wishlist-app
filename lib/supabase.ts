import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Auth helpers
export const signInWithPhone = async (phone: string) => {
  // For now, we'll simulate SMS verification
  // Later replace with actual Twilio integration
  const { data, error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      shouldCreateUser: true,
    }
  })
  return { data, error }
}

export const verifyOtp = async (phone: string, otp: string) => {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token: otp,
    type: 'sms'
  })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

// Contact helpers for phone and Instagram
export const addPhoneContact = async (userId: string, name: string, phone: string) => {
  const { data, error } = await supabase
    .from('contacts')
    .insert({
      user_id: userId,
      name: name.trim(),
      phone: phone.replace(/\D/g, '').replace(/^1/, ''), // Normalize to 10 digits
      contact_type: 'phone'
    })
    .select()
    .single()
  return { data, error }
}

export const addInstagramContact = async (userId: string, name: string, instagramHandle: string) => {
  // Remove @ symbol if present
  const cleanHandle = instagramHandle.replace(/^@/, '').toLowerCase()
  
  const { data, error } = await supabase
    .from('contacts')
    .insert({
      user_id: userId,
      name: name.trim(),
      instagram_handle: cleanHandle,
      contact_type: 'instagram'
    })
    .select()
    .single()
  return { data, error }
}

// Find contact by phone or Instagram handle
export const findContactByIdentifier = async (userId: string, identifier: string, type: 'phone' | 'instagram') => {
  let query = supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .eq('contact_type', type)
  
  if (type === 'phone') {
    const normalizedPhone = identifier.replace(/\D/g, '').replace(/^1/, '')
    query = query.eq('phone', normalizedPhone)
  } else {
    const cleanHandle = identifier.replace(/^@/, '').toLowerCase()
    query = query.eq('instagram_handle', cleanHandle)
  }
  
  const { data, error } = await query.single()
  return { data, error }
}
