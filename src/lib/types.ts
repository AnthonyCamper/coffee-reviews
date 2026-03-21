// ─── Auth types ───────────────────────────────────────────────────────────────

export type UserStatus = 'pending' | 'approved' | 'rejected' | 'disabled'

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'pending'
  | 'rejected'
  | 'disabled'
  | 'authorized'

// ─── Database row types ────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  display_name: string | null
  avatar_url: string | null
  status: UserStatus
  is_admin: boolean
  can_leave_reviews: boolean
  created_at: string
}

/** @deprecated Use UserProfile instead */
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

export interface SiteSettings {
  is_public: boolean
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

// ─── Gallery / Social types ────────────────────────────────────────────────────

export interface GalleryPhoto {
  photo_id: string
  photo_url: string
  display_order: number
  photo_created_at: string
  review_id: string
  coffee_rating: number
  vibe_rating: number
  note: string | null
  visited_at: string
  shop_id: string
  shop_name: string
  shop_address: string
  reviewer_id: string
  reviewer_name: string | null
  reviewer_avatar: string | null
  reviewer_email: string | null
  like_count: number
  comment_count: number
  is_liked_by_me: boolean
}

export interface CommentReaction {
  reaction_type: string
  count: number
  is_mine: boolean
}

export interface PhotoComment {
  id: string
  photo_id: string
  user_id: string
  text: string
  created_at: string
  commenter_name: string | null
  commenter_avatar: string | null
  commenter_email: string | null
  like_count: number
  is_liked_by_me: boolean
  reactions: CommentReaction[]
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
