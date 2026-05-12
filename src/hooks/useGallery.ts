import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { triggerPushDelivery } from '../lib/pushManager'
import type { GalleryPhoto, GalleryReviewItem, GalleryShopItem } from '../lib/types'

const PAGE_SIZE = 21 // 3-column multiples look clean

/**
 * Group flat gallery_feed rows (one per photo) into review-level items.
 * Photos within each review are sorted by display_order.
 */
export function groupByReview(photos: GalleryPhoto[]): GalleryReviewItem[] {
  const map = new Map<string, GalleryReviewItem>()

  for (const p of photos) {
    let item = map.get(p.review_id)
    if (!item) {
      item = {
        review_id: p.review_id,
        coffee_rating: p.coffee_rating,
        vibe_rating: p.vibe_rating,
        coffee_type: p.coffee_type,
        note: p.note,
        visited_at: p.visited_at,
        shop_id: p.shop_id,
        shop_name: p.shop_name,
        shop_address: p.shop_address,
        reviewer_id: p.reviewer_id,
        reviewer_name: p.reviewer_name,
        reviewer_avatar: p.reviewer_avatar,
        reviewer_email: p.reviewer_email,
        like_count: p.like_count,
        comment_count: p.comment_count,
        is_liked_by_me: p.is_liked_by_me,
        photos: [],
      }
      map.set(p.review_id, item)
    }
    // Keep like/comment counts in sync (all rows for a review share the same values)
    item.like_count = p.like_count
    item.is_liked_by_me = p.is_liked_by_me
    item.comment_count = p.comment_count

    item.photos.push({
      photo_id: p.photo_id,
      photo_url: p.photo_url,
      display_order: p.display_order,
      photo_created_at: p.photo_created_at,
    })
  }

  // Sort photos within each review by display_order
  for (const item of map.values()) {
    item.photos.sort((a, b) => a.display_order - b.display_order)
  }

  // Return in insertion order (preserves feed chronology)
  return Array.from(map.values())
}

/**
 * Group review-level items by shop. Each shop item holds every review for that
 * shop and a flat list of every photo across those reviews (newest first).
 * Shops appear in the order their first review shows up in the feed.
 */
export function groupByShop(reviews: GalleryReviewItem[]): GalleryShopItem[] {
  const map = new Map<string, GalleryShopItem>()

  for (const r of reviews) {
    let item = map.get(r.shop_id)
    if (!item) {
      item = {
        shop_id: r.shop_id,
        shop_name: r.shop_name,
        shop_address: r.shop_address,
        reviews: [],
        photos: [],
        photo_count: 0,
        review_count: 0,
        latest_visited_at: r.visited_at,
      }
      map.set(r.shop_id, item)
    }
    item.reviews.push(r)
    for (const p of r.photos) {
      item.photos.push({
        photo_id: p.photo_id,
        photo_url: p.photo_url,
        review_id: r.review_id,
        display_order: p.display_order,
        photo_created_at: p.photo_created_at,
      })
    }
    if (r.visited_at > item.latest_visited_at) {
      item.latest_visited_at = r.visited_at
    }
  }

  for (const item of map.values()) {
    item.photos.sort((a, b) => b.photo_created_at.localeCompare(a.photo_created_at))
    item.reviews.sort((a, b) => b.visited_at.localeCompare(a.visited_at))
    item.photo_count = item.photos.length
    item.review_count = item.reviews.length
  }

  return Array.from(map.values())
}

interface UseGalleryReturn {
  reviews: GalleryReviewItem[]
  shops: GalleryShopItem[]
  /** @deprecated Use reviews instead */
  photos: GalleryPhoto[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string | null
  loadMore: () => void
  toggleLike: (reviewId: string) => Promise<void>
  refreshReview: (reviewId: string) => void
  /** @deprecated Use refreshReview instead */
  refreshPhoto: (photoId: string) => void
}

export function useGallery(currentUserId: string): UseGalleryReturn {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const offsetRef = useRef(0)

  const fetchPage = useCallback(async (offset: number, append: boolean) => {
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)

    try {
      const { data, error: err } = await supabase
        .from('gallery_feed')
        .select('*')
        .order('photo_created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (err) throw new Error(err.message)

      const rows = (data ?? []) as GalleryPhoto[]
      setHasMore(rows.length === PAGE_SIZE)
      setPhotos(prev => append ? [...prev, ...rows] : rows)
      offsetRef.current = offset + rows.length
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load gallery')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    offsetRef.current = 0
    fetchPage(0, false)
  }, [fetchPage])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    fetchPage(offsetRef.current, true)
  }, [loadingMore, hasMore, fetchPage])

  // Toggle like at the review level
  const toggleLike = useCallback(async (reviewId: string) => {
    const reviewPhoto = photos.find(p => p.review_id === reviewId)
    if (!reviewPhoto) return

    const wasLiked = reviewPhoto.is_liked_by_me
    const prevLikeCount = reviewPhoto.like_count

    // Optimistic update — update ALL photos belonging to this review
    setPhotos(prev =>
      prev.map(p =>
        p.review_id === reviewId
          ? { ...p, is_liked_by_me: !wasLiked, like_count: wasLiked ? p.like_count - 1 : p.like_count + 1 }
          : p
      )
    )

    try {
      if (wasLiked) {
        await supabase
          .from('review_likes')
          .delete()
          .match({ review_id: reviewId, user_id: currentUserId })
      } else {
        await supabase
          .from('review_likes')
          .insert({ review_id: reviewId, user_id: currentUserId })
        triggerPushDelivery()
      }
    } catch {
      // Revert on failure
      setPhotos(prev =>
        prev.map(p =>
          p.review_id === reviewId
            ? { ...p, is_liked_by_me: wasLiked, like_count: prevLikeCount }
            : p
        )
      )
    }
  }, [photos, currentUserId])

  // After adding a comment, bump the comment count for the review
  const refreshReview = useCallback((reviewId: string) => {
    setPhotos(prev =>
      prev.map(p =>
        p.review_id === reviewId ? { ...p, comment_count: p.comment_count + 1 } : p
      )
    )
  }, [])

  // Deprecated: kept for backward compat with PhotoModal
  const refreshPhoto = useCallback((photoId: string) => {
    const photo = photos.find(p => p.photo_id === photoId)
    if (photo) {
      refreshReview(photo.review_id)
    }
  }, [photos, refreshReview])

  const reviews = groupByReview(photos)
  const shops = groupByShop(reviews)

  return {
    reviews,
    shops,
    photos,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    toggleLike,
    refreshReview,
    refreshPhoto,
  }
}
