// ─── Database row types ────────────────────────────────────────────────────────

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface ApprovedUser {
  email: string
  is_admin: boolean
  added_at: string
}

export interface CoffeeShop {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  created_at: string
}

export interface ReviewPhoto {
  id: string
  review_id: string
  storage_path: string
  url: string
  display_order: number
  created_at: string
}

export interface Review {
  id: string
  coffee_shop_id: string
  user_id: string
  coffee_rating: number   // 1–5
  vibe_rating: number     // 1–5
  note: string | null
  visited_at: string
  created_at: string
  updated_at: string
  // Joined from profiles
  reviewer_name: string | null
  reviewer_avatar: string | null
  reviewer_email: string | null
  // Attached photos
  photos?: ReviewPhoto[]
}

// ─── Composite view type used in the UI ───────────────────────────────────────

export interface ShopWithReviews {
  shop: CoffeeShop
  reviews: Review[]
  avg_coffee: number
  avg_vibe: number
  photos: ReviewPhoto[]   // all photos across all reviews for this shop, newest first
}

// ─── Form types ───────────────────────────────────────────────────────────────

export interface ReviewFormData {
  shop_name: string
  address: string
  lat: string
  lng: string
  coffee_rating: number
  vibe_rating: number
  note: string
  visited_at: string
  photos?: File[]
}

// ─── Auth context ─────────────────────────────────────────────────────────────

export type AuthStatus = 'loading' | 'unauthenticated' | 'unauthorized' | 'authorized'
