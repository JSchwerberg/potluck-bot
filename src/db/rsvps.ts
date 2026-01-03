import { query } from "./index.js";
import type { Rsvp, RsvpStatus, Dish, Allergen, DishWithAllergens } from "../types.js";

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

// Allergen functions
export async function getAllAllergens(): Promise<Allergen[]> {
  const result = await query<Allergen>(
    "SELECT * FROM allergens ORDER BY is_dietary_preference DESC, display_name"
  );
  return result.rows;
}

export async function getAllergensByIds(ids: number[]): Promise<Allergen[]> {
  if (ids.length === 0) return [];
  const result = await query<Allergen>(
    "SELECT * FROM allergens WHERE id = ANY($1)",
    [ids]
  );
  return result.rows;
}

export async function getAllergensByNames(names: string[]): Promise<Allergen[]> {
  if (names.length === 0) return [];
  const result = await query<Allergen>(
    "SELECT * FROM allergens WHERE name = ANY($1)",
    [names]
  );
  return result.rows;
}

// Dish functions
export async function addDish(
  rsvpId: string,
  category: string,
  description: string,
  allergenIds: number[] = []
): Promise<DishWithAllergens> {
  // Insert the dish
  const dishResult = await query<Dish>(
    `INSERT INTO dishes (rsvp_id, category, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [rsvpId, category, description]
  );
  const dish = dishResult.rows[0];

  // Insert allergen associations
  if (allergenIds.length > 0) {
    const values = allergenIds
      .map((_, i) => `($1, $${i + 2})`)
      .join(", ");
    await query(
      `INSERT INTO dish_allergens (dish_id, allergen_id) VALUES ${values}`,
      [dish.id, ...allergenIds]
    );
  }

  // Fetch allergens for the dish
  const allergens = await getAllergensByIds(allergenIds);

  return { ...dish, allergens };
}

export async function getDishesForRsvp(rsvpId: string): Promise<DishWithAllergens[]> {
  const dishResult = await query<Dish>(
    "SELECT * FROM dishes WHERE rsvp_id = $1",
    [rsvpId]
  );

  return Promise.all(dishResult.rows.map(async (dish) => {
    const allergens = await getAllergensForDish(dish.id);
    return { ...dish, allergens };
  }));
}

export async function getDishesForEvent(eventId: string): Promise<DishWithAllergens[]> {
  const dishResult = await query<Dish>(
    `SELECT d.* FROM dishes d
     JOIN rsvps r ON d.rsvp_id = r.id
     WHERE r.event_id = $1`,
    [eventId]
  );

  return Promise.all(dishResult.rows.map(async (dish) => {
    const allergens = await getAllergensForDish(dish.id);
    return { ...dish, allergens };
  }));
}

export async function getAllergensForDish(dishId: string): Promise<Allergen[]> {
  const result = await query<Allergen>(
    `SELECT a.* FROM allergens a
     JOIN dish_allergens da ON a.id = da.allergen_id
     WHERE da.dish_id = $1
     ORDER BY a.is_dietary_preference DESC, a.display_name`,
    [dishId]
  );
  return result.rows;
}

export async function deleteRsvp(eventId: string, userId: number): Promise<void> {
  await query("DELETE FROM rsvps WHERE event_id = $1 AND user_id = $2", [
    eventId,
    userId,
  ]);
}
