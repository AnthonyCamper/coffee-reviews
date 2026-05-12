import { useEffect } from 'react'
import type { GalleryShopItem } from '../../lib/types'

interface Props {
  shop: GalleryShopItem
  onClose: () => void
  onPhotoOpen: (photoId: string) => void
  onViewOnMap?: (shopId: string) => void
}

export default function ShopPhotosModal({ shop, onClose, onPhotoOpen, onViewOnMap }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up
                   h-[92dvh] sm:max-h-[86dvh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-cream-100">
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-espresso-800 truncate">{shop.shop_name}</p>
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <p className="text-xs text-espresso-400 truncate">{shop.shop_address}</p>
              {onViewOnMap && (
                <button
                  onClick={() => onViewOnMap(shop.shop_id)}
                  className="flex-shrink-0 flex items-center gap-1 text-xs text-rose-400 hover:text-rose-500 font-medium transition-colors"
                  aria-label="View on map"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Map
                </button>
              )}
            </div>
            <p className="text-xs text-espresso-300 mt-1">
              {shop.photo_count} {shop.photo_count === 1 ? 'photo' : 'photos'}
              {' · '}
              {shop.review_count} {shop.review_count === 1 ? 'review' : 'reviews'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-espresso-400 hover:bg-cream-100 transition-colors text-lg leading-none flex-shrink-0"
            aria-label="Close"
          >×</button>
        </div>

        {/* Photo grid */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3">
          <div className="grid grid-cols-3 gap-1.5">
            {shop.photos.map(photo => (
              <button
                key={photo.photo_id}
                type="button"
                onClick={() => onPhotoOpen(photo.photo_id)}
                className="relative aspect-square rounded-xl overflow-hidden bg-cream-100 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-rose-300"
              >
                <img
                  src={photo.photo_url}
                  alt={shop.shop_name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
