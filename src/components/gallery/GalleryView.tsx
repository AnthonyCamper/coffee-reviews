import { useEffect, useRef, useState } from 'react'
import { useGallery } from '../../hooks/useGallery'
import { useHistoryModal } from '../../hooks/useHistoryModal'
import { useAuthGate } from '../AuthGateModal'
import ShopCard from './ShopCard'
import ShopPhotosModal from './ShopPhotosModal'
import PhotoModal from './PhotoModal'
import type { GalleryReviewItem, GalleryShopItem } from '../../lib/types'

interface Props {
  currentUserId: string
  isAdmin: boolean
  onViewOnMap?: (shopId: string) => void
}

export default function GalleryView({ currentUserId, isAdmin, onViewOnMap }: Props) {
  const gallery = useGallery(currentUserId)
  const { requireAuth } = useAuthGate()
  const [selectedShop, setSelectedShop] = useState<GalleryShopItem | null>(null)
  const [selectedReview, setSelectedReview] = useState<GalleryReviewItem | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Browser back / swipe-back closes the deepest open modal (review > shop)
  useHistoryModal(
    !!selectedShop || !!selectedReview,
    () => {
      if (selectedReview) setSelectedReview(null)
      else setSelectedShop(null)
    },
  )

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) gallery.loadMore() },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [gallery.loadMore]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep selected shop in sync with feed updates (likes, new comments, pagination)
  const syncedShop = selectedShop
    ? (gallery.shops.find(s => s.shop_id === selectedShop.shop_id) ?? selectedShop)
    : null

  // Keep modal review data in sync with optimistic like updates
  const syncedReview = selectedReview
    ? (gallery.reviews.find(r => r.review_id === selectedReview.review_id) ?? selectedReview)
    : null

  const openPhoto = (photoId: string) => {
    const photo = gallery.photos.find(p => p.photo_id === photoId)
    if (!photo) return
    const review = gallery.reviews.find(r => r.review_id === photo.review_id)
    if (review) setSelectedReview(review)
  }

  if (gallery.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-rose-300 border-t-rose-400 animate-spin" />
      </div>
    )
  }

  if (gallery.error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <p className="text-espresso-400 text-sm">{gallery.error}</p>
      </div>
    )
  }

  if (gallery.shops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="text-5xl mb-4">📷</div>
        <h3 className="font-display text-lg text-espresso-700 mb-2">No photos yet</h3>
        <p className="text-sm text-espresso-400 max-w-xs leading-relaxed">
          Upload photos when you add a review — they'll appear here.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-4 pb-safe-8">
        {/* Compact filter/title row */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-semibold text-espresso-700">
            {gallery.shops.length} {gallery.shops.length === 1 ? 'location' : 'locations'}
          </h2>
        </div>

        {/* Shop grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {gallery.shops.map(shop => (
            <ShopCard
              key={shop.shop_id}
              shop={shop}
              onOpen={() => setSelectedShop(shop)}
            />
          ))}
        </div>

        {/* Infinite scroll sentinel */}
        {gallery.hasMore && (
          <div ref={sentinelRef} className="flex justify-center py-6">
            {gallery.loadingMore && (
              <div className="w-6 h-6 rounded-full border-2 border-rose-300 border-t-rose-400 animate-spin" />
            )}
          </div>
        )}

        {!gallery.hasMore && gallery.shops.length > 0 && (
          <p className="text-center text-xs text-espresso-300 py-6">All caught up ☕</p>
        )}
      </div>

      {/* Shop photos modal */}
      {syncedShop && (
        <ShopPhotosModal
          shop={syncedShop}
          onClose={() => setSelectedShop(null)}
          onPhotoOpen={openPhoto}
          onViewOnMap={onViewOnMap}
        />
      )}

      {/* Per-review photo modal (opens on top of the shop modal) */}
      {syncedReview && (
        <PhotoModal
          review={syncedReview}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={() => setSelectedReview(null)}
          onLike={() => { if (requireAuth()) gallery.toggleLike(syncedReview.review_id) }}
          onCommentAdded={() => gallery.refreshReview(syncedReview.review_id)}
          onViewOnMap={onViewOnMap ? (shopId) => { setSelectedReview(null); setSelectedShop(null); onViewOnMap(shopId) } : undefined}
        />
      )}
    </>
  )
}
