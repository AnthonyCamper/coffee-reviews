// ============================================================================
// Supabase Edge Function: send-push
//
// Processes pending notifications and sends web push messages.
// Called by the client after creating content (comment, like, etc.)
//
// Environment secrets required:
//   VAPID_PUBLIC_KEY  — Base64url-encoded VAPID public key
//   VAPID_PRIVATE_KEY — Base64url-encoded VAPID private key
//   VAPID_SUBJECT     — mailto: or https: URL identifying the sender
//   SUPABASE_URL      — auto-provided
//   SUPABASE_SERVICE_ROLE_KEY — auto-provided
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Web Push crypto helpers (using Web Crypto API) ───────────────────────────

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  const total = buffers.reduce((s, b) => s + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string,
  publicKeyBase64: string
): Promise<{ authorization: string; cryptoKey: string }> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the VAPID private key for signing
  const privateKeyBytes = base64UrlDecode(privateKeyBase64);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    buildPkcs8FromRaw(privateKeyBytes),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format
  const rawSig = derToRaw(new Uint8Array(signature));
  const signatureB64 = base64UrlEncode(rawSig);
  const jwt = `${unsignedToken}.${signatureB64}`;

  return {
    authorization: `vapid t=${jwt}, k=${publicKeyBase64}`,
    cryptoKey: publicKeyBase64,
  };
}

// Build PKCS8 wrapper around raw 32-byte EC private key
function buildPkcs8FromRaw(rawKey: Uint8Array): ArrayBuffer {
  // If already PKCS8 length, assume it's already wrapped
  if (rawKey.length > 36) return rawKey.buffer;

  const pkcs8Header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
    0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8Footer = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00,
  ]);

  // We need the public key too — but for signing we only need the private key
  // Use a minimal PKCS8 without the public key part
  const minimalPkcs8 = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);

  return concatBuffers(minimalPkcs8, rawKey).buffer;
}

// Convert DER-encoded ECDSA signature to raw 64-byte format
function derToRaw(der: Uint8Array): Uint8Array {
  // If already 64 bytes, it's already raw
  if (der.length === 64) return der;

  // DER format: 0x30 <len> 0x02 <rlen> <r> 0x02 <slen> <s>
  let offset = 2; // skip 0x30 and total length
  if (der[0] !== 0x30) return der; // not DER, return as-is

  // Parse r
  if (der[offset] !== 0x02) return der;
  offset++;
  const rLen = der[offset];
  offset++;
  let r = der.slice(offset, offset + rLen);
  offset += rLen;

  // Parse s
  if (der[offset] !== 0x02) return der;
  offset++;
  const sLen = der[offset];
  offset++;
  let s = der.slice(offset, offset + sLen);

  // Pad/trim to 32 bytes each
  if (r.length > 32) r = r.slice(r.length - 32);
  if (s.length > 32) s = s.slice(s.length - 32);
  const raw = new Uint8Array(64);
  raw.set(r, 32 - r.length);
  raw.set(s, 64 - s.length);
  return raw;
}

// ── RFC 8291: Encrypt push payload ───────────────────────────────────────────

