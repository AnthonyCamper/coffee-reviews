import { useState, useEffect, useRef, useCallback } from 'react'
import * as loc from '../../lib/location'
import type { PlaceLocation, PlacePrediction } from '../../lib/location'

interface Props {
  onSelect: (place: PlaceLocation) => void
  selectedLocation: PlaceLocation | null
}

export default function LocationSearch({ onSelect, selectedLocation }: Props) {
  const [query, setQuery] = useState('')
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [nearbyMode, setNearbyMode] = useState(false)
  const [sessionToken, setSessionToken] = useState(() => loc.generateSessionToken())

  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Get user location silently on mount
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 5000 },
    )
  }, [])

  const searchWithLocation = useCallback(
    async (input: string, locationOverride?: { lat: number; lng: number }) => {
      if (input.trim().length < 2) {
        setPredictions([])
        setOpen(false)
        return
      }

      setLoading(true)
      try {
        const results = await loc.autocomplete(input, {
          userLocation: locationOverride ?? userLocation ?? undefined,
          sessionToken,
        })
        setPredictions(results)
        setOpen(true)
        setActiveIndex(-1)
      } catch {
        setPredictions([])
        setOpen(false)
      } finally {
        setLoading(false)
      }
    },
    [userLocation, sessionToken],
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setGeoError(null)
    setNearbyMode(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchWithLocation(val), 300)
  }

  const handleSelectPrediction = async (pred: PlacePrediction) => {
    setOpen(false)
    setPredictions([])
    setDetailsLoading(true)

    try {
      const details = await loc.getPlaceDetails(pred.placeId, sessionToken)
      if (pred.distance != null) details.distance = pred.distance
      details.source = 'search'
      onSelect(details)
      setQuery('')
      setSessionToken(loc.generateSessionToken())
    } catch {
      setPredictions([pred])
      setOpen(true)
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleUseCurrentLocation = async () => {
    if (geoLoading) return
    setGeoLoading(true)
    setGeoError(null)

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      })

      const { latitude, longitude } = pos.coords
      const coords = { lat: latitude, lng: longitude }
      setUserLocation(coords)

      // Fetch nearby coffee shops and show them as results
      const nearby = await loc.searchNearby(coords)
      setPredictions(nearby)
      setNearbyMode(true)
      setOpen(nearby.length > 0)
      setActiveIndex(-1)
      setQuery('')
    } catch (err) {
      const geo = err as GeolocationPositionError
      if (geo?.code === 1) {
        setGeoError('Location permission denied. Please enable in Settings.')
      } else {
        setGeoError('Could not get your location. Please try again.')
      }
    } finally {
      setGeoLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, predictions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelectPrediction(predictions[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        resultsRef.current &&
        !resultsRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Don't render search UI when a location is already selected
  if (selectedLocation) return null

  return (
    <div>
      {/* Loading overlay for fetching place details */}
      {detailsLoading && (
        <div className="flex items-center justify-center py-6">
          <div className="flex items-center gap-2 text-sm text-espresso-400">
            <div className="w-4 h-4 border-2 border-rose-300 border-t-rose-400 rounded-full animate-spin" />
            Loading details…
          </div>
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="input pl-10 pr-10"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          placeholder="Search for a coffee shop…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-espresso-300 pointer-events-none">
          <svg className="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        {loading && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-rose-300 border-t-rose-400 rounded-full animate-spin" />
        )}
        {!loading && userLocation && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-espresso-300 pointer-events-none" title="Searching near you">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        )}
      </div>

      {/* Use current location — searches for nearby coffee shops */}
      {!open && !query && !geoLoading && (
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={geoLoading}
          className="mt-2 w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-cream-50 hover:bg-cream-100 active:bg-cream-200 transition-colors text-left"
        >
          <span className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
            {geoLoading ? (
              <div className="w-4 h-4 border-2 border-rose-300 border-t-rose-400 rounded-full animate-spin" />
            ) : (
              <svg className="w-4.5 h-4.5 text-rose-400" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-espresso-700">Coffee shops near me</p>
            <p className="text-xs text-espresso-400">Uses your location to find nearby shops</p>
          </div>
        </button>
      )}

      {/* Geo error */}
      {geoError && (
        <p className="mt-2 text-xs text-red-500 px-1">{geoError}</p>
      )}

      {/* Predictions list — rendered inline (not absolute) to prevent double-scroll
          inside modals. overscroll-behavior prevents scroll chaining to parent. */}
      {open && predictions.length > 0 && (
        <div
          ref={resultsRef}
          className="mt-2 bg-white rounded-2xl shadow-elevated border border-cream-200 overflow-hidden"
          role="listbox"
        >
          {nearbyMode && (
            <div className="px-4 pt-3 pb-1.5">
              <p className="text-[10px] font-semibold text-espresso-300 uppercase tracking-widest">Nearby</p>
            </div>
          )}
          <div
            className="overflow-y-auto"
            style={{
              maxHeight: 'min(320px, 50dvh)',
              overscrollBehaviorY: 'contain',
            }}
          >
            {predictions.map((pred, i) => (
              <button
                key={pred.placeId}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={() => handleSelectPrediction(pred)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors border-b border-cream-50 last:border-0 ${
                  i === activeIndex ? 'bg-cream-50' : 'hover:bg-cream-50/60'
                }`}
              >
                <span className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-espresso-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-espresso-700 leading-snug">{pred.name}</p>
                  {pred.secondaryText && (
                    <p className="text-xs text-espresso-400 mt-0.5 leading-snug line-clamp-2">
                      {pred.secondaryText}
                    </p>
                  )}
                </div>
                {pred.distance != null && (
                  <span className="text-xs text-espresso-300 whitespace-nowrap flex-shrink-0 mt-1 tabular-nums">
                    {loc.formatDistance(pred.distance)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Google attribution (required by ToS) */}
          <div className="px-4 py-2 bg-white border-t border-cream-50 flex justify-end">
            <span className="text-[10px] text-espresso-300">Powered by Google</span>
          </div>
        </div>
      )}

      {/* No results */}
      {open && predictions.length === 0 && query.trim().length >= 2 && !loading && (
        <div className="mt-2 bg-white rounded-2xl shadow-elevated border border-cream-200 px-4 py-6 text-center">
          <p className="text-sm text-espresso-500">No places found</p>
          <p className="text-xs text-espresso-300 mt-1">Try a different name or address</p>
        </div>
      )}
    </div>
  )
}
