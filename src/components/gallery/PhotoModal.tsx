import { useEffect } from 'react'
import { format } from 'date-fns'
import StarRating from '../ui/StarRating'
import CommentSection from './CommentSection'
import HeartIcon from './HeartIcon'
import { usePhotoInteractions } from '../../hooks/usePhotoInteractions'
import type { GalleryPhoto } from '../../lib/types'

interface Props {
  photo: GalleryPhoto
  currentUserId: string
  isAdmin: boolean
  onClose: () => void
  onLike: () => void
  onCommentAdded: () => void
}

export default function PhotoModal({
  photo,
  currentUserId,
  isAdmin,
  onClose,
  onLike,
  onCommentAdded,
}: Props) {
  const interactions = usePhotoInteractions(photo.photo_id, currentUserId)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const visitedDate = (() => {
    try { return format(new Date(photo.visited_at), 'MMM d, yyyy') }
    catch { return photo.visited_at }
  })()

  const reviewerName = photo.reviewer_name ?? photo.reviewer_email?.split('@')[0] ?? 'Unknown'

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-3xl sm:rounded-3xl overflow-hidden shadow-2xl
                   flex flex-col sm:flex-row
                   max-h-[92dvh] sm:max-h-[86dvh]
                   rounded-t-3xl animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Left / Top: Photo ─────────────────────────────────────────────── */}
        <div className="sm:w-[46%] flex-shrink-0 bg-cream-100 sm:bg-black
                        flex items-center justify-center
                        aspect-video sm:aspect-auto sm:max-h-full">
          <img
            src={photo.photo_url}
            alt={photo.shop_name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* ── Right / Bottom: Details ────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-h-0">
          {/* Header: shop info + close */}
          <div className="px-4 pt-4 pb-3 border-b border-cream-100 flex items-start justify-between gap-3 flex-shrink-0">
            <div className="min-w-0">
              {/* Reviewer */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full overflow-hidden bg-cream-200 flex-shrink-0 flex items-center justify-center">
                  {photo.reviewer_avatar ? (
                    <img src={photo.reviewer_avatar} alt={reviewerName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-espresso-500">{reviewerName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-espresso-700 truncate">{reviewerName}</p>
                  <p className="text-xs text-espresso-300">{visitedDate}</p>
                </div>
              </div>

              {/* Shop */}
              <p className="font-display text-sm font-semibold text-espresso-800 truncate">{photo.shop_name}</p>
              <p className="text-xs text-espresso-400 truncate mt-0.5">{photo.shop_address}</p>

              {/* Ratings */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="rating-coffee text-xs">
                  ☕ <StarRating value={photo.coffee_rating} size="sm" />
                  <span className="ml-0.5">{photo.coffee_rating}</span>
                </span>
                <span className="rating-vibe text-xs">
                  ✨ <StarRating value={photo.vibe_rating} size="sm" />
                  <span className="ml-0.5">{photo.vibe_rating}</span>
                </span>
              </div>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-espresso-400
                         hover:bg-cream-100 transition-colors text-lg leading-none flex-shrink-0 mt-0.5"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Caption */}
          {photo.note && (
            <div className="px-4 py-2.5 border-b border-cream-100 flex-shrink-0">
              <p className="text-sm text-espresso-600 leading-relaxed italic">"{photo.note}"</p>
            </div>
          )}

          {/* Like bar */}
          <div className="px-4 py-2.5 border-b border-cream-100 flex items-center gap-3 flex-shrink-0">
            <button
              onClick={onLike}
              className="flex items-center gap-1.5 group"
              aria-label={photo.is_liked_by_me ? 'Unlike' : 'Like'}
            >
              <HeartIcon
                filled={photo.is_liked_by_me}
                className={`w-5 h-5 transition-all duration-150 group-active:scale-125 ${
                  photo.is_liked_by_me ? 'text-rose-400' : 'text-espresso-300 group-hover:text-rose-300'
                }`}
              />
              <span className={`text-sm font-medium transition-colors ${
                photo.is_liked_by_me ? 'text-rose-400' : 'text-espresso-400'
              }`}>
                {photo.like_count > 0
                  ? `${photo.like_count} ${photo.like_count === 1 ? 'like' : 'likes'}`
                  : 'Be the first to like'}
              </span>
            </button>
          </div>

          {/* Comments — fills remaining space */}
          <div className="flex-1 min-h-0 flex flex-col">
            <CommentSection
              comments={interactions.comments}
              loading={interactions.loading}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onAdd={async text => {
                await interactions.addComment(text)
                onCommentAdded()
              }}
              onDelete={interactions.deleteComment}
              onToggleLike={interactions.toggleCommentLike}
              onToggleReaction={interactions.toggleReaction}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