async function encryptPayload(
  clientPublicKeyB64: string,
  authSecretB64: string,
  payload: string
): Promise<{ encrypted: Uint8Array; localPublicKey: Uint8Array; salt: Uint8Array }> {
  const clientPublicKeyBytes = base64UrlDecode(clientPublicKeyB64);
  const authSecret = base64UrlDecode(authSecretB64);
  const plaintext = new TextEncoder().encode(payload);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // Export local public key (uncompressed point)
  const localPublicKeyBuffer = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);
  const localPublicKey = new Uint8Array(localPublicKeyBuffer);

  // Import client public key
  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPublicKey },
    localKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // Generate 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF info for auth: "WebPush: info\0" + client_public + server_public
  const enc = new TextEncoder();
  const authInfo = concatBuffers(
    enc.encode("WebPush: info\0"),
    clientPublicKeyBytes,
    localPublicKey
  );

  // IKM = HKDF(auth_secret, shared_secret, authInfo, 32)
  const authHkdfKey = await crypto.subtle.importKey(
    "raw", authSecret, { name: "HKDF" }, false, ["deriveBits"]
  );

  // First: PRK from shared secret using auth as salt
  const prkKey = await crypto.subtle.importKey(
    "raw", sharedSecret, { name: "HKDF" }, false, ["deriveBits"]
  );

  // Derive IKM
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: authSecret, info: authInfo },
      prkKey,
      256
    )
  );

  // CEK info: "Content-Encoding: aes128gcm\0"
  const cekInfo = enc.encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = enc.encode("Content-Encoding: nonce\0");

  const ikmKey = await crypto.subtle.importKey(
    "raw", ikm, { name: "HKDF" }, false, ["deriveBits"]
  );

  // Derive content encryption key (16 bytes)
  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt, info: cekInfo },
    ikmKey,
    128
  );

  // Derive nonce (12 bytes)
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt, info: nonceInfo },
    ikmKey,
    96
  );

  // Pad the plaintext: add delimiter byte (0x02) then padding
  const padded = concatBuffers(plaintext, new Uint8Array([2]));

  // AES-128-GCM encrypt
  const cek = await crypto.subtle.importKey(
    "raw", cekBits, { name: "AES-GCM" }, false, ["encrypt"]
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: new Uint8Array(nonceBits), tagLength: 128 },
      cek,
      padded
    )
  );

  // Build aes128gcm content coding header
  // salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  const idLen = new Uint8Array([65]); // uncompressed EC point

  const encrypted = concatBuffers(salt, rs, idLen, localPublicKey, ciphertext);
  return { encrypted, localPublicKey, salt };
}

// ── Send a single push notification ──────────────────────────────────────────

