import { useState } from 'react'
import { useReviews } from '../hooks/useReviews'
import Layout from '../components/Layout'
import ListView from '../components/ListView'
import MapView from '../components/MapView'
import ReviewFormModal from '../components/ReviewFormModal'
import type { AuthState } from '../hooks/useAuth'

type HomeProps = { auth: AuthState }

export default function Home({ auth }: HomeProps) {
  const reviews = useReviews()
  const [view, setView] = useState<'list' | 'map'>('list')
  const [showAddModal, setShowAddModal] = useState(false)

  return (
    <Layout
      auth={auth}
      view={view}
      onViewChange={setView}
      onAddReview={() => setShowAddModal(true)}
    >
      {view === 'list' ? (
        <ListView
          shops={reviews.shops}
          loading={reviews.loading}
          error={reviews.error}
          currentUserId={auth.user?.id ?? ''}
          isAdmin={auth.isAdmin}
          onUpdate={reviews.updateReview}
          onDelete={reviews.deleteReview}
        />
      ) : (
        <MapView
          shops={reviews.shops}
          loading={reviews.loading}
          currentUserId={auth.user?.id ?? ''}
          isAdmin={auth.isAdmin}
          onUpdate={reviews.updateReview}
          onDelete={reviews.deleteReview}
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
