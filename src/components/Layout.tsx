import { ReactNode, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AuthState } from '../hooks/useAuth'
import ProfileModal from './ProfileModal'

type View = 'list' | 'map' | 'gallery'

interface Props {
  auth: AuthState
  view: View
  onViewChange: (v: View) => void
  onAddReview: () => void
  readOnly?: boolean
  children: ReactNode
}

const VIEWS: { key: View; label: string }[] = [
  { key: 'list',    label: '☰ List'    },
  { key: 'map',     label: '🗺 Map'    },
  { key: 'gallery', label: '📷 Photos' },
]

export default function Layout({ auth, view, onViewChange, onAddReview, readOnly = false, children }: Props) {
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)

  const user = auth.user
  const profile = auth.profile
  const avatar = profile?.avatar_url ?? (user?.user_metadata?.avatar_url as string | undefined)
  const name = profile?.display_name ?? profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? ''
  const email = user?.email ?? ''

  return (
    <div className="min-h-dvh flex flex-col bg-cream-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-cream-50/90 backdrop-blur-md border-b border-cream-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl">☕</span>
            <h1 className="font-display text-lg text-espresso-800 truncate leading-tight">
              Talia's Coffee
            </h1>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-cream-100 rounded-xl p-1 border border-cream-200">
            {VIEWS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => onViewChange(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  view === key
                    ? 'bg-white text-espresso-700 shadow-soft'
                    : 'text-espresso-400 hover:text-espresso-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Profile / Sign in */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-cream-200 hover:ring-rose-300 transition-all flex items-center justify-center bg-cream-200 flex-shrink-0"
                aria-label="Profile menu"
              >
                {avatar ? (
                  <img src={avatar} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-semibold text-espresso-600">
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
              </button>

              {profileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-elevated border border-cream-100 overflow-hidden z-50 animate-slide-up">
                    <div className="px-4 py-3 border-b border-cream-100">
                      <p className="text-sm font-semibold text-espresso-700 truncate">{name}</p>
                      <p className="text-xs text-espresso-400 truncate mt-0.5">{email}</p>
                      {auth.isAdmin && (
                        <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-600">
                          Admin
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => { setProfileOpen(false); setShowProfileModal(true) }}
                      className="w-full px-4 py-3 text-left text-sm text-espresso-600 hover:bg-cream-50 transition-colors"
                    >
                      My Profile
                    </button>

                    {auth.isAdmin && (
                      <button
                        onClick={() => { setProfileOpen(false); navigate('/admin') }}
                        className="w-full px-4 py-3 text-left text-sm text-espresso-600 hover:bg-cream-50 transition-colors border-t border-cream-100"
                      >
                        Admin Dashboard
                      </button>
                    )}

                    <button
                      onClick={async () => {
                        setProfileOpen(false)
                        await auth.signOut()
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-espresso-600 hover:bg-cream-50 transition-colors border-t border-cream-100"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="flex-1 relative">
        {children}
      </main>

      {/* ── Floating add button (hidden in read-only mode) ──────────────────── */}
      {!readOnly && user && (
        <button
          onClick={onAddReview}
          className="fixed bottom-6 right-4 z-30 w-14 h-14 rounded-full bg-rose-400 hover:bg-rose-500 active:bg-rose-600 text-white shadow-elevated flex items-center justify-center text-2xl transition-all duration-150 hover:scale-105 active:scale-95"
          aria-label="Add review"
        >
          +
        </button>
      )}

      {/* ── Profile modal ──────────────────────────────────────────────────── */}
      {showProfileModal && (
        <ProfileModal
          auth={auth}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  )
}
