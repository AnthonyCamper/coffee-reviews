import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, Marker } from 'leaflet'
import StarRating from './ui/StarRating'
import ReviewCard from './ReviewCard'
import type { ShopWithReviews, Review } from '../lib/types'

interface Props {
  shops: ShopWithReviews[]
  loading: boolean
  currentUserId: string
  isAdmin: boolean
  onUpdate: (id: string, data: Partial<{ coffee_rating: number; vibe_rating: number; note: string; visited_at: string }>) => Promise<{ error: string | null }>
  onDelete: (id: string) => Promise<{ error: string | null }>
}

export default function MapView({ shops, loading, currentUserId, isAdmin, onUpdate, onDelete }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const [selectedShop, setSelectedShop] = useState<ShopWithReviews | null>(null)

  const shopsWithReviews = shops.filter(s => s.reviews.length > 0)

  useEffect(() => {
    if (!mapRef.current) return

    // Dynamically import Leaflet to avoid SSR issues
    import('leaflet').then(L => {
      if (leafletRef.current) return // already initialized

      const defaultCenter: [number, number] = [-37.8136, 144.9631] // Melbourne default
      const map = L.map(mapRef.current!, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      leafletRef.current = map
    })

    return () => {
      if (leafletRef.current) {
        leafletRef.current.remove()
        leafletRef.current = null
      }
    }
  }, [])

  // Update markers when shops change
  useEffect(() => {
    if (!leafletRef.current) return

    import('leaflet').then(L => {
      const map = leafletRef.current!

      // Remove old markers
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      const bounds: [number, number][] = []

      shopsWithReviews.forEach(shopData => {
        const { shop, avg_coffee, avg_vibe } = shopData
        bounds.push([shop.lat, shop.lng])

        const icon = createPinIcon(L, avg_coffee, avg_vibe)
        const marker = L.marker([shop.lat, shop.lng], { icon })
          .addTo(map)
          .on('click', () => setSelectedShop(shopData))

        markersRef.current.push(marker)
      })

      if (bounds.length > 0) {
        map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40], maxZoom: 15 })
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopsWithReviews.length, shopsWithReviews.map(s => s.shop.id).join(',')])

  return (
    <div className="relative h-[calc(100dvh-64px)]">
      {/* Map container */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-cream-50/60 flex items-center justify-center z-10">
          <div className="w-8 h-8 rounded-full border-2 border-rose-300 border-t-rose-400 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && shopsWithReviews.length === 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl px-6 py-5 shadow-card text-center">
            <div className="text-3xl mb-2">📍</div>
            <p className="text-sm font-semibold text-espresso-700">No shops on the map yet</p>
            <p className="text-xs text-espresso-400 mt-1">Add a review to see it here</p>
          </div>
        </div>
      )}

      {/* Shop detail panel — slides up from bottom */}
      {selectedShop && (
        <ShopPanel
          shopData={selectedShop}
          onClose={() => setSelectedShop(null)}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createPinIcon(L: any, avgCoffee: number, avgVibe: number) {
  const score = ((avgCoffee + avgVibe) / 2).toFixed(1)
  return L.divIcon({
    className: '',
    iconSize: [44, 52],
    iconAnchor: [22, 52],
    html: `
      <div style="
        width:44px;
        display:flex;
        flex-direction:column;
        align-items:center;
        filter: drop-shadow(0 4px 8px rgba(154,122,92,0.3));
      ">
        <div style="
          background: white;
          border: 2px solid #fda4af;
          border-radius: 12px;
          padding: 4px 6px;
          font-size: 11px;
          font-weight: 700;
          color: #5c4029;
          white-space: nowrap;
          line-height: 1;
          font-family: Inter, system-ui, sans-serif;
        ">☕ ${score}</div>
        <div style="
          width: 10px;
          height: 10px;
          background: #fda4af;
          clip-path: polygon(0 0, 100% 0, 50% 100%);
          margin-top: -1px;
        "></div>
      </div>
    `,
  })
}

interface ShopPanelProps {
  shopData: ShopWithReviews
  onClose: () => void
  currentUserId: string
  isAdmin: boolean
  onUpdate: Props['onUpdate']
  onDelete: Props['onDelete']
}

function ShopPanel({ shopData, onClose, currentUserId, isAdmin, onUpdate, onDelete }: ShopPanelProps) {
  const { shop, reviews, avg_coffee, avg_vibe } = shopData

  return (
    <>
      {/* Backdrop on mobile */}
      <div
        className="absolute inset-0 z-20 sm:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute bottom-0 left-0 right-0 z-30 sm:left-auto sm:top-4 sm:right-4 sm:bottom-auto sm:w-80 bg-white rounded-t-3xl sm:rounded-3xl shadow-elevated animate-slide-up max-h-[60dvh] sm:max-h-[calc(100dvh-120px)] flex flex-col">
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-8 h-1 rounded-full bg-cream-300" />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-3 border-b border-cream-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-espresso-800 leading-snug">
              {shop.name}
            </h3>
            <p className="text-xs text-espresso-400 mt-0.5">{shop.address}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {reviews.length > 1 && (
                <span className="text-xs text-espresso-300">avg of {reviews.length}</span>
              )}
              <span className="rating-coffee">
                ☕ <StarRating value={avg_coffee} size="sm" />
                <span className="ml-0.5">{avg_coffee.toFixed(1)}</span>
              </span>
              <span className="rating-vibe">
                ✨ <StarRating value={avg_vibe} size="sm" />
                <span className="ml-0.5">{avg_vibe.toFixed(1)}</span>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-espresso-400 hover:bg-cream-100 transition-colors text-lg leading-none flex-shrink-0 mt-0.5"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Reviews */}
        <div className="overflow-y-auto px-5 pb-5 divide-y divide-cream-100">
          {reviews.map((review: Review) => (
            <ReviewCard
              key={review.id}
              review={review}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onUpdate={onUpdate}
              onDelete={onDelete}
              compact
            />
          ))}
        </div>
      </div>
    </>
  )
}
