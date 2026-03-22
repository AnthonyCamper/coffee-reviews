import { useEffect, useState } from 'react'
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

  // Mobile layout owns the comment input directly (comment list is embedded in scroll area)
  const [mobileText, setMobileText] = useState('')
  const [mobilePosting, setMobilePosting] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const handleMobilePost = async () => {
    if (!mobileText.trim() || mobilePosting) return
    setMobilePosting(true)
    await interactions.addComment(mobileText)
    setMobileText('')
    setMobilePosting(false)
    onCommentAdded()
  }

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

      {/* ══════════════════════════════════════════════════════════════
          MOBILE LAYOUT  (< 640px — all iPhones in portrait)
          Single-scroll bottom sheet with sticky input bar.
          Everything above the input scrolls in one container, so
          photo + review info + comments never compete for height.
      ══════════════════════════════════════════════════════════════ */}
      <div
        className="sm:hidden bg-white w-full rounded-t-3xl shadow-2xl animate-slide-up
                   h-[92dvh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Sticky header: shop name + close ───────────────────── */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-cream-100">
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-espresso-800 truncate">{photo.shop_name}</p>
            <p className="text-xs text-espresso-400 truncate mt-0.5">{photo.shop_address}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-espresso-400
                       hover:bg-cream-100 transition-colors text-lg leading-none flex-shrink-0"
            aria-label="Close"
          >×</button>
        </div>

        {/* ── Single scroll area: photo → review info → comments ─── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* Photo */}
          <div className="w-full bg-cream-100 aspect-video overflow-hidden">
            <img
              src={photo.photo_url}
              alt={photo.shop_name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Reviewer + ratings */}
          <div className="px-4 pt-3 pb-3 border-b border-cream-100">
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
            <div className="flex items-center gap-2 flex-wrap">
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

          {/* Coffee type + caption */}
          {(photo.coffee_type || photo.note) && (
            <div className="px-4 py-2.5 border-b border-cream-100 space-y-1">
              {photo.coffee_type && (
                <p className="text-xs font-medium text-espresso-500">☕ {photo.coffee_type}</p>
              )}
              {photo.note && (
                <p className="text-sm text-espresso-600 leading-relaxed italic">"{photo.note}"</p>
              )}
            </div>
          )}

          {/* Like bar */}
          <div className="px-4 py-2.5 border-b border-cream-100 flex items-center gap-3">
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

          {/* Comment list — embedded in this scroll area, no separate scroll container */}
          <CommentSection
            embedded
            comments={interactions.comments}
            loading={interactions.loading}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onAdd={async t => { await interactions.addComment(t); onCommentAdded() }}
            onDelete={interactions.deleteComment}
            onToggleLike={interactions.toggleCommentLike}
            onToggleReaction={interactions.toggleReaction}
          />
        </div>

        {/* ── Sticky input bar — always visible above keyboard ─────── */}
        <div className="flex-shrink-0 border-t border-cream-100 px-4 py-3 flex items-end gap-2 bg-white">
          <textarea
            value={mobileText}
            onChange={e => setMobileText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleMobilePost()
              }
            }}
            placeholder="Add a comment…"
            maxLength={500}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-base text-espresso-700 placeholder:text-espresso-300 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 transition-colors"
            style={{ maxHeight: '80px', overflowY: 'auto' }}
          />
          <button
            onClick={handleMobilePost}
            disabled={!mobileText.trim() || mobilePosting}
            className="btn-primary px-4 py-2 text-sm flex-shrink-0 disabled:opacity-40"
          >
            {mobilePosting ? '…' : 'Post'}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DESKTOP LAYOUT  (≥ 640px — tablets, laptops, landscape iPad)
          Two-panel side-by-side. Photo on left, details on right.
          flex-row cross-axis stretch gives the right panel a definite
          height (= photo height), so flex-1 on CommentSection works.
      ══════════════════════════════════════════════════════════════ */}
      <div
        className="hidden sm:flex sm:flex-row
                   bg-white w-full sm:max-w-3xl sm:rounded-3xl overflow-hidden shadow-2xl
                   sm:max-h-[86dvh] animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Left: Photo ─────────────────────────────────────────── */}
        <div className="sm:w-[46%] flex-shrink-0 bg-black flex items-center justify-center">
          <img
            src={photo.photo_url}
            alt={photo.shop_name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* ── Right: Details ──────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-h-0">

          {/* Header: reviewer + shop + ratings + close */}
          <div className="px-4 pt-4 pb-3 border-b border-cream-100 flex items-start justify-between gap-3 flex-shrink-0">
            <div className="min-w-0">
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
              <p className="font-display text-sm font-semibold text-espresso-800 truncate">{photo.shop_name}</p>
              <p className="text-xs text-espresso-400 truncate mt-0.5">{photo.shop_address}</p>
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
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-espresso-400
                         hover:bg-cream-100 transition-colors text-lg leading-none flex-shrink-0 mt-0.5"
              aria-label="Close"
            >×</button>
          </div>

          {/* Coffee type + caption */}
          {(photo.coffee_type || photo.note) && (
            <div className="px-4 py-2.5 border-b border-cream-100 flex-shrink-0 space-y-1">
              {photo.coffee_type && (
                <p className="text-xs font-medium text-espresso-500">☕ {photo.coffee_type}</p>
              )}
              {photo.note && (
                <p className="text-sm text-espresso-600 leading-relaxed italic">"{photo.note}"</p>
              )}
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

          {/* Comments — full standalone with own scroll + input */}
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
