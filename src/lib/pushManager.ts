// ============================================================================
// Push subscription management utilities
// ============================================================================

import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

// ── Feature detection ────────────────────────────────────────────────────────

export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/**
 * On iOS 16.4+, push notifications only work in standalone (Home Screen) mode.
 * Returns true if we're on iOS but NOT in standalone mode.
 */
export function needsHomeScreenInstall(): boolean {
  return isIOS() && !isStandalone()
}

export function getPermissionState(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

// ── Service worker registration ──────────────────────────────────────────────

let swRegistration: ServiceWorkerRegistration | null = null

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    swRegistration = reg

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready
    return reg
  } catch (err) {
    console.error('Service worker registration failed:', err)
    return null
  }
}

export function getRegistration(): ServiceWorkerRegistration | null {
  return swRegistration
}

// ── VAPID key conversion ─────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// ── Subscribe to push ────────────────────────────────────────────────────────

export async function subscribeToPush(userId: string): Promise<{
  success: boolean
  error?: string
  needsInstall?: boolean
}> {
  if (!isPushSupported()) {
    return { success: false, error: 'Push notifications are not supported in this browser.' }
  }

  if (needsHomeScreenInstall()) {
    return {
      success: false,
      error: 'On iPhone, notifications require adding this app to your Home Screen first.',
      needsInstall: true,
    }
  }

  if (!VAPID_PUBLIC_KEY) {
    return { success: false, error: 'Push notifications are not configured on this server.' }
  }

  // Request permission
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return {
      success: false,
      error: permission === 'denied'
        ? 'Notification permission was denied. You can re-enable it in your browser settings.'
        : 'Notification permission was dismissed. Try again when you\'re ready.',
    }
  }

  try {
    const reg = swRegistration || await registerServiceWorker()
    if (!reg) {
      return { success: false, error: 'Could not register service worker.' }
    }

    // Check for existing subscription
    let subscription = await reg.pushManager.getSubscription()

    // If no subscription or the key has changed, create a new one
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      })
    }

    const json = subscription.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { success: false, error: 'Invalid push subscription.' }
    }

    // Store in database
    const { error: dbError } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth_key: json.keys.auth,
          user_agent: navigator.userAgent.slice(0, 200),
        },
        { onConflict: 'user_id,endpoint' }
      )

    if (dbError) {
      return { success: false, error: 'Could not save subscription: ' + dbError.message }
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to subscribe to push.',
    }
  }
}

// ── Unsubscribe from push ────────────────────────────────────────────────────

export async function unsubscribeFromPush(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const reg = swRegistration || await navigator.serviceWorker?.getRegistration()
    if (reg) {
      const subscription = await reg.pushManager.getSubscription()
      if (subscription) {
        // Remove from database first
        await supabase
          .from('push_subscriptions')
          .delete()
          .match({ user_id: userId, endpoint: subscription.endpoint })

        // Then unsubscribe from the browser
        await subscription.unsubscribe()
      }
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to unsubscribe.',
    }
  }
}

// ── Check if currently subscribed ────────────────────────────────────────────

export async function isSubscribedToPush(): Promise<boolean> {
  try {
    const reg = swRegistration || await navigator.serviceWorker?.getRegistration()
    if (!reg) return false
    const subscription = await reg.pushManager.getSubscription()
    return !!subscription
  } catch {
    return false
  }
}

// ── Trigger push delivery for pending notifications ──────────────────────────

export async function triggerPushDelivery(notificationIds?: string[]): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const functionUrl = `${supabaseUrl}/functions/v1/send-push`

    fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ notification_ids: notificationIds }),
    }).catch(() => {
      // Fire-and-forget — push delivery failure is non-fatal
    })
  } catch {
    // Ignore errors — push is best-effort
  }
}
