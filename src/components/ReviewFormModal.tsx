import { useState } from 'react'
import toast from 'react-hot-toast'
import Modal from './ui/Modal'
import StarRating from './ui/StarRating'
import BusinessAutocomplete from './ui/BusinessAutocomplete'
import PhotoUpload from './ui/PhotoUpload'
import type { ReviewFormData } from '../lib/types'

interface Props {
  onClose: () => void
  onSubmit: (data: ReviewFormData) => Promise<{ error: string | null }>
}

const today = new Date().toISOString().split('T')[0]

export default function ReviewFormModal({ onClose, onSubmit }: Props) {
  const [shopName, setShopName] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [coffeeRating, setCoffeeRating] = useState(0)
  const [vibeRating, setVibeRating] = useState(0)
  const [note, setNote] = useState('')
  const [visitedAt, setVisitedAt] = useState(today)
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [showManual, setShowManual] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)

  const geocodeAddress = async () => {
    if (!address.trim()) return
    setGeoLoading(true)
    try {
      const encoded = encodeURIComponent(address.trim())
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`
      )
      const data = await res.json() as Array<{ lat: string; lon: string }>
      if (data[0]) {
        setLat(parseFloat(data[0].lat).toFixed(6))
        setLng(parseFloat(data[0].lon).toFixed(6))
        toast.success('Location found!')
      } else {
        toast.error('Could not find address — enter coordinates manually.')
      }
    } catch {
      toast.error('Geocoding failed — enter coordinates manually.')
    } finally {
      setGeoLoading(false)
    }
  }

  const handleAutocompleteSelect = (suggestion: { name: string; address: string; lat: string; lng: string }) => {
    setShopName(suggestion.name)
    setAddress(suggestion.address)
    setLat(parseFloat(suggestion.lat).toFixed(6))
    setLng(parseFloat(suggestion.lng).toFixed(6))
  }

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault()
    if (!shopName.trim() || !address.trim()) {
      toast.error('Please fill in shop name and address.')
      return
    }
    if (!lat || !lng) {
      toast.error('Please add a location — select from suggestions or use Find.')
      return
    }
    setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (coffeeRating === 0 || vibeRating === 0) {
      toast.error('Please set both ratings.')
      return
    }
    setSubmitting(true)
    const result = await onSubmit({
      shop_name: shopName,
      address,
      lat,
      lng,
      coffee_rating: coffeeRating,
      vibe_rating: vibeRating,
      note,
      visited_at: visitedAt,
      photos,
    })
    setSubmitting(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Review added! ☕')
    }
  }

  return (
    <Modal title="Add Review" onClose={onClose} size="md">
      {step === 1 ? (
        <form onSubmit={handleNext} className="px-6 py-5 space-y-4">
          <p className="text-xs text-espresso-400 font-medium uppercase tracking-widest">
            Step 1 of 2 — Shop details
          </p>

          {/* Autocomplete search */}
          <div>
            <label className="label" htmlFor="shop-search">Search Coffee Shop</label>
            <BusinessAutocomplete
              id="shop-search"
              value={shopName}
              onChange={setShopName}
              onSelect={handleAutocompleteSelect}
              placeholder="Proud Mary, Seven Seeds…"
            />
            {lat && lng && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <span>✓</span> Location set
              </p>
            )}
          </div>

          {/* Manual fields — collapsed by default if autocomplete filled values */}
          {!showManual && (lat || address) ? (
            <div className="bg-cream-50 rounded-2xl px-4 py-3 space-y-0.5">
              <p className="text-sm font-semibold text-espresso-700">{address}</p>
              <p className="text-xs text-espresso-400">{lat}, {lng}</p>
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="text-xs text-rose-400 hover:text-rose-500 mt-1 transition-colors"
              >
                Edit manually
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="address">Address</label>
                <div className="flex gap-2">
                  <input
                    id="address"
                    type="text"
                    className="input flex-1"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="123 Coffee Lane, Melbourne"
                  />
                  <button
                    type="button"
                    onClick={geocodeAddress}
                    disabled={geoLoading || !address.trim()}
                    className="btn-secondary px-3 py-3 text-xs whitespace-nowrap flex-shrink-0"
                  >
                    {geoLoading ? '…' : 'Find'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="lat">Latitude</label>
                  <input
                    id="lat"
                    type="number"
                    step="any"
                    className="input"
                    value={lat}
                    onChange={e => setLat(e.target.value)}
                    placeholder="-37.8136"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="lng">Longitude</label>
                  <input
                    id="lng"
                    type="number"
                    step="any"
                    className="input"
                    value={lng}
                    onChange={e => setLng(e.target.value)}
                    placeholder="144.9631"
                  />
                </div>
              </div>

              {(address || lat) && (
                <button
                  type="button"
                  onClick={() => setShowManual(false)}
                  className="text-xs text-espresso-300 hover:text-espresso-500 transition-colors"
                >
                  Collapse
                </button>
              )}
            </div>
          )}

          <div className="pt-1 pb-2">
            <button type="submit" className="btn-primary w-full">
              Next →
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-espresso-400 hover:text-espresso-600 transition-colors"
            >
              ← Back
            </button>
            <p className="text-xs text-espresso-400 font-medium uppercase tracking-widest">
              Step 2 of 2 — Your ratings
            </p>
          </div>

          <div className="bg-cream-50 rounded-2xl px-4 py-3">
            <p className="font-semibold text-espresso-700 text-sm">{shopName}</p>
            <p className="text-xs text-espresso-400 mt-0.5">{address}</p>
          </div>

          <div>
            <label className="label">Coffee Rating</label>
            <div className="flex items-center gap-3">
              <StarRating value={coffeeRating} interactive onChange={setCoffeeRating} size="lg" />
              {coffeeRating > 0 && (
                <span className="text-sm text-espresso-500 font-medium">{coffeeRating}/10</span>
              )}
            </div>
          </div>

          <div>
            <label className="label">Vibe Rating</label>
            <div className="flex items-center gap-3">
              <StarRating value={vibeRating} interactive onChange={setVibeRating} size="lg" />
              {vibeRating > 0 && (
                <span className="text-sm text-espresso-500 font-medium">{vibeRating}/10</span>
              )}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="note">Note (optional)</label>
            <textarea
              id="note"
              className="input resize-none"
              rows={3}
              maxLength={280}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What made it memorable? The flat white, the light, the music…"
            />
          </div>

          <div>
            <label className="label" htmlFor="visited">Date Visited</label>
            <input
              id="visited"
              type="date"
              className="input"
              value={visitedAt}
              onChange={e => setVisitedAt(e.target.value)}
              max={today}
              required
            />
          </div>

          <div>
            <label className="label">Photos (optional)</label>
            <PhotoUpload files={photos} onChange={setPhotos} />
          </div>

          <div className="flex gap-3 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || coffeeRating === 0 || vibeRating === 0}
              className="btn-primary flex-1"
            >
              {submitting ? 'Saving…' : 'Add Review'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
