import admin from 'firebase-admin';
import { pool } from '../config/database.js';

let firebaseApp = null;

/**
 * Safely initialize Firebase Admin SDK singleton.
 * Returns null if Firebase environment credentials are not configured or invalid.
 */
function getFirebaseAdmin() {
  if (firebaseApp) return firebaseApp;

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  let privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();

  // If credentials are unset or empty, do not initialize
  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  // Handle escaped newlines in .env files (e.g. "\\n" -> "\n")
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    console.log('[FirebaseAdmin] Initialized successfully for project:', projectId);
    return firebaseApp;
  } catch (err) {
    console.warn('[FirebaseAdmin] Initialization warning (push notifications disabled):', err.message);
    return null;
  }
}

/**
 * Service to handle parent notifications, n8n webhook triggers, and FCM push notifications.
 *
 * @param {Object} params
 * @param {number} params.tripId
 * @param {Object} params.trip
 * @param {Object} params.stop
 * @param {boolean} params.isFinalStop
 * @param {Date|string} params.reachedAt
 */
export async function notifyStopReached({
  tripId,
  trip,
  stop,
  isFinalStop = false,
  reachedAt = new Date().toISOString(),
}) {
  const stopName = stop.name;
  const title = isFinalStop
    ? `🏁 Bus Reached Final Stop: ${stopName}`
    : `🚌 Bus Reached: ${stopName}`;
  const body = isFinalStop
    ? `The school bus (${trip.bus_number}) has reached the final destination: ${stopName}. Trip is completing.`
    : `The school bus (${trip.bus_number}) on route "${trip.route_name}" has arrived at ${stopName}.`;

  // 1. Identify relevant recipients to notify:
  // Query parents linked to students who are assigned to this trip via student_transport_status,
  // joined strictly with parent_students (authoritative relationship table).
  const [tripParentUsers] = await pool.execute(`
    SELECT DISTINCT u.id AS user_id, u.full_name, u.phone, u.email, sts.student_id
    FROM student_transport_status sts
    JOIN parent_students ps ON ps.student_id = sts.student_id
    JOIN parents p ON p.parent_id = ps.parent_id
    JOIN users u ON u.id = p.user_id
    WHERE sts.trip_id = ? AND u.role = 'PARENT' AND u.is_active = TRUE
  `, [tripId]);

  let targetRecipients = tripParentUsers;

  // If no specific student enrollment on this trip yet, notify active parents of all students in the system
  if (targetRecipients.length === 0) {
    const [allParentUsers] = await pool.execute(`
      SELECT DISTINCT u.id AS user_id, u.full_name, u.phone, u.email, ps.student_id
      FROM users u
      JOIN parents p ON p.user_id = u.id
      LEFT JOIN parent_students ps ON ps.parent_id = p.parent_id
      WHERE u.role = 'PARENT' AND u.is_active = TRUE
    `);
    targetRecipients = allParentUsers;
  }

  // If still no parent user accounts exist yet in testing, record notification for the admin user
  if (targetRecipients.length === 0) {
    const [adminUsers] = await pool.execute(`
      SELECT id AS user_id, full_name, phone, email, NULL AS student_id
      FROM users
      WHERE role = 'ADMIN' AND is_active = TRUE
      LIMIT 1
    `);
    targetRecipients = adminUsers;
  }

  // 2. Insert In-App Notifications for each targeted recipient (ALWAYS EXECUTED)
  const insertedNotificationIds = [];
  for (const recipient of targetRecipients) {
    try {
      const [res] = await pool.execute(
        `INSERT INTO notifications (user_id, title, body, type, trip_id, student_id, is_read, sent_at)
         VALUES (?, ?, ?, 'STOP_REACHED', ?, ?, 0, NOW())`,
        [recipient.user_id, title, body, tripId, recipient.student_id || null]
      );
      insertedNotificationIds.push(res.insertId);
    } catch (err) {
      console.warn(`[Notification] Failed to create in-app notification for user ${recipient.user_id}:`, err.message);
    }
  }

  // 3. Structured Event Payload for n8n and FCM
  const eventPayload = {
    event: 'STOP_REACHED',
    trip_id: Number(tripId),
    bus_id: Number(trip.bus_id),
    bus_number: trip.bus_number,
    registration_number: trip.registration_number,
    route_id: Number(trip.route_id),
    route_name: trip.route_name,
    route_code: trip.route_code,
    stop_id: Number(stop.id),
    stop_name: stop.name,
    stop_order: Number(stop.stop_order),
    is_final_stop: Boolean(isFinalStop),
    reached_at: reachedAt,
    title,
    body,
    recipient_count: targetRecipients.length,
  };

  // 4. n8n Webhook Trigger (if N8N_WEBHOOK_URL is configured in environment)
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  if (n8nWebhookUrl) {
    try {
      fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload),
        signal: AbortSignal.timeout(4000),
      }).catch((err) => {
        console.warn('[n8n Webhook] Failed to deliver event to n8n:', err.message);
      });
    } catch (err) {
      console.warn('[n8n Webhook] Unexpected error dispatching to n8n:', err.message);
    }
  }

  // 5. Firebase Cloud Messaging (FCM) Push Notification Channel
  const fcmAdmin = getFirebaseAdmin();
  if (fcmAdmin && targetRecipients.length > 0) {
    try {
      const userIds = targetRecipients.map((p) => p.user_id);
      const placeholders = userIds.map(() => '?').join(',');
      const [tokenRows] = await pool.execute(
        `SELECT DISTINCT token FROM device_tokens WHERE user_id IN (${placeholders})`,
        userIds
      );

      const tokens = tokenRows.map((r) => r.token).filter(Boolean);

      if (tokens.length > 0) {
        const fcmPayload = {
          notification: {
            title,
            body,
          },
          data: {
            type: 'STOP_REACHED',
            trip_id: String(tripId),
            stop_id: String(stop.id),
            stop_name: String(stopName),
            bus_number: String(trip.bus_number || ''),
            route_name: String(trip.route_name || ''),
            reached_at: String(reachedAt),
          },
          tokens,
        };

        const response = await admin.messaging(fcmAdmin).sendEachForMulticast(fcmPayload);
        console.log(`[FCM] Push dispatched: ${response.successCount} succeeded, ${response.failureCount} failed out of ${tokens.length} token(s).`);

        // Automatically clean up invalid or unregistered tokens
        if (response.failureCount > 0) {
          const staleTokens = [];
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const errCode = resp.error?.code;
              if (
                errCode === 'messaging/registration-token-not-registered' ||
                errCode === 'messaging/invalid-registration-token' ||
                errCode === 'messaging/invalid-argument'
              ) {
                staleTokens.push(tokens[idx]);
              }
            }
          });

          if (staleTokens.length > 0) {
            const stalePlaceholders = staleTokens.map(() => '?').join(',');
            await pool.execute(
              `DELETE FROM device_tokens WHERE token IN (${stalePlaceholders})`,
              staleTokens
            );
            console.log(`[FCM] Cleaned up ${staleTokens.length} stale/unregistered device token(s).`);
          }
        }
      } else {
        console.log(`[FCM] Notice: No active device tokens registered for target recipients.`);
      }
    } catch (err) {
      console.warn('[FCM] Error dispatching push notification:', err.message);
    }
  } else if (!fcmAdmin) {
    // Expected when Firebase credentials are not yet configured in .env
    // In-app notifications have already been safely written to MySQL in Step 2
  }

  return {
    success: true,
    notificationsCount: insertedNotificationIds.length,
    eventPayload,
  };
}
