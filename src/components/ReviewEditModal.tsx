import { useState } from 'react'
import Modal from './ui/Modal'
import StarRating from './ui/StarRating'
import PhotoUpload from './ui/PhotoUpload'
import type { Review, ReviewPhoto, ReviewUpdateData } from '../lib/types'

interface Props {
  review: Review
  onClose: () => void
  onSubmit: (data: ReviewUpdateData) => Promise<void>
}

export default function ReviewEditModal({ review, onClose, onSubmit }: Props) {
  const [coffeeRating, setCoffeeRating] = useState(review.coffee_rating)
  const [vibeRating, setVibeRating] = useState(review.vibe_rating)
  const [note, setNote] = useState(review.note ?? '')
  const [visitedAt, setVisitedAt] = useState(review.visited_at.split('T')[0])

  // Photo editing state
  const [existingPhotos, setExistingPhotos] = useState<ReviewPhoto[]>(review.photos ?? [])
  const [deletedPhotoIds, setDeletedPhotoIds] = useState<string[]>([])
  const [newPhotos, setNewPhotos] = useState<File[]>([])

  const [submitting, setSubmitting] = useState(false)

  const totalPhotos = existingPhotos.length + newPhotos.length
  const remainingSlots = Math.max(0, 5 - totalPhotos)

  const removeExisting = (photoId: string) => {
    setExistingPhotos(prev => prev.filter(p => p.id !== photoId))
    setDeletedPhotoIds(prev => [...prev, photoId])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    await onSubmit({
      coffee_rating: coffeeRating,
      vibe_rating: vibeRating,
      note,
      visited_at: visitedAt,
      photos_to_delete: deletedPhotoIds,
      new_photos: newPhotos,
    })
    setSubmitting(false)
  }

  return (
    <Modal title="Edit Review" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
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
          <label className="label" htmlFor="edit-note">Note (optional)</label>
          <textarea
            id="edit-note"
            className="input resize-none"
            rows={3}
            maxLength={280}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="What made it memorable?"
          />
        </div>

        <div>
          <label className="label" htmlFor="edit-visited">Date Visited</label>
          <input
            id="edit-visited"
            type="date"
            className="input"
            value={visitedAt}
            onChange={e => setVisitedAt(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            required
          />
        </div>

        {/* Photos */}
        <div>
          <label className="label">Photos</label>

          {/* Existing photos */}
          {existingPhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {existingPhotos.map(photo => (
                <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden bg-cream-100 group">
                  <img
                    src={photo.url}
                    alt="Review photo"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeExisting(photo.id)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new photos (only if slots remain) */}
          {remainingSlots > 0 && (
            <PhotoUpload
              files={newPhotos}
              onChange={setNewPhotos}
              max={remainingSlots}
            />
          )}

          {remainingSlots === 0 && totalPhotos >= 5 && (
            <p className="text-xs text-espresso-400 mt-1">
              Maximum 5 photos reached. Remove an existing photo to add a new one.
            </p>
          )}
        </div>

        <div className="flex gap-3 pb-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
