import { useState } from 'react'
import toast from 'react-hot-toast'
import { useReviews } from '../hooks/useReviews'
import Layout from '../components/Layout'
import ListView from '../components/ListView'
import MapView from '../components/MapView'
import GalleryView from '../components/gallery/GalleryView'
import ReviewFormModal from '../components/ReviewFormModal'
import type { AuthState } from '../hooks/useAuth'

type HomeProps = { auth: AuthState; readOnly?: boolean }

export default function Home({ auth, readOnly = false }: HomeProps) {
  const reviews = useReviews()
  const [view, setView] = useState<'list' | 'map' | 'gallery'>('list')
  const [showAddModal, setShowAddModal] = useState(false)

  return (
    <Layout
      auth={auth}
      view={view}
      onViewChange={setView}
      onAddReview={() => {
          if (!auth.canLeaveReviews) {
            toast.error("Talia hasn't enabled reviews for your account yet.")
            return
          }
          setShowAddModal(true)
        }}
      readOnly={readOnly}
    >
      {view === 'list' && (
        <ListView
          shops={reviews.shops}
          loading={reviews.loading}
          error={reviews.error}
          currentUserId={auth.user?.id ?? ''}
          isAdmin={auth.isAdmin}
          onUpdate={reviews.updateReview}
          onDelete={reviews.deleteReview}
        />
      )}
      {view === 'map' && (
        <MapView
          shops={reviews.shops}
          loading={reviews.loading}
          currentUserId={auth.user?.id ?? ''}
          isAdmin={auth.isAdmin}
          onUpdate={reviews.updateReview}
          onDelete={reviews.deleteReview}
        />
      )}
      {view === 'gallery' && (
        <GalleryView
          currentUserId={auth.user?.id ?? ''}
          isAdmin={auth.isAdmin}
        />
      )}

      {showAddModal && (
        <ReviewFormModal
          onClose={() => setShowAddModal(false)}
          onSubmit={async (data) => {
            const result = await reviews.createReview(data, auth.user?.id ?? '')
            if (!result.error) setShowAddModal(false)
            return result
          }}
        />
      )}
    </Layout>
  )
}
