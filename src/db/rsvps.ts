import { query } from "./index.js";
import type { Rsvp, RsvpStatus, Dish } from "../types.js";

export async function upsertRsvp(
  eventId: string,
  userId: number,
  status: RsvpStatus,
  guestCount: number = 0,
  guestNames: string | null = null
): Promise<Rsvp> {
  const result = await query<Rsvp>(
    `INSERT INTO rsvps (event_id, user_id, status, guest_count, guest_names)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (event_id, user_id) DO UPDATE SET
       status = EXCLUDED.status,
       guest_count = EXCLUDED.guest_count,
       guest_names = EXCLUDED.guest_names,
       updated_at = NOW()
     RETURNING *`,
    [eventId, userId, status, guestCount, guestNames]
  );
  return result.rows[0];
}

export async function getRsvp(
  eventId: string,
  userId: number
): Promise<Rsvp | null> {
  const result = await query<Rsvp>(
    "SELECT * FROM rsvps WHERE event_id = $1 AND user_id = $2",
    [eventId, userId]
  );
  return result.rows[0] ?? null;
}

export async function getRsvpsForEvent(eventId: string): Promise<Rsvp[]> {
  const result = await query<Rsvp>(
    "SELECT * FROM rsvps WHERE event_id = $1 ORDER BY created_at",
    [eventId]
  );
  return result.rows;
}

export async function getAttendeeCount(eventId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COALESCE(SUM(1 + guest_count), 0) as count
     FROM rsvps WHERE event_id = $1 AND status = 'going'`,
    [eventId]
  );
  return parseInt(result.rows[0].count, 10);
}

export async function addDish(
  rsvpId: string,
  category: string,
  description: string,
  allergens: {
    is_vegan?: boolean;
    is_vegetarian?: boolean;
    is_gluten_free?: boolean;
    contains_nuts?: boolean;
    contains_dairy?: boolean;
  } = {}
): Promise<Dish> {
  const result = await query<Dish>(
    `INSERT INTO dishes (rsvp_id, category, description, is_vegan, is_vegetarian, is_gluten_free, contains_nuts, contains_dairy)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      rsvpId,
      category,
      description,
      allergens.is_vegan ?? false,
      allergens.is_vegetarian ?? false,
      allergens.is_gluten_free ?? false,
      allergens.contains_nuts ?? false,
      allergens.contains_dairy ?? false,
    ]
  );
  return result.rows[0];
}

export async function getDishesForRsvp(rsvpId: string): Promise<Dish[]> {
  const result = await query<Dish>(
    "SELECT * FROM dishes WHERE rsvp_id = $1",
    [rsvpId]
  );
  return result.rows;
}

export async function getDishesForEvent(eventId: string): Promise<Dish[]> {
  const result = await query<Dish>(
    `SELECT d.* FROM dishes d
     JOIN rsvps r ON d.rsvp_id = r.id
     WHERE r.event_id = $1`,
    [eventId]
  );
  return result.rows;
}

export async function deleteRsvp(eventId: string, userId: number): Promise<void> {
  await query("DELETE FROM rsvps WHERE event_id = $1 AND user_id = $2", [
    eventId,
    userId,
  ]);
}
