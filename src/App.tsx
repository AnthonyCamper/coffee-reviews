import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Home from './pages/Home'
import Unauthorized from './pages/Unauthorized'

export default function App() {
  const auth = useAuth()

  // Shared loading screen while checking auth state
  if (auth.status === 'loading') {
    return (
      <div className="min-h-dvh bg-cream-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-rose-300 border-t-rose-400 animate-spin" />
          <p className="text-sm text-espresso-400 font-medium">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Toaster
        position="top-center"
        gutter={8}
        containerStyle={{ top: 20 }}
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#3d2b1a',
            borderRadius: '16px',
            boxShadow: '0 8px 40px 0 rgba(154, 122, 92, 0.16)',
            fontSize: '14px',
            fontWeight: '500',
            padding: '12px 16px',
          },
          success: {
            iconTheme: { primary: '#f43f5e', secondary: '#fff' },
          },
        }}
      />

      <Routes>
        <Route
          path="/"
          element={
            auth.status === 'unauthenticated' ? (
              <Login onSignIn={auth.signInWithGoogle} />
            ) : auth.status === 'unauthorized' ? (
              <Unauthorized onSignOut={auth.signOut} email={auth.user?.email ?? ''} />
            ) : (
              <Home auth={auth} />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
