import { describe, it, expect } from 'vitest'
import { groupByReview } from './useGallery'
import type { GalleryPhoto } from '../lib/types'

function makePhoto(overrides: Partial<GalleryPhoto> = {}): GalleryPhoto {
  return {
    photo_id: 'photo-1',
    photo_url: 'https://example.com/photo1.jpg',
    display_order: 0,
    photo_created_at: '2025-01-01T00:00:00Z',
    review_id: 'review-1',
    coffee_rating: 8,
    vibe_rating: 7,
    coffee_type: 'Latte',
    note: 'Great coffee',
    visited_at: '2025-01-01',
    shop_id: 'shop-1',
    shop_name: 'Test Cafe',
    shop_address: '123 Main St',
    reviewer_id: 'user-1',
    reviewer_name: 'Alice',
    reviewer_avatar: null,
    reviewer_email: 'alice@test.com',
    like_count: 3,
    comment_count: 1,
    is_liked_by_me: false,
    ...overrides,
  }
}

describe('groupByReview', () => {
  it('groups multiple photos from the same review into one item', () => {
    const photos: GalleryPhoto[] = [
      makePhoto({ photo_id: 'p1', display_order: 0, review_id: 'r1' }),
      makePhoto({ photo_id: 'p2', display_order: 1, review_id: 'r1' }),
      makePhoto({ photo_id: 'p3', display_order: 2, review_id: 'r1' }),
    ]

    const result = groupByReview(photos)

    expect(result).toHaveLength(1)
    expect(result[0].review_id).toBe('r1')
    expect(result[0].photos).toHaveLength(3)
    expect(result[0].photos.map(p => p.photo_id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('returns separate items for different reviews', () => {
    const photos: GalleryPhoto[] = [
      makePhoto({ photo_id: 'p1', review_id: 'r1' }),
      makePhoto({ photo_id: 'p2', review_id: 'r2', shop_name: 'Other Cafe' }),
    ]

    const result = groupByReview(photos)

    expect(result).toHaveLength(2)
    expect(result[0].review_id).toBe('r1')
    expect(result[1].review_id).toBe('r2')
    expect(result[0].photos).toHaveLength(1)
    expect(result[1].photos).toHaveLength(1)
  })

  it('preserves review-level like state (shared across all photos)', () => {
    const photos: GalleryPhoto[] = [
      makePhoto({ photo_id: 'p1', review_id: 'r1', like_count: 5, is_liked_by_me: true }),
      makePhoto({ photo_id: 'p2', review_id: 'r1', like_count: 5, is_liked_by_me: true }),
    ]

    const result = groupByReview(photos)

    expect(result).toHaveLength(1)
    expect(result[0].like_count).toBe(5)
    expect(result[0].is_liked_by_me).toBe(true)
  })

  it('handles single-photo reviews correctly', () => {
    const photos: GalleryPhoto[] = [
      makePhoto({ photo_id: 'p1', review_id: 'r1' }),
    ]

    const result = groupByReview(photos)

    expect(result).toHaveLength(1)
    expect(result[0].photos).toHaveLength(1)
    expect(result[0].photos[0].photo_id).toBe('p1')
  })

  it('returns empty array for empty input', () => {
    expect(groupByReview([])).toEqual([])
  })

  it('sorts photos within a review by display_order', () => {
    const photos: GalleryPhoto[] = [
      makePhoto({ photo_id: 'p3', display_order: 2, review_id: 'r1' }),
      makePhoto({ photo_id: 'p1', display_order: 0, review_id: 'r1' }),
      makePhoto({ photo_id: 'p2', display_order: 1, review_id: 'r1' }),
    ]

    const result = groupByReview(photos)

    expect(result[0].photos.map(p => p.photo_id)).toEqual(['p1', 'p2', 'p3'])
    expect(result[0].photos.map(p => p.display_order)).toEqual([0, 1, 2])
  })

  it('preserves feed order (insertion order of first photo per review)', () => {
    const photos: GalleryPhoto[] = [
      makePhoto({ photo_id: 'p1', review_id: 'r1', photo_created_at: '2025-01-03' }),
      makePhoto({ photo_id: 'p2', review_id: 'r2', photo_created_at: '2025-01-02' }),
      makePhoto({ photo_id: 'p3', review_id: 'r1', photo_created_at: '2025-01-01' }),
      makePhoto({ photo_id: 'p4', review_id: 'r3', photo_created_at: '2025-01-01' }),
    ]

    const result = groupByReview(photos)

    expect(result.map(r => r.review_id)).toEqual(['r1', 'r2', 'r3'])
  })

  it('handles reviews with many photos', () => {
    const photos: GalleryPhoto[] = Array.from({ length: 10 }, (_, i) =>
      makePhoto({ photo_id: `p${i}`, display_order: i, review_id: 'r1' })
    )

    const result = groupByReview(photos)

    expect(result).toHaveLength(1)
    expect(result[0].photos).toHaveLength(10)
  })

  it('handles duplicate photo URLs within a review', () => {
    const photos: GalleryPhoto[] = [
      makePhoto({ photo_id: 'p1', photo_url: 'https://example.com/same.jpg', display_order: 0, review_id: 'r1' }),
      makePhoto({ photo_id: 'p2', photo_url: 'https://example.com/same.jpg', display_order: 1, review_id: 'r1' }),
    ]

    const result = groupByReview(photos)

    expect(result).toHaveLength(1)
    expect(result[0].photos).toHaveLength(2)
    // Both photos kept even with same URL — they have different IDs
    expect(result[0].photos[0].photo_id).toBe('p1')
    expect(result[0].photos[1].photo_id).toBe('p2')
  })

  it('mixes single-photo and multi-photo reviews correctly', () => {
    const photos: GalleryPhoto[] = [
      makePhoto({ photo_id: 'p1', review_id: 'r1' }),
      makePhoto({ photo_id: 'p2', review_id: 'r2' }),
      makePhoto({ photo_id: 'p3', review_id: 'r2', display_order: 1 }),
      makePhoto({ photo_id: 'p4', review_id: 'r3' }),
      makePhoto({ photo_id: 'p5', review_id: 'r3', display_order: 1 }),
      makePhoto({ photo_id: 'p6', review_id: 'r3', display_order: 2 }),
    ]

    const result = groupByReview(photos)

    expect(result).toHaveLength(3)
    expect(result[0].photos).toHaveLength(1)  // r1: 1 photo
    expect(result[1].photos).toHaveLength(2)  // r2: 2 photos
    expect(result[2].photos).toHaveLength(3)  // r3: 3 photos
  })

  it('carries over review metadata correctly', () => {
    const photos: GalleryPhoto[] = [
      makePhoto({
        photo_id: 'p1',
        review_id: 'r1',
        coffee_rating: 9,
        vibe_rating: 8,
        coffee_type: 'Espresso',
        note: 'Amazing',
        shop_name: 'Best Cafe',
        reviewer_name: 'Bob',
        comment_count: 4,
      }),
    ]

    const result = groupByReview(photos)

    expect(result[0].coffee_rating).toBe(9)
    expect(result[0].vibe_rating).toBe(8)
    expect(result[0].coffee_type).toBe('Espresso')
    expect(result[0].note).toBe('Amazing')
    expect(result[0].shop_name).toBe('Best Cafe')
    expect(result[0].reviewer_name).toBe('Bob')
    expect(result[0].comment_count).toBe(4)
  })

  it('does not duplicate reviews during pagination (simulated append)', () => {
    const page1: GalleryPhoto[] = [
      makePhoto({ photo_id: 'p1', review_id: 'r1' }),
      makePhoto({ photo_id: 'p2', review_id: 'r1', display_order: 1 }),
      makePhoto({ photo_id: 'p3', review_id: 'r2' }),
    ]

    const page2: GalleryPhoto[] = [
      makePhoto({ photo_id: 'p4', review_id: 'r2', display_order: 1 }),
      makePhoto({ photo_id: 'p5', review_id: 'r3' }),
    ]

    // Simulate paginated data combined
    const allPhotos = [...page1, ...page2]
    const result = groupByReview(allPhotos)

    expect(result).toHaveLength(3)
    expect(result[0].review_id).toBe('r1')
    expect(result[0].photos).toHaveLength(2)
    expect(result[1].review_id).toBe('r2')
    expect(result[1].photos).toHaveLength(2)
    expect(result[2].review_id).toBe('r3')
    expect(result[2].photos).toHaveLength(1)
  })
})
