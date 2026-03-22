import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { triggerPushDelivery } from '../lib/pushManager'
import type { PhotoComment, CommentReaction } from '../lib/types'

interface RawComment {
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
}

interface RawReaction {
  comment_id: string
  reaction_type: string
  user_id: string
}

interface UsePhotoInteractionsReturn {
  comments: PhotoComment[]
  loading: boolean
  addComment: (text: string) => Promise<void>
  deleteComment: (commentId: string) => Promise<void>
  toggleCommentLike: (commentId: string) => Promise<void>
  toggleReaction: (commentId: string, reactionType: string) => Promise<void>
}

export function usePhotoInteractions(
  photoId: string,
  currentUserId: string
): UsePhotoInteractionsReturn {
  const [comments, setComments] = useState<PhotoComment[]>([])
  const [loading, setLoading] = useState(true)

  const fetchComments = useCallback(async () => {
    setLoading(true)
    try {
      const { data: commentData } = await supabase
        .from('photo_comments_detailed')
        .select('*')
        .eq('photo_id', photoId)
        .order('created_at', { ascending: true })

      const rawComments = (commentData ?? []) as RawComment[]

      // Fetch reactions for these comment IDs in one query
      let reactions: RawReaction[] = []
      if (rawComments.length > 0) {
        const { data: rData } = await supabase
          .from('comment_reactions')
          .select('comment_id, reaction_type, user_id')
          .in('comment_id', rawComments.map(c => c.id))
        reactions = (rData ?? []) as RawReaction[]
      }

      // Group reactions by comment_id
      const reactionMap = new Map<string, RawReaction[]>()
      for (const r of reactions) {
        const list = reactionMap.get(r.comment_id) ?? []
        list.push(r)
        reactionMap.set(r.comment_id, list)
      }

      const parsed: PhotoComment[] = rawComments.map(c => {
        const raws = reactionMap.get(c.id) ?? []
        // Aggregate reactions
        const aggregated = new Map<string, { count: number; is_mine: boolean }>()
        for (const r of raws) {
          const entry = aggregated.get(r.reaction_type) ?? { count: 0, is_mine: false }
          entry.count++
          if (r.user_id === currentUserId) entry.is_mine = true
          aggregated.set(r.reaction_type, entry)
        }
        const reactions: CommentReaction[] = Array.from(aggregated.entries()).map(
          ([reaction_type, { count, is_mine }]) => ({ reaction_type, count, is_mine })
        )
        return { ...c, reactions }
      })

      setComments(parsed)
    } finally {
      setLoading(false)
    }
  }, [photoId, currentUserId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const addComment = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    // Optimistic: append a temporary comment
    const tempId = `temp-${Date.now()}`
    const temp: PhotoComment = {
      id: tempId,
      photo_id: photoId,
      user_id: currentUserId,
      text: trimmed,
      created_at: new Date().toISOString(),
      commenter_name: null,
      commenter_avatar: null,
      commenter_email: null,
      like_count: 0,
      is_liked_by_me: false,
      reactions: [],
    }
    setComments(prev => [...prev, temp])

    const { error } = await supabase
      .from('photo_comments')
      .insert({ photo_id: photoId, user_id: currentUserId, text: trimmed })

    if (error) {
      setComments(prev => prev.filter(c => c.id !== tempId))
    } else {
      // Replace temp with real data
      await fetchComments()
      // Trigger push delivery for the notification created by the DB trigger
      triggerPushDelivery()
    }
  }, [photoId, currentUserId, fetchComments])

  const deleteComment = useCallback(async (commentId: string) => {
    setComments(prev => prev.filter(c => c.id !== commentId))
    await supabase.from('photo_comments').delete().eq('id', commentId)
  }, [])

  const toggleCommentLike = useCallback(async (commentId: string) => {
    const comment = comments.find(c => c.id === commentId)
    if (!comment) return
    const wasLiked = comment.is_liked_by_me

    setComments(prev =>
      prev.map(c =>
        c.id === commentId
          ? { ...c, is_liked_by_me: !wasLiked, like_count: wasLiked ? c.like_count - 1 : c.like_count + 1 }
          : c
      )
    )

    try {
      if (wasLiked) {
        await supabase.from('comment_likes').delete().match({ comment_id: commentId, user_id: currentUserId })
      } else {
        await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: currentUserId })
        triggerPushDelivery()
      }
    } catch {
      setComments(prev =>
        prev.map(c =>
          c.id === commentId
            ? { ...c, is_liked_by_me: wasLiked, like_count: comment.like_count }
            : c
        )
      )
    }
  }, [comments, currentUserId])

  const toggleReaction = useCallback(async (commentId: string, reactionType: string) => {
    const comment = comments.find(c => c.id === commentId)
    if (!comment) return

    const existing = comment.reactions.find(r => r.reaction_type === reactionType)
    const isMine = existing?.is_mine ?? false

    // Optimistic update
    setComments(prev =>
      prev.map(c => {
        if (c.id !== commentId) return c
        const updated = c.reactions.filter(r => r.reaction_type !== reactionType)
        if (!isMine) {
          updated.push({
            reaction_type: reactionType,
            count: (existing?.count ?? 0) + 1,
            is_mine: true,
          })
        } else if (existing && existing.count > 1) {
          updated.push({ reaction_type: reactionType, count: existing.count - 1, is_mine: false })
        }
        return { ...c, reactions: updated }
      })
    )

    try {
      if (isMine) {
        await supabase
          .from('comment_reactions')
          .delete()
          .match({ comment_id: commentId, user_id: currentUserId, reaction_type: reactionType })
      } else {
        await supabase
          .from('comment_reactions')
          .insert({ comment_id: commentId, user_id: currentUserId, reaction_type: reactionType })
        triggerPushDelivery()
      }
    } catch {
      // Revert on failure
      setComments(prev =>
        prev.map(c => (c.id === commentId ? { ...c, reactions: comment.reactions } : c))
      )
    }
  }, [comments, currentUserId])

  return { comments, loading, addComment, deleteComment, toggleCommentLike, toggleReaction }
}