async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth_key: string },
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; statusCode: number; gone: boolean }> {
  const payloadStr = JSON.stringify(payload);
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const { authorization } = await createVapidJwt(
    audience,
    vapidSubject,
    vapidPrivateKey,
    vapidPublicKey
  );

  const { encrypted } = await encryptPayload(
    subscription.p256dh,
    subscription.auth_key,
    payloadStr
  );

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
      Urgency: "normal",
    },
    body: encrypted,
  });

  const gone = response.status === 404 || response.status === 410;
  return {
    success: response.status >= 200 && response.status < 300,
    statusCode: response.status,
    gone,
  };
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@talias.coffee";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth: extract and validate user JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for reading subscriptions & updating notifications
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate the caller's JWT using the anon client
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { notification_ids } = body as { notification_ids?: string[] };

    // Determine which notifications to process
    let query = supabase
      .from("notifications")
      .select("*")
      .eq("push_sent", false)
      .order("created_at", { ascending: false })
      .limit(50);

    if (notification_ids?.length) {
      query = query.in("id", notification_ids);
    } else {
      // Process recent unsent notifications (last 5 minutes)
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      query = query.gte("created_at", fiveMinAgo);
    }

    const { data: notifications, error: fetchErr } = await query;

    if (fetchErr) {
      return new Response(
        JSON.stringify({ error: fetchErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!notifications?.length) {
      console.log("[send-push] No pending notifications found");
      return new Response(
        JSON.stringify({ sent: 0, reason: "no_pending_notifications" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-push] Processing ${notifications.length} notifications for ${new Set(notifications.map((n: { recipient_id: string }) => n.recipient_id)).size} recipients`);

    // Group by recipient
    const byRecipient = new Map<string, typeof notifications>();
    for (const n of notifications) {
      const list = byRecipient.get(n.recipient_id) ?? [];
      list.push(n);
      byRecipient.set(n.recipient_id, list);
    }

    let totalSent = 0;
    const subscriptionsToDelete: string[] = [];
    const subscriptionsToIncFailure: string[] = [];
    const notificationsMarkedSent: string[] = [];

    for (const [recipientId, recipientNotifications] of byRecipient) {
      // Check preferences
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", recipientId)
        .maybeSingle();

      // Skip if notifications disabled or quiet mode
      if (prefs && (!prefs.enabled || prefs.quiet_mode)) {
        // Still mark as "sent" so we don't retry
        notificationsMarkedSent.push(
          ...recipientNotifications.map((n: { id: string }) => n.id)
        );
        continue;
      }

      // Get subscriptions for this user
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", recipientId);

      if (!subscriptions?.length) {
        notificationsMarkedSent.push(
          ...recipientNotifications.map((n: { id: string }) => n.id)
        );
        continue;
      }

      // Filter notifications by user preferences
      const filteredNotifications = recipientNotifications.filter(
        (n: { type: string }) => {
          if (!prefs) return true; // No prefs row = all enabled
          switch (n.type) {
            case "new_review": return prefs.new_review;
            case "photo_comment": return prefs.photo_comment;
            case "comment_reply": return prefs.comment_reply;
            case "photo_like": return prefs.photo_like;
            case "comment_like": return prefs.comment_like;
            case "comment_reaction": return prefs.comment_react;
            default: return true;
          }
        }
      );

      // Send to each subscription
      for (const notification of filteredNotifications) {
        // Resolve review_id from comment_id if missing (backcompat for old rows)
        let photoId = notification.photo_id;
        let reviewId = notification.review_id;
        if (!photoId && !reviewId && notification.comment_id) {
          const { data: commentRow } = await supabase
            .from("review_comments")
            .select("review_id")
            .eq("id", notification.comment_id)
            .maybeSingle();
          if (commentRow) reviewId = commentRow.review_id;
        }

        // Build deep link URL based on notification type
        let url = "/";
        if (photoId) {
          url = `/?photo=${photoId}`;
          if (notification.comment_id) {
            url += `&comment=${notification.comment_id}`;
          }
        } else if (reviewId) {
          url = `/?review=${reviewId}`;
          if (notification.comment_id) {
            url += `&comment=${notification.comment_id}`;
          }
        }

        const pushPayload = {
          title: getNotificationTitle(notification),
          body: notification.preview_text || "",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: `${notification.type}-${notification.id}`,
          data: {
            url,
            notificationId: notification.id,
            type: notification.type,
          },
        };

        for (const sub of subscriptions) {
          try {
            const result = await sendPush(
              sub,
              pushPayload,
              VAPID_PUBLIC_KEY,
              VAPID_PRIVATE_KEY,
              VAPID_SUBJECT
            );

            if (result.gone) {
              console.log(`[send-push] Subscription ${sub.id} gone (${result.statusCode}), will delete`);
              subscriptionsToDelete.push(sub.id);
            } else if (!result.success) {
              console.warn(`[send-push] Push failed for sub ${sub.id}: HTTP ${result.statusCode}`);
              subscriptionsToIncFailure.push(sub.id);
            } else {
              // Reset failure count on success
              if (sub.failure_count > 0) {
                await supabase
                  .from("push_subscriptions")
                  .update({ failure_count: 0, last_success: new Date().toISOString() })
                  .eq("id", sub.id);
              } else {
                await supabase
                  .from("push_subscriptions")
                  .update({ last_success: new Date().toISOString() })
                  .eq("id", sub.id);
              }
              totalSent++;
            }
          } catch {
            subscriptionsToIncFailure.push(sub.id);
          }
        }

        notificationsMarkedSent.push(notification.id);
      }

      // Also mark filtered-out notifications as sent (to prevent retry)
      const filteredIds = new Set(
        filteredNotifications.map((n: { id: string }) => n.id)
      );
      for (const n of recipientNotifications) {
        if (!filteredIds.has(n.id)) {
          notificationsMarkedSent.push(n.id);
        }
      }
    }

    // Batch updates
    if (notificationsMarkedSent.length) {
      await supabase
        .from("notifications")
        .update({ push_sent: true })
        .in("id", notificationsMarkedSent);
    }

    if (subscriptionsToDelete.length) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", subscriptionsToDelete);
    }

    if (subscriptionsToIncFailure.length) {
      // Increment failure counts
      for (const subId of subscriptionsToIncFailure) {
        await supabase.rpc("increment_failure_count", { sub_id: subId }).catch(() => {});
      }
    }

    console.log(`[send-push] Done: sent=${totalSent}, processed=${notificationsMarkedSent.length}, deleted=${subscriptionsToDelete.length}, failures=${subscriptionsToIncFailure.length}`);

    return new Response(
      JSON.stringify({ sent: totalSent, processed: notificationsMarkedSent.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-push] Unhandled error:", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getNotificationTitle(notification: { type: string; shop_name?: string }): string {
  switch (notification.type) {
    case "new_review":
      return notification.shop_name
        ? `New review at ${notification.shop_name}`
        : "New review posted";
    case "photo_comment":
      return "New comment on your review";
    case "comment_reply":
      return "New reply in a thread";
    case "photo_like":
      return "Someone liked your photo";
    case "comment_like":
      return "Someone liked your comment";
    case "comment_reaction":
      return "New reaction on your comment";
    default:
      return "Talia's Coffee";
  }
}
