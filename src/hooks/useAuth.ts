import { useEffect, useState, useCallback } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { AuthStatus } from '../lib/types'

export interface AuthState {
  session: Session | null
  user: User | null
  status: AuthStatus
  isAdmin: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [isAdmin, setIsAdmin] = useState(false)

  const checkApproval = useCallback(async (user: User) => {
    const email = user.email ?? ''
    const { data, error } = await supabase
      .from('approved_users')
      .select('is_admin')
      .eq('email', email)
      .maybeSingle()

    if (error || !data) {
      setStatus('unauthorized')
      setIsAdmin(false)
    } else {
      setStatus('authorized')
      setIsAdmin(data.is_admin ?? false)
    }
  }, [])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        checkApproval(session.user)
      } else {
        setStatus('unauthenticated')
      }
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session?.user) {
          checkApproval(session.user)
        } else {
          setStatus('unauthenticated')
          setIsAdmin(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [checkApproval])

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return {
    session,
    user: session?.user ?? null,
    status,
    isAdmin,
    signInWithGoogle,
    signOut,
  }
}
