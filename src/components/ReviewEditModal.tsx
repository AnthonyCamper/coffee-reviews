import { useState } from 'react'
import Modal from './ui/Modal'
import StarRating from './ui/StarRating'
import type { Review } from '../lib/types'

interface Props {
  review: Review
  onClose: () => void
  onSubmit: (data: {
    coffee_rating: number
    vibe_rating: number
    note: string
    visited_at: string
  }) => Promise<void>
}

export default function ReviewEditModal({ review, onClose, onSubmit }: Props) {
  const [coffeeRating, setCoffeeRating] = useState(review.coffee_rating)
  const [vibeRating, setVibeRating] = useState(review.vibe_rating)
  const [note, setNote] = useState(review.note ?? '')
  const [visitedAt, setVisitedAt] = useState(review.visited_at.split('T')[0])
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    await onSubmit({ coffee_rating: coffeeRating, vibe_rating: vibeRating, note, visited_at: visitedAt })
    setSubmitting(false)
  }

  return (
    <Modal title="Edit Review" onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
        <div>
          <label className="label">Coffee Rating</label>
          <StarRating value={coffeeRating} interactive onChange={setCoffeeRating} size="lg" />
        </div>

        <div>
          <label className="label">Vibe Rating</label>
          <StarRating value={vibeRating} interactive onChange={setVibeRating} size="lg" />
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
