import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ReviewCard from './ReviewCard'
import type { GalleryReviewItem } from '../../lib/types'

// Mock reactionDetails to avoid Supabase calls
vi.mock('../../lib/reactionDetails', () => ({
  fetchReviewLikers: vi.fn().mockResolvedValue([]),
}))

function makeReview(overrides: Partial<GalleryReviewItem> = {}): GalleryReviewItem {
  return {
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
    photos: [
      { photo_id: 'p1', photo_url: 'https://example.com/1.jpg', display_order: 0, photo_created_at: '2025-01-01' },
    ],
    ...overrides,
  }
}

describe('ReviewCard', () => {
  it('renders a single-photo review without multi-photo indicators', () => {
    const review = makeReview()
    render(<ReviewCard review={review} onOpen={vi.fn()} onLike={vi.fn()} />)

    expect(screen.getByAltText('Test Cafe')).toBeInTheDocument()
    expect(screen.getByText('Test Cafe')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    // No "+N" badge
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument()
  })

  it('renders multi-photo review with "+N" badge and dots', () => {
    const review = makeReview({
      photos: [
        { photo_id: 'p1', photo_url: 'https://example.com/1.jpg', display_order: 0, photo_created_at: '2025-01-01' },
        { photo_id: 'p2', photo_url: 'https://example.com/2.jpg', display_order: 1, photo_created_at: '2025-01-01' },
        { photo_id: 'p3', photo_url: 'https://example.com/3.jpg', display_order: 2, photo_created_at: '2025-01-01' },
      ],
    })
    render(<ReviewCard review={review} onOpen={vi.fn()} onLike={vi.fn()} />)

    // "+2" badge shown
    expect(screen.getByText('+2')).toBeInTheDocument()
    // 3 dot indicators
    const dots = screen.getAllByRole('button', { name: /^Photo \d+$/ })
    expect(dots).toHaveLength(3)
  })

  it('shows like count when > 0', () => {
    const review = makeReview({ like_count: 5 })
    render(<ReviewCard review={review} onOpen={vi.fn()} onLike={vi.fn()} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('does not show like count when 0', () => {
    const review = makeReview({ like_count: 0 })
    render(<ReviewCard review={review} onOpen={vi.fn()} onLike={vi.fn()} />)
    // No "0" rendered
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('shows comment count badge when > 0', () => {
    const review = makeReview({ comment_count: 4 })
    render(<ReviewCard review={review} onOpen={vi.fn()} onLike={vi.fn()} />)
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('fires onLike when like button is clicked', () => {
    const onLike = vi.fn()
    const review = makeReview()
    render(<ReviewCard review={review} onOpen={vi.fn()} onLike={onLike} />)

    fireEvent.click(screen.getByLabelText('Like'))
    expect(onLike).toHaveBeenCalledTimes(1)
  })

  it('fires onOpen when image is clicked', () => {
    const onOpen = vi.fn()
    const review = makeReview()
    render(<ReviewCard review={review} onOpen={onOpen} onLike={vi.fn()} />)

    fireEvent.click(screen.getByAltText('Test Cafe'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('shows filled heart when review is liked by me', () => {
    const review = makeReview({ is_liked_by_me: true })
    render(<ReviewCard review={review} onOpen={vi.fn()} onLike={vi.fn()} />)
    expect(screen.getByLabelText('Unlike')).toBeInTheDocument()
  })

  it('shows unfilled heart when review is not liked by me', () => {
    const review = makeReview({ is_liked_by_me: false })
    render(<ReviewCard review={review} onOpen={vi.fn()} onLike={vi.fn()} />)
    expect(screen.getByLabelText('Like')).toBeInTheDocument()
  })

  it('returns null for review with no photos', () => {
    const review = makeReview({ photos: [] })
    const { container } = render(<ReviewCard review={review} onOpen={vi.fn()} onLike={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('like state is shared — one like button per review card, not per photo', () => {
    const review = makeReview({
      like_count: 3,
      is_liked_by_me: true,
      photos: [
        { photo_id: 'p1', photo_url: 'https://example.com/1.jpg', display_order: 0, photo_created_at: '2025-01-01' },
        { photo_id: 'p2', photo_url: 'https://example.com/2.jpg', display_order: 1, photo_created_at: '2025-01-01' },
      ],
    })
    render(<ReviewCard review={review} onOpen={vi.fn()} onLike={vi.fn()} />)

    // Only one like button (unlike) — not two
    const likeButtons = screen.getAllByLabelText('Unlike')
    expect(likeButtons).toHaveLength(1)

    // Only one like count shown
    const threes = screen.getAllByText('3')
    expect(threes).toHaveLength(1)
  })

  it('navigates carousel on dot click', () => {
    const review = makeReview({
      photos: [
        { photo_id: 'p1', photo_url: 'https://example.com/1.jpg', display_order: 0, photo_created_at: '2025-01-01' },
        { photo_id: 'p2', photo_url: 'https://example.com/2.jpg', display_order: 1, photo_created_at: '2025-01-01' },
      ],
    })
    render(<ReviewCard review={review} onOpen={vi.fn()} onLike={vi.fn()} />)

    // Initially shows first photo
    expect(screen.getByAltText('Test Cafe')).toHaveAttribute('src', 'https://example.com/1.jpg')

    // Click second dot
    fireEvent.click(screen.getByLabelText('Photo 2'))

    // Now shows second photo
    expect(screen.getByAltText('Test Cafe')).toHaveAttribute('src', 'https://example.com/2.jpg')

    // "+1" badge should be gone (only shown on first slide)
    expect(screen.queryByText('+1')).not.toBeInTheDocument()
  })

  it('falls back to email username when reviewer_name is null', () => {
    const review = makeReview({ reviewer_name: null, reviewer_email: 'bob@test.com' })
    render(<ReviewCard review={review} onOpen={vi.fn()} onLike={vi.fn()} />)
    expect(screen.getByText('bob')).toBeInTheDocument()
  })
})
