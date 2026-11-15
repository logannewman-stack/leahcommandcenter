/**
 * A phone notification, signed with the Practice app's own VAPID pair
 * (`push_keys`, one row) and sent to each device the member subscribed
 * (`push_subscriptions`). The Day 1 step of the Welcome Journey is "in app",
 * and this is how it reaches the phone.
 *
 * `web-push` is loaded only when a push is sent, so the suite and a
 * deployment that never sends one carry nothing for it.
 */

const SEND_TIMEOUT_MS = 10_000;

/**
 * @param {any} db  the service-key client
 * @param {string} userId
 * @param {{ title: string, body: string, url: string }} payload
 * @returns {Promise<{ sent: boolean, skipped: boolean, error: string, devices?: number }>}
 */
export async function sendPush(db, userId, payload) {
  const { data: keys } = await db.from("push_keys").select("public_key, private_key").eq("id", 1).maybeSingle();
  if (!keys?.public_key || !keys?.private_key) return { sent: false, skipped: true, error: "no_push_keys" };
  const { data: devices } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId).limit(10);
  if (!devices?.length) return { sent: false, skipped: true, error: "no_devices" };

  let webpush;
  try {
    webpush = (await import("web-push")).default;
  } catch {
    return { sent: false, skipped: true, error: "no_web_push" };
  }
  const subject = process.env.VAPID_SUBJECT || "mailto:practice@innerboard.com";
  let delivered = 0;
  for (const device of devices) {
    try {
      await webpush.sendNotification(
        { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
        JSON.stringify({ title: payload.title, body: payload.body, url: payload.url }),
        { TTL: 60 * 60 * 12, timeout: SEND_TIMEOUT_MS, vapidDetails: { subject, publicKey: keys.public_key, privateKey: keys.private_key } }
      );
      delivered += 1;
    } catch (error) {
      // A device that is gone (410) is the Practice app's to forget; here it is one fewer.
      console.warn("push:", error?.statusCode || error?.message);
    }
  }
  return delivered ? { sent: true, skipped: false, error: "", devices: delivered } : { sent: false, skipped: false, error: "no_device_took_it" };
}
