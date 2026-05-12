import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import StarRating from '../ui/StarRating'
import ExpandableText from '../ui/ExpandableText'
import CommentSection from './CommentSection'
import HeartIcon from './HeartIcon'
import GifPicker from './GifPicker'
import { Lightbox } from '../ui/PhotoGallery'
import { useReviewComments } from '../../hooks/useReviewComments'
import { useAuthGate } from '../AuthGateModal'
import LikedByOverlay from './LikedByOverlay'
import { fetchReviewLikers, fetchReviewCommentLikers, fetchReviewCommentReactors } from '../../lib/reactionDetails'
import type { GalleryPhoto, GalleryReviewItem } from '../../lib/types'

interface ReviewProps {
  review: GalleryReviewItem
  photo?: never
  currentUserId: string
  isAdmin: boolean
  onClose: () => void
  onLike: () => void
  onCommentAdded: () => void
  onViewOnMap?: (shopId: string) => void
}

interface PhotoProps {
  photo: GalleryPhoto
  review?: never
  currentUserId: string
  isAdmin: boolean
  onClose: () => void
  onLike: () => void
  onCommentAdded: () => void
  onViewOnMap?: (shopId: string) => void
}

type Props = ReviewProps | PhotoProps

export default function PhotoModal(props: Props) {
  const {
    currentUserId,
    isAdmin,
    onClose,
    onLike,
    onCommentAdded,
    onViewOnMap,
  } = props

  // Normalize: build a review-shaped object from either prop form
  const reviewData = props.review ?? {
    review_id: props.photo.review_id,
    coffee_rating: props.photo.coffee_rating,
    vibe_rating: props.photo.vibe_rating,
    coffee_type: props.photo.coffee_type,
    note: props.photo.note,
    visited_at: props.photo.visited_at,
    shop_id: props.photo.shop_id,
    shop_name: props.photo.shop_name,
    shop_address: props.photo.shop_address,
    reviewer_id: props.photo.reviewer_id,
    reviewer_name: props.photo.reviewer_name,
    reviewer_avatar: props.photo.reviewer_avatar,
    reviewer_email: props.photo.reviewer_email,
    like_count: props.photo.like_count,
    comment_count: props.photo.comment_count,
    is_liked_by_me: props.photo.is_liked_by_me,
    photos: [{
      photo_id: props.photo.photo_id,
      photo_url: props.photo.photo_url,
      display_order: props.photo.display_order,
      photo_created_at: props.photo.photo_created_at,
    }],
  }

  const {
    comments,
    loading: commentsLoading,
    addComment,
    deleteComment,
    toggleCommentLike,
    toggleReaction,
    fetchReplies,
  } = useReviewComments(reviewData.review_id, currentUserId)
  const { requireAuth } = useAuthGate()

  const [photoIndex, setPhotoIndex] = useState(0)
  const [showLightbox, setShowLightbox] = useState(false)

  // Mobile input state
  const [mobileText, setMobileText] = useState('')
  const [mobilePosting, setMobilePosting] = useState(false)
  const [mobileReplyingTo, setMobileReplyingTo] = useState<{ id: string; name: string } | null>(null)
  const [mobileShowGif, setMobileShowGif] = useState(false)
  const [mobileSelectedGif, setMobileSelectedGif] = useState<string | null>(null)

  // Clamp photo index when photos change
  useEffect(() => {
    if (photoIndex >= reviewData.photos.length) {
      setPhotoIndex(Math.max(0, reviewData.photos.length - 1))
    }
  }, [reviewData.photos.length, photoIndex])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !showLightbox) onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose, showLightbox])

  const handleMobilePost = async () => {
    if ((!mobileText.trim() && !mobileSelectedGif) || mobilePosting) return
    if (!requireAuth()) return
    setMobilePosting(true)
    await addComment({
      text: mobileText.trim() || undefined,
      parentCommentId: mobileReplyingTo?.id ?? null,
      mediaUrl: mobileSelectedGif ?? undefined,
      contentType: mobileSelectedGif && mobileText.trim() ? 'mixed' : mobileSelectedGif ? 'gif' : 'text',
    })
    setMobileText('')
    setMobileSelectedGif(null)
    setMobileReplyingTo(null)
    setMobileShowGif(false)
    setMobilePosting(false)
    onCommentAdded()
  }

  const currentPhoto = reviewData.photos[photoIndex] ?? reviewData.photos[0]

  const visitedDate = (() => {
    try { return format(new Date(reviewData.visited_at), 'MMM d, yyyy') }
    catch { return reviewData.visited_at }
  })()

  const reviewerName = reviewData.reviewer_name ?? reviewData.reviewer_email?.split('@')[0] ?? 'Unknown'

  const fetchLikers = useCallback(() => fetchReviewLikers(reviewData.review_id), [reviewData.review_id])

  const goToPrev = () => setPhotoIndex(i => Math.max(0, i - 1))
  const goToNext = () => setPhotoIndex(i => Math.min(reviewData.photos.length - 1, i + 1))

  const photoCarousel = (
    <div className="relative w-full bg-cream-100 aspect-video overflow-hidden">
      <img
        src={currentPhoto.photo_url}
        alt={reviewData.shop_name}
        className="w-full h-full object-cover cursor-zoom-in"
        onClick={() => setShowLightbox(true)}
      />
      {/* Carousel nav arrows */}
      {reviewData.photos.length > 1 && (
        <>
          {photoIndex > 0 && (
            <button
              onClick={goToPrev}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors"
              aria-label="Previous photo"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
          {photoIndex < reviewData.photos.length - 1 && (
            <button
              onClick={goToNext}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors"
              aria-label="Next photo"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          )}
          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {reviewData.photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setPhotoIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === photoIndex ? 'bg-white scale-125 shadow' : 'bg-white/50'
                }`}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )

  const reviewerHeader = (
    <div className="flex items-center gap-2 mb-2">
      <div className="w-7 h-7 rounded-full overflow-hidden bg-cream-200 flex-shrink-0 flex items-center justify-center">
        {reviewData.reviewer_avatar ? (
          <img src={reviewData.reviewer_avatar} alt={reviewerName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-espresso-500">{reviewerName.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-espresso-700 truncate">{reviewerName}</p>
        <p className="text-xs text-espresso-300">{visitedDate}</p>
      </div>
    </div>
  )

  const ratingsRow = (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="rating-coffee text-xs">
        ☕ <StarRating value={reviewData.coffee_rating} size="sm" />
        <span className="ml-0.5">{reviewData.coffee_rating.toFixed(1)}</span>
      </span>
      <span className="rating-vibe text-xs">
        ✨ <StarRating value={reviewData.vibe_rating} size="sm" />
        <span className="ml-0.5">{reviewData.vibe_rating.toFixed(1)}</span>
      </span>
    </div>
  )

  const likeBar = (
    <div className="px-4 py-2.5 border-b border-cream-100 flex items-center gap-3">
      <LikedByOverlay fetchUsers={fetchLikers} count={reviewData.like_count} label="Likes">
        <button
          onClick={() => { if (requireAuth()) onLike() }}
          className="flex items-center gap-1.5 group"
          aria-label={reviewData.is_liked_by_me ? 'Unlike' : 'Like'}
        >
          <HeartIcon
            filled={reviewData.is_liked_by_me}
            className={`w-5 h-5 transition-all duration-150 group-active:scale-125 ${
              reviewData.is_liked_by_me ? 'text-rose-400' : 'text-espresso-300 group-hover:text-rose-300'
            }`}
          />
          <span className={`text-sm font-medium transition-colors ${
            reviewData.is_liked_by_me ? 'text-rose-400' : 'text-espresso-400'
          }`}>
            {reviewData.like_count > 0
              ? `${reviewData.like_count} ${reviewData.like_count === 1 ? 'like' : 'likes'}`
              : 'Be the first to like'}
          </span>
        </button>
      </LikedByOverlay>
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >

      {/* ══════════════════════════════════════════════════════════════
          MOBILE LAYOUT  (< 640px)
      ══════════════════════════════════════════════════════════════ */}
      <div
        className="sm:hidden bg-white w-full rounded-t-3xl shadow-2xl animate-slide-up
                   h-[92dvh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-cream-100">
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-espresso-800 truncate">{reviewData.shop_name}</p>
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <p className="text-xs text-espresso-400 truncate">{reviewData.shop_address}</p>
              {onViewOnMap && (
                <button
                  onClick={() => onViewOnMap(reviewData.shop_id)}
                  className="flex-shrink-0 flex items-center gap-1 text-xs text-rose-400 hover:text-rose-500 font-medium transition-colors"
                  aria-label="View on map"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Map
                </button>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-espresso-400
                       hover:bg-cream-100 transition-colors text-lg leading-none flex-shrink-0"
            aria-label="Close"
          >×</button>
        </div>

        {/* Single scroll area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Photo carousel */}
          {photoCarousel}

          {/* Reviewer + ratings */}
          <div className="px-4 pt-3 pb-3 border-b border-cream-100">
            {reviewerHeader}
            {ratingsRow}
          </div>

          {/* Coffee type + caption */}
          {(reviewData.coffee_type || reviewData.note) && (
            <div className="px-4 py-2.5 border-b border-cream-100 space-y-1">
              {reviewData.coffee_type && (
                <p className="text-xs font-medium text-espresso-500">☕ {reviewData.coffee_type}</p>
              )}
              {reviewData.note && (
                <ExpandableText text={reviewData.note} />
              )}
            </div>
          )}

          {/* Like bar */}
          {likeBar}

          {/* Comment list — embedded */}
          <CommentSection
            embedded
            comments={comments}
            loading={commentsLoading}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            requireAuth={requireAuth}
            onAdd={async opts => { await addComment(opts); onCommentAdded() }}
            onDelete={deleteComment}
            onToggleLike={toggleCommentLike}
            onToggleReaction={toggleReaction}
            onFetchReplies={fetchReplies}
            likersFetcher={fetchReviewCommentLikers}
            reactorsFetcher={fetchReviewCommentReactors}
            replyingTo={mobileReplyingTo}
            onSetReplyingTo={setMobileReplyingTo}
          />
        </div>

        {/* GIF picker overlay for mobile */}
        {mobileShowGif && (
          <div className="flex-shrink-0 border-t border-cream-100 px-3 py-2 max-h-[45dvh] overflow-hidden">
            <GifPicker
              onSelect={url => { setMobileSelectedGif(url); setMobileShowGif(false) }}
              onClose={() => setMobileShowGif(false)}
            />
          </div>
        )}

        {/* Reply context + GIF preview */}
        {(mobileReplyingTo || mobileSelectedGif) && (
          <div className="flex-shrink-0 border-t border-cream-100 px-4 py-2 bg-cream-50 flex items-center gap-2 flex-wrap">
            {mobileReplyingTo && (
              <span className="text-xs text-espresso-500">
                Replying to <span className="font-semibold">{mobileReplyingTo.name}</span>
                <button
                  onClick={() => setMobileReplyingTo(null)}
                  className="ml-1.5 text-espresso-300 hover:text-espresso-500"
                >×</button>
              </span>
            )}
            {mobileSelectedGif && (
              <div className="relative">
                <img src={mobileSelectedGif} alt="GIF" className="h-12 rounded-md" />
                <button
                  onClick={() => setMobileSelectedGif(null)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-espresso-700 text-white text-[10px] flex items-center justify-center"
                >×</button>
              </div>
            )}
          </div>
        )}

        {/* Sticky mobile input */}
        <div className="flex-shrink-0 border-t border-cream-100 px-4 py-3 flex items-end gap-2 bg-white">
          <button
            type="button"
            onClick={() => { if (requireAuth()) setMobileShowGif(prev => !prev) }}
            className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-colors ${
              mobileShowGif ? 'bg-rose-100 text-rose-600' : 'bg-cream-100 text-espresso-500 hover:bg-cream-200'
            }`}
            title="GIF"
          >
            GIF
          </button>
          <textarea
            value={mobileText}
            onChange={e => setMobileText(e.target.value)}
            onFocus={e => { if (!requireAuth()) e.target.blur() }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleMobilePost()
              }
            }}
            placeholder={mobileReplyingTo ? `Reply to ${mobileReplyingTo.name}…` : 'Add a comment…'}
            maxLength={500}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-base text-espresso-700 placeholder:text-espresso-300 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 transition-colors"
            style={{ maxHeight: '80px', overflowY: 'auto' }}
          />
          <button
            onClick={handleMobilePost}
            disabled={(!mobileText.trim() && !mobileSelectedGif) || mobilePosting}
            className="btn-primary px-4 py-2 text-sm flex-shrink-0 disabled:opacity-40"
          >
            {mobilePosting ? '…' : 'Post'}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DESKTOP LAYOUT  (≥ 640px)
      ══════════════════════════════════════════════════════════════ */}
      <div
        className="hidden sm:flex sm:flex-row
                   bg-white w-full sm:max-w-3xl sm:rounded-3xl overflow-hidden shadow-2xl
                   sm:max-h-[86dvh] animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Left: Photo carousel */}
        <div className="sm:w-[46%] flex-shrink-0 bg-black flex items-center justify-center relative">
          <img
            src={currentPhoto.photo_url}
            alt={reviewData.shop_name}
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => setShowLightbox(true)}
          />
          {/* Desktop carousel nav */}
          {reviewData.photos.length > 1 && (
            <>
              {photoIndex > 0 && (
                <button
                  onClick={goToPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors"
                  aria-label="Previous photo"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
              )}
              {photoIndex < reviewData.photos.length - 1 && (
                <button
                  onClick={goToNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors"
                  aria-label="Next photo"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              )}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {reviewData.photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === photoIndex ? 'bg-white scale-110 shadow' : 'bg-white/50'
                    }`}
                    aria-label={`Photo ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right: Details */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-cream-100 flex items-start justify-between gap-3 flex-shrink-0">
            <div className="min-w-0">
              {reviewerHeader}
              <p className="font-display text-sm font-semibold text-espresso-800 truncate">{reviewData.shop_name}</p>
              <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                <p className="text-xs text-espresso-400 truncate">{reviewData.shop_address}</p>
                {onViewOnMap && (
                  <button
                    onClick={() => onViewOnMap(reviewData.shop_id)}
                    className="flex-shrink-0 flex items-center gap-1 text-xs text-rose-400 hover:text-rose-500 font-medium transition-colors"
                    aria-label="View on map"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    Map
                  </button>
                )}
              </div>
              <div className="mt-2">
                {ratingsRow}
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
          {(reviewData.coffee_type || reviewData.note) && (
            <div className="px-4 py-2.5 border-b border-cream-100 flex-shrink-0 space-y-1">
              {reviewData.coffee_type && (
                <p className="text-xs font-medium text-espresso-500">☕ {reviewData.coffee_type}</p>
              )}
              {reviewData.note && (
                <ExpandableText text={reviewData.note} />
              )}
            </div>
          )}

          {/* Like bar */}
          <div className="flex-shrink-0">
            {likeBar}
          </div>

          {/* Comments — standalone with scroll + input + GIF */}
          <div className="flex-1 min-h-0 flex flex-col">
            <CommentSection
              comments={comments}
              loading={commentsLoading}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              requireAuth={requireAuth}
              onAdd={async opts => {
                await addComment(opts)
                onCommentAdded()
              }}
              onDelete={deleteComment}
              onToggleLike={toggleCommentLike}
              onToggleReaction={toggleReaction}
              onFetchReplies={fetchReplies}
              likersFetcher={fetchReviewCommentLikers}
              reactorsFetcher={fetchReviewCommentReactors}
            />
          </div>
        </div>
      </div>
      {showLightbox && (
        <div onClick={e => e.stopPropagation()}>
          <Lightbox
            photos={reviewData.photos.map(p => ({
              id: p.photo_id,
              url: p.photo_url,
              review_id: reviewData.review_id,
              storage_path: '',
              display_order: p.display_order,
              created_at: p.photo_created_at,
            }))}
            initialIndex={photoIndex}
            onClose={() => setShowLightbox(false)}
          />
        </div>
      )}
    </div>
  )
}
