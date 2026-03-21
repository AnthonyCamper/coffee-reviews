import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ShopWithReviews, Review, CoffeeShop, ReviewFormData } from '../lib/types'

interface UseReviewsReturn {
  shops: ShopWithReviews[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createReview: (data: ReviewFormData, userId: string) => Promise<{ error: string | null }>
  updateReview: (reviewId: string, data: Partial<ReviewFormData>) => Promise<{ error: string | null }>
  deleteReview: (reviewId: string) => Promise<{ error: string | null }>
}

export function useReviews(): UseReviewsReturn {
  const [shops, setShops] = useState<ShopWithReviews[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch coffee shops
      const { data: shopData, error: shopErr } = await supabase
        .from('coffee_shops')
        .select('*')
        .order('name')

      if (shopErr) throw new Error(shopErr.message)

      // Fetch reviews joined with profile info
      const { data: reviewData, error: reviewErr } = await supabase
        .from('reviews_with_profiles')
        .select('*')
        .order('visited_at', { ascending: false })

      if (reviewErr) throw new Error(reviewErr.message)

      const reviews = (reviewData ?? []) as Review[]
      const coffeeShops = (shopData ?? []) as CoffeeShop[]

      // Group reviews by shop
      const map = new Map<string, Review[]>()
      for (const r of reviews) {
        const list = map.get(r.coffee_shop_id) ?? []
        list.push(r)
        map.set(r.coffee_shop_id, list)
      }

      const result: ShopWithReviews[] = coffeeShops.map(shop => {
        const shopReviews = map.get(shop.id) ?? []
        const avgCoffee =
          shopReviews.length > 0
            ? shopReviews.reduce((s, r) => s + r.coffee_rating, 0) / shopReviews.length
            : 0
        const avgVibe =
          shopReviews.length > 0
            ? shopReviews.reduce((s, r) => s + r.vibe_rating, 0) / shopReviews.length
            : 0
        return { shop, reviews: shopReviews, avg_coffee: avgCoffee, avg_vibe: avgVibe }
      })

      // Sort shops: those with reviews first, then by name
      result.sort((a, b) => {
        if (a.reviews.length === 0 && b.reviews.length > 0) return 1
        if (b.reviews.length === 0 && a.reviews.length > 0) return -1
        return a.shop.name.localeCompare(b.shop.name)
      })

      setShops(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // userId param is intentionally unused here — Supabase sets user_id
  // automatically via auth.uid() enforced by the RLS insert policy.
  const createReview = async (
    data: ReviewFormData,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string
  ): Promise<{ error: string | null }> => {
    // Upsert coffee shop (match by name + address)
    const { data: shopData, error: shopErr } = await supabase
      .from('coffee_shops')
      .upsert(
        {
          name: data.shop_name.trim(),
          address: data.address.trim(),
          lat: parseFloat(data.lat),
          lng: parseFloat(data.lng),
        },
        { onConflict: 'name,address', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (shopErr || !shopData) {
      return { error: shopErr?.message ?? 'Could not create coffee shop' }
    }

    const { error: reviewErr } = await supabase.from('reviews').insert({
      coffee_shop_id: shopData.id,
      coffee_rating: data.coffee_rating,
      vibe_rating: data.vibe_rating,
      note: data.note.trim() || null,
      visited_at: data.visited_at,
    })

    if (reviewErr) return { error: reviewErr.message }

    await fetchAll()
    return { error: null }
  }

  const updateReview = async (
    reviewId: string,
    data: Partial<ReviewFormData>
  ): Promise<{ error: string | null }> => {
    const updates: Record<string, unknown> = {}
    if (data.coffee_rating !== undefined) updates.coffee_rating = data.coffee_rating
    if (data.vibe_rating !== undefined) updates.vibe_rating = data.vibe_rating
    if (data.note !== undefined) updates.note = data.note.trim() || null
    if (data.visited_at !== undefined) updates.visited_at = data.visited_at

    const { error: err } = await supabase
      .from('reviews')
      .update(updates)
      .eq('id', reviewId)

    if (err) return { error: err.message }

    await fetchAll()
    return { error: null }
  }

  const deleteReview = async (reviewId: string): Promise<{ error: string | null }> => {
    const { error: err } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId)

    if (err) return { error: err.message }
    await fetchAll()
    return { error: null }
  }

  return { shops, loading, error, refresh: fetchAll, createReview, updateReview, deleteReview }
}
