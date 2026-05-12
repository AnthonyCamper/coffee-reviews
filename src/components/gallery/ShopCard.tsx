import type { GalleryShopItem } from '../../lib/types'

interface Props {
  shop: GalleryShopItem
  onOpen: () => void
}

export default function ShopCard({ shop, onOpen }: Props) {
  const primaryPhoto = shop.photos[0]
  if (!primaryPhoto) return null

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-square bg-cream-100 rounded-2xl overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-rose-300"
      aria-label={`${shop.shop_name} — ${shop.photo_count} ${shop.photo_count === 1 ? 'photo' : 'photos'}`}
    >
      <img
        src={primaryPhoto.photo_url}
        alt={shop.shop_name}
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />

      {shop.photo_count > 1 && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 z-10">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <span className="text-white text-xs font-medium">{shop.photo_count}</span>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 sm:transition-opacity sm:duration-200 max-sm:opacity-100" />

      <div className="absolute bottom-0 left-0 right-0 px-3 py-2.5 opacity-0 group-hover:opacity-100 sm:transition-opacity sm:duration-200 max-sm:opacity-100">
        <p className="text-white text-xs font-semibold leading-tight truncate drop-shadow">
          {shop.shop_name}
        </p>
        <p className="text-white/70 text-xs truncate drop-shadow">
          {shop.review_count} {shop.review_count === 1 ? 'review' : 'reviews'}
        </p>
      </div>
    </button>
  )
}
