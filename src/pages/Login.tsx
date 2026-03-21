import { useState } from 'react'

interface Props {
  onSignIn: () => Promise<void>
}

export default function Login({ onSignIn }: Props) {
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    setLoading(true)
    await onSignIn()
    // loading stays true during redirect
  }

  return (
    <div className="min-h-dvh bg-cream-50 flex flex-col items-center justify-center px-6 py-12">
      {/* Decorative background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-rose-100 opacity-40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-cream-300 opacity-50 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Logo / brand mark */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-3xl bg-rose-400 flex items-center justify-center shadow-elevated mb-5 text-3xl">
            ☕
          </div>
          <h1 className="font-display text-3xl text-espresso-800 tracking-tight">
            Talia's Coffee
          </h1>
          <p className="mt-2 text-sm text-espresso-400 text-center leading-relaxed">
            A private corner for rating the coffee shops we love.
          </p>
        </div>

        {/* Sign-in card */}
        <div className="card px-8 py-8">
          <p className="text-center text-xs uppercase tracking-widest font-semibold text-espresso-400 mb-6">
            Sign in to continue
          </p>

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="btn-primary w-full gap-3 py-3.5 text-base"
          >
            {loading ? (
              <span className="w-5 h-5 rounded-full border-2 border-white border-t-rose-200 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            {loading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          <p className="mt-6 text-center text-xs text-espresso-300 leading-relaxed">
            Access is by invitation only.
            <br />
            Contact Talia to be added.
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-espresso-300">
          Talia's Coffee Ratings
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="rgba(255,255,255,0.9)"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="rgba(255,255,255,0.9)"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="rgba(255,255,255,0.9)"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="rgba(255,255,255,0.9)"/>
    </svg>
  )
}
