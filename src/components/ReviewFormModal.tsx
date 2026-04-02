import { useState } from 'react'
import toast from 'react-hot-toast'
import Modal from './ui/Modal'
import StarRating from './ui/StarRating'
import LocationSearch from './ui/LocationSearch'
import LocationConfirmation from './ui/LocationConfirmation'
import PhotoUpload from './ui/PhotoUpload'
import type { PlaceLocation } from '../lib/location'
import { geocodeAddress } from '../lib/location'
import type { ReviewFormData } from '../lib/types'

interface Props {
  onClose: () => void
  onSubmit: (data: ReviewFormData) => Promise<{ error: string | null }>
}

const today = new Date().toISOString().split('T')[0]

export default function ReviewFormModal({ onClose, onSubmit }: Props) {
  const [shopName, setShopName] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<PlaceLocation | null>(null)
  const [coffeeRating, setCoffeeRating] = useState(0)
  const [vibeRating, setVibeRating] = useState(0)
  const [coffeeType, setCoffeeType] = useState('')
  const [note, setNote] = useState('')
  const [visitedAt, setVisitedAt] = useState(today)
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)

  // Manual entry fallback
  const [showManual, setShowManual] = useState(false)
  const [manualAddress, setManualAddress] = useState('')
  const [manualGeoLoading, setManualGeoLoading] = useState(false)

  const handleLocationSelect = (place: PlaceLocation) => {
    setSelectedLocation(place)
    setShopName(place.name)
    setShowManual(false)
  }

  const handleLocationClear = () => {
    setSelectedLocation(null)
    setShopName('')
  }

  const handleManualGeocode = async () => {
    if (!manualAddress.trim()) return
    setManualGeoLoading(true)
    try {
      const place = await geocodeAddress(manualAddress)
      if (place) {
        place.source = 'manual'
        setSelectedLocation(place)
        setShopName(prev => prev || place.name)
        setShowManual(false)
        toast.success('Location found!')
      } else {
        toast.error('Could not find that address. Try a more specific address.')
      }
    } catch {
      toast.error('Geocoding failed. Please try again.')
    } finally {
      setManualGeoLoading(false)
    }
  }

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault()
    if (!shopName.trim()) {
      toast.error('Please enter a shop name.')
      return
    }
    if (!selectedLocation) {
      toast.error('Please select a location from search or use current location.')
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
      address: selectedLocation?.address ?? '',
      lat: selectedLocation?.lat.toFixed(6) ?? '0',
      lng: selectedLocation?.lng.toFixed(6) ?? '0',
      coffee_rating: coffeeRating,
      vibe_rating: vibeRating,
      coffee_type: coffeeType,
      note,
      visited_at: visitedAt,
      photos,
    })
    setSubmitting(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Review added!')
    }
  }

  return (
    <Modal title="Add Review" onClose={onClose} size="md">
      {step === 1 ? (
        <form onSubmit={handleNext} className="px-6 py-5 space-y-4">
          <p className="text-xs text-espresso-400 font-medium uppercase tracking-widest">
            Step 1 of 2 — Find the shop
          </p>

          {/* Location search + confirmation */}
          <div>
            <label className="label">Coffee Shop</label>
            <LocationSearch
              onSelect={handleLocationSelect}
              selectedLocation={selectedLocation}
            />
            {selectedLocation && (
              <LocationConfirmation
                location={selectedLocation}
                onClear={handleLocationClear}
              />
            )}
          </div>

          {/* Editable shop name (pre-filled from selection, but editable) */}
          {selectedLocation && (
            <div>
              <label className="label" htmlFor="shop-name">Shop Name</label>
              <input
                id="shop-name"
                type="text"
                className="input"
                value={shopName}
                onChange={e => setShopName(e.target.value)}
                placeholder="Shop name"
              />
              <p className="text-[10px] text-espresso-300 mt-1">
                Edit if the name doesn't look right
              </p>
            </div>
          )}

          {/* Manual entry fallback */}
          {!selectedLocation && (
            <div className="pt-1">
              {!showManual ? (
                <button
                  type="button"
                  onClick={() => setShowManual(true)}
                  className="text-xs text-espresso-300 hover:text-espresso-500 transition-colors"
                >
                  Can't find it? Enter manually
                </button>
              ) : (
                <div className="space-y-3 bg-cream-50 rounded-2xl p-4">
                  <p className="text-xs text-espresso-400 font-medium">Manual entry</p>
                  <div>
                    <label className="label" htmlFor="manual-name">Shop Name</label>
                    <input
                      id="manual-name"
                      type="text"
                      className="input"
                      value={shopName}
                      onChange={e => setShopName(e.target.value)}
                      placeholder="Proud Mary, Seven Seeds…"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="manual-address">Address</label>
                    <div className="flex gap-2">
                      <input
                        id="manual-address"
                        type="text"
                        className="input flex-1"
                        value={manualAddress}
                        onChange={e => setManualAddress(e.target.value)}
                        placeholder="123 Coffee Lane, Melbourne"
                      />
                      <button
                        type="button"
                        onClick={handleManualGeocode}
                        disabled={manualGeoLoading || !manualAddress.trim()}
                        className="btn-secondary px-3 py-3 text-xs whitespace-nowrap flex-shrink-0"
                      >
                        {manualGeoLoading ? '…' : 'Find'}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowManual(false)}
                    className="text-xs text-espresso-300 hover:text-espresso-500 transition-colors"
                  >
                    Back to search
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="pt-1 pb-2">
            <button type="submit" className="btn-primary w-full">
              Next
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

          {/* Selected shop summary */}
          <div className="bg-cream-50 rounded-2xl px-4 py-3">
            <p className="font-semibold text-espresso-700 text-sm">{shopName}</p>
            {selectedLocation && (
              <p className="text-xs text-espresso-400 mt-0.5 leading-relaxed">
                {selectedLocation.address}
              </p>
            )}
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
            <label className="label" htmlFor="coffee-type">What did you order? (optional)</label>
            <input
              id="coffee-type"
              type="text"
              className="input"
              maxLength={60}
              value={coffeeType}
              onChange={e => setCoffeeType(e.target.value)}
              placeholder="Flat white, oat latte, cortado…"
            />
          </div>

          <div>
            <label className="label" htmlFor="note">Note (optional)</label>
            <textarea
              id="note"
              className="input resize-none"
              rows={4}
              maxLength={5000}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What made it memorable? The flat white, the light, the music…"
            />
            {note.length > 200 && (
              <p className="text-xs text-espresso-300 text-right mt-1">{note.length}/5000</p>
            )}
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
