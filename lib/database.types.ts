export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          phone: string
          instagram_handle: string | null
          created_at: string
        }
        Insert: {
          id: string
          phone: string
          instagram_handle?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          phone?: string
          instagram_handle?: string | null
          created_at?: string
        }
      }
      contacts: {
        Row: {
          id: string
          user_id: string
          name: string
          phone: string | null
          instagram_handle: string | null
          contact_type: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          phone?: string | null
          instagram_handle?: string | null
          contact_type?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          phone?: string | null
          instagram_handle?: string | null
          contact_type?: string
          created_at?: string
        }
      }
      wishlist_entries: {
        Row: {
          id: string
          user_id: string
          contact_id: string
          slot_number: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          contact_id: string
          slot_number: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          contact_id?: string
          slot_number?: number
          created_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          user1_id: string
          user2_id: string
          contact1_id: string
          contact2_id: string
          created_at: string
          revealed_at: string | null
          is_revealed: boolean
        }
        Insert: {
          id?: string
          user1_id: string
          user2_id: string
          contact1_id: string
          contact2_id: string
          created_at?: string
          revealed_at?: string | null
          is_revealed?: boolean
        }
        Update: {
          id?: string
          user1_id?: string
          user2_id?: string
          contact1_id?: string
          contact2_id?: string
          created_at?: string
          revealed_at?: string | null
          is_revealed?: boolean
        }
      }
      slot_unlocks: {
        Row: {
          id: string
          user_id: string
          slot_number: number
          unlocks_at: string
        }
        Insert: {
          id?: string
          user_id: string
          slot_number: number
          unlocks_at: string
        }
        Update: {
          id?: string
          user_id?: string
          slot_number?: number
          unlocks_at?: string
        }
      }
      slot_locks: {
        Row: {
          id: string
          user_id: string
          slot_number: number
          locked_until: string
          reason: string
          match_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          slot_number: number
          locked_until: string
          reason: string
          match_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          slot_number?: number
          locked_until?: string
          reason?: string
          match_id?: string | null
          created_at?: string
        }
      }
      match_processing: {
        Row: {
          id: string
          last_processed_at: string
          next_processing_at: string
          created_at: string
        }
        Insert: {
          id?: string
          last_processed_at?: string
          next_processing_at: string
          created_at?: string
        }
        Update: {
          id?: string
          last_processed_at?: string
          next_processing_at?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Contact = Database['public']['Tables']['contacts']['Row']
export type WishlistEntry = Database['public']['Tables']['wishlist_entries']['Row']
export type Match = Database['public']['Tables']['matches']['Row']
export type SlotUnlock = Database['public']['Tables']['slot_unlocks']['Row']
export type SlotLock = Database['public']['Tables']['slot_locks']['Row']
export type MatchProcessing = Database['public']['Tables']['match_processing']['Row']
