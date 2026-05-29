import { createContext, useContext, useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../../supabaseClient'

interface AuthState {
  session: Session | null
  isSupabaseLoading: boolean
  initError: string | null
}

const AuthContext = createContext<AuthState>({
  session: null,
  isSupabaseLoading: true,
  initError: null,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const [isSupabaseLoading, setIsSupabaseLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setInitError('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing from runtime config.')
      setIsSupabaseLoading(false)
      return
    }

    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        setSession(session)
      } catch (err: any) {
        console.error('Supabase init error:', err)
        setInitError(err.message)
      } finally {
        setIsSupabaseLoading(false)
      }
    }

    initSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ session, isSupabaseLoading, initError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
