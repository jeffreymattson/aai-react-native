import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mxocgitdwarxhtxfjeeg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14b2NnaXRkd2FyeGh0eGZqZWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0ODExNDEsImV4cCI6MjA1ODA1NzE0MX0.kkPv8IDYyk6Z4wERchgE5av6f-J_DblBctclUyzO86c'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
