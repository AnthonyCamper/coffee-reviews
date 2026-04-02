import { useEffect, useRef } from 'react'
import type { PlaceLocation } from '../../lib/location'
import { formatDistance } from '../../lib/location'

interface Props {
  location: PlaceLocation
  onClear: () => void
}

const SOURCE_LABELS: Record<string, string> = {
  search: 'Searched',
  current_location: 'Current location',
  manual: 'Manual entry',
}

export default function LocationConfirmation({ location, onClear }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapContainerRef.current) return

      // Clean up previous map
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }

      const map = L.map(mapContainerRef.current, {
        center: [location.lat, location.lng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width: 36px; height: 36px;
          background: #fb7185;
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          display: flex; align-items: center; justify-content: center;
        "><span style="transform: rotate(45deg); font-size: 16px; line-height: 1;">☕</span></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      })

      L.marker([location.lat, location.lng], { icon }).addTo(map)

      mapInstanceRef.current = map
      setTimeout(() => map.invalidateSize(), 50)
    }

    init()

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [location.lat, location.lng])

  const sourceLabel = SOURCE_LABELS[location.source] ?? ''

  return (
    <div className="bg-cream-50 rounded-2xl overflow-hidden border border-cream-200">
      {/* Mini map */}
      <div
        ref={mapContainerRef}
        className="w-full bg-cream-100"
        style={{ height: '140px' }}
        aria-label={`Map showing ${location.name}`}
      />

      {/* Location details */}
      <div className="px-4 py-3 space-y-2.5">
        <div className="min-w-0">
          <p className="text-sm font-bold text-espresso-700 leading-snug">
            {location.name}
          </p>
          <p className="text-xs text-espresso-500 mt-0.5 leading-relaxed">
            {location.address}
          </p>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {sourceLabel && (
              <span className="text-[10px] text-espresso-300 uppercase tracking-wider font-medium bg-cream-100 px-1.5 py-0.5 rounded">
                {sourceLabel}
              </span>
            )}
            {location.distance != null && location.distance > 0 && (
              <span className="text-[10px] text-espresso-300 uppercase tracking-wider font-medium bg-cream-100 px-1.5 py-0.5 rounded tabular-nums">
                {formatDistance(location.distance)}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClear}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-cream-100 hover:bg-cream-200 active:bg-cream-300 text-xs font-medium text-espresso-500 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search for a different shop
        </button>
      </div>
    </div>
  )
}
