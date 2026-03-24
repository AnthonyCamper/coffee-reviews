import { useRef, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactionUser } from '../../lib/reactionDetails'

interface Props {
  fetchUsers: () => Promise<ReactionUser[]>
  count: number
  children: React.ReactNode
  label?: string
  className?: string
}

export default function LikedByOverlay({
  fetchUsers,
  count,
  children,
  label = 'Likes',
  className,
}: Props) {
  const [users, setUsers] = useState<ReactionUser[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [showSheet, setShowSheet] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const pressTimer = useRef<ReturnType<typeof setTimeout>>()
  const touchStart = useRef({ x: 0, y: 0 })
  const didLongPress = useRef(false)
  const fetchedForCount = useRef<number | null>(null)

  const loadUsers = useCallback(async () => {
    if (fetchedForCount.current === count && users !== null) return users
    setLoading(true)
    try {
      const data = await fetchUsers()
      setUsers(data)
      fetchedForCount.current = count
      return data
    } finally {
      setLoading(false)
    }
  }, [fetchUsers, count, users])

  // Mobile long press
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (count === 0) return
      const touch = e.touches[0]
      touchStart.current = { x: touch.clientX, y: touch.clientY }
      didLongPress.current = false
      pressTimer.current = setTimeout(async () => {
        didLongPress.current = true
        await loadUsers()
        setShowSheet(true)
      }, 500)
    },
    [count, loadUsers]
  )

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - touchStart.current.x)
    const dy = Math.abs(touch.clientY - touchStart.current.y)
    if (dx > 10 || dy > 10) {
      clearTimeout(pressTimer.current)
    }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    clearTimeout(pressTimer.current)
    if (didLongPress.current) {
      e.preventDefault()
      didLongPress.current = false
    }
  }, [])

  useEffect(() => {
    return () => {
      clearTimeout(pressTimer.current)
    }
  }, [])

  // Invalidate cache when count changes
  useEffect(() => {
    if (fetchedForCount.current !== null && fetchedForCount.current !== count) {
      fetchedForCount.current = null
      setUsers(null)
    }
  }, [count])

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (!showSheet) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [showSheet])

  // Group users by reaction type for display
  const groupedByReaction = users
    ? users.reduce<Record<string, ReactionUser[]>>((acc, u) => {
        const key = u.reactionType ?? '_like'
        ;(acc[key] ??= []).push(u)
        return acc
      }, {})
    : null

  const hasReactionTypes = users?.some(u => u.reactionType)

  return (
    <>
      <div
        ref={triggerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={className ?? 'inline-flex'}
      >
        {children}
      </div>

      {/* Bottom sheet — unified for desktop and mobile */}
      {showSheet &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-end justify-center animate-fade-in"
            onClick={() => setShowSheet(false)}
          >
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-2xl animate-slide-up max-h-[60dvh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-cream-200" />
              </div>

              {/* Header */}
              <div className="px-4 pb-2 flex items-center justify-between flex-shrink-0">
                <h3 className="font-display text-sm font-semibold text-espresso-800">{label}</h3>
                <button
                  onClick={() => setShowSheet(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-espresso-400 hover:bg-cream-100 text-lg leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {/* User list */}
              <div className="overflow-y-auto px-4 pb-6">
                {loading && (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 rounded-full border-2 border-rose-300 border-t-rose-400 animate-spin" />
                  </div>
                )}
                {!loading && (!users || users.length === 0) && (
                  <p className="text-center text-sm text-espresso-300 py-4">No reactions yet</p>
                )}
                {!loading && users && users.length > 0 && (
                  <>
                    {hasReactionTypes ? (
                      <div className="space-y-4">
                        {Object.entries(groupedByReaction!).map(([type, typeUsers]) => (
                          <div key={type}>
                            <p className="text-xs font-medium text-espresso-400 mb-2">
                              {type}{' '}
                              <span className="text-espresso-300">{typeUsers.length}</span>
                            </p>
                            <div className="space-y-2.5">
                              {typeUsers.map((u, i) => (
                                <UserRow key={i} user={u} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {users.map((u, i) => (
                          <UserRow key={i} user={u} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

function UserRow({ user }: { user: ReactionUser }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-cream-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
        {user.avatar ? (
          <img src={user.avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-espresso-500">
            {user.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-espresso-700 truncate flex-1 min-w-0">
        {user.name}
      </p>
      {user.reactionType && <span className="text-base flex-shrink-0">{user.reactionType}</span>}
    </div>
  )
}
