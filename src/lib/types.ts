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
  coffee_rating: number   // 1–10
  vibe_rating: number     // 1–10
  coffee_type: string | null
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
  coffee_type: string | null
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

export type CommentContentType = 'text' | 'gif' | 'mixed'

/** Shared comment fields used by CommentSection (display-only, no target ref). */
export interface Comment {
  id: string
  user_id: string
  text: string | null
  created_at: string
  parent_comment_id: string | null
  content_type: CommentContentType
  media_url: string | null
  commenter_name: string | null
  commenter_avatar: string | null
  commenter_email: string | null
  like_count: number
  is_liked_by_me: boolean
  reply_count: number
  reactions: CommentReaction[]
  replies?: Comment[]
}

export interface PhotoComment extends Comment {
  photo_id: string
  replies?: PhotoComment[]
}

export interface ReviewComment extends Comment {
  review_id: string
  replies?: ReviewComment[]
}

export interface AddCommentOptions {
  text?: string
  parentCommentId?: string | null
  mediaUrl?: string | null
  contentType?: CommentContentType
}

// ─── Notification types ──────────────────────────────────────────────────────

export type NotificationType =
  | 'new_review'
  | 'photo_comment'
  | 'comment_reply'
  | 'photo_like'
  | 'comment_like'
  | 'comment_reaction'

export interface Notification {
  id: string
  recipient_id: string
  actor_id: string | null
  type: NotificationType
  review_id: string | null
  photo_id: string | null
  comment_id: string | null
  shop_name: string | null
  preview_text: string | null
  read: boolean
  push_sent: boolean
  created_at: string
  // Joined actor info (from query)
  actor_name?: string | null
  actor_avatar?: string | null
}

export interface NotificationPreferences {
  user_id: string
  enabled: boolean
  new_review: boolean
  photo_comment: boolean
  comment_reply: boolean
  photo_like: boolean
  comment_like: boolean
  comment_react: boolean
  quiet_mode: boolean
}

export interface PushSubscriptionRecord {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth_key: string
  user_agent: string | null
  created_at: string
}

// ─── Form types ───────────────────────────────────────────────────────────────

export interface ReviewFormData {
  shop_name: string
  address: string
  lat: string
  lng: string
  coffee_rating: number
  vibe_rating: number
  coffee_type: string
  note: string
  visited_at: string
  photos?: File[]
}

export interface ReviewUpdateData {
  coffee_rating?: number
  vibe_rating?: number
  coffee_type?: string
  note?: string
  visited_at?: string
  photos_to_delete?: string[]   // review_photos IDs to remove from DB + storage
  new_photos?: File[]           // new photos to upload and attach
}
