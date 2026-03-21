import { useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import type { PhotoComment } from '../../lib/types'
import HeartIcon from './HeartIcon'
import ReactionPicker from './ReactionPicker'

interface Props {
  comments: PhotoComment[]
  loading: boolean
  currentUserId: string
  isAdmin: boolean
  onAdd: (text: string) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
  onToggleLike: (commentId: string) => Promise<void>
  onToggleReaction: (commentId: string, reactionType: string) => Promise<void>
}

export default function CommentSection({
  comments,
  loading,
  currentUserId,
  isAdmin,
  onAdd,
  onDelete,
  onToggleLike,
  onToggleReaction,
}: Props) {
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handlePost = async () => {
    if (!text.trim() || posting) return
    setPosting(true)
    await onAdd(text)
    setText('')
    setPosting(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handlePost()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
        {loading && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 rounded-full border-2 border-rose-300 border-t-rose-400 animate-spin" />
          </div>
        )}

        {!loading && comments.length === 0 && (
          <p className="text-center text-xs text-espresso-300 py-6">
            No comments yet — be the first!
          </p>
        )}

        {comments.map(comment => (
          <CommentItem
            key={comment.id}
            comment={comment}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onDelete={onDelete}
            onToggleLike={onToggleLike}
            onToggleReaction={onToggleReaction}
          />
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-cream-100 px-4 py-3 flex items-end gap-2 bg-white">
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment…"
          maxLength={500}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-espresso-700 placeholder:text-espresso-300 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 transition-colors"
          style={{ maxHeight: '80px', overflowY: 'auto' }}
        />
        <button
          onClick={handlePost}
          disabled={!text.trim() || posting}
          className="btn-primary px-4 py-2 text-sm flex-shrink-0 disabled:opacity-40"
        >
          {posting ? '…' : 'Post'}
        </button>
      </div>
    </div>
  )
}

interface CommentItemProps {
  comment: PhotoComment
  currentUserId: string
  isAdmin: boolean
  onDelete: (id: string) => Promise<void>
  onToggleLike: (id: string) => Promise<void>
  onToggleReaction: (id: string, type: string) => Promise<void>
}

function CommentItem({ comment, currentUserId, isAdmin, onDelete, onToggleLike, onToggleReaction }: CommentItemProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const canDelete = comment.user_id === currentUserId || isAdmin
  const isTemp = comment.id.startsWith('temp-')

  const name = comment.commenter_name ?? comment.commenter_email?.split('@')[0] ?? 'Unknown'
  const timeAgo = (() => {
    try { return formatDistanceToNow(new Date(comment.created_at), { addSuffix: true }) }
    catch { return '' }
  })()

  return (
    <div className={`flex gap-2.5 animate-fade-in ${isTemp ? 'opacity-60' : ''}`}>
      {/* Avatar */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center">
        {comment.commenter_avatar ? (
          <img src={comment.commenter_avatar} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-espresso-500">{name.charAt(0).toUpperCase()}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-espresso-700">{name}</span>
          <span className="text-xs text-espresso-300">{timeAgo}</span>
          {canDelete && !isTemp && (
            confirmDelete ? (
              <span className="flex items-center gap-1">
                <button onClick={() => onDelete(comment.id)} className="text-xs text-red-500 font-medium">Delete</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-espresso-300">Cancel</button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-espresso-200 hover:text-red-400 transition-colors"
              >
                ×
              </button>
            )
          )}
        </div>

        <p className="text-sm text-espresso-700 leading-snug mt-0.5 break-words">{comment.text}</p>

        {/* Reaction strip + like */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {/* Like */}
          <button
            onClick={() => !isTemp && onToggleLike(comment.id)}
            disabled={isTemp}
            className="flex items-center gap-1 text-xs transition-colors group"
          >
            <HeartIcon
              filled={comment.is_liked_by_me}
              className={`w-3.5 h-3.5 transition-all group-active:scale-125 ${
                comment.is_liked_by_me ? 'text-rose-400' : 'text-espresso-300 group-hover:text-rose-300'
              }`}
            />
            {comment.like_count > 0 && (
              <span className={`${comment.is_liked_by_me ? 'text-rose-400' : 'text-espresso-300'}`}>
                {comment.like_count}
              </span>
            )}
          </button>

          {/* Reactions */}
          <ReactionPicker
            reactions={comment.reactions}
            onToggle={type => !isTemp && onToggleReaction(comment.id, type)}
            disabled={isTemp}
          />
        </div>
      </div>
    </div>
  )
}
