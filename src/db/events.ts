import { query } from "./index.js";
import type { Event, FoodMode } from "../types.js";

export interface CreateEventInput {
  creator_id: number;
  title: string;
  description?: string;
  location?: string;
  event_date?: Date;
  max_attendees?: number;
  allow_guests?: boolean;
  food_mode?: FoodMode;
}

export async function createEvent(input: CreateEventInput): Promise<Event> {
  const result = await query<Event>(
    `INSERT INTO events (creator_id, title, description, location, event_date, max_attendees, allow_guests, food_mode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.creator_id,
      input.title,
      input.description ?? null,
      input.location ?? null,
      input.event_date ?? null,
      input.max_attendees ?? null,
      input.allow_guests ?? true,
      input.food_mode ?? "categories",
    ]
  );
  return result.rows[0];
}

export async function getEventById(id: string): Promise<Event | null> {
  const result = await query<Event>(
    "SELECT * FROM events WHERE id = $1",
    [id]
  );
  return result.rows[0] ?? null;
}

export async function getEventsByCreator(creatorId: number): Promise<Event[]> {
  const result = await query<Event>(
    "SELECT * FROM events WHERE creator_id = $1 AND status = 'active' ORDER BY created_at DESC",
    [creatorId]
  );
  return result.rows;
}

export async function updateEvent(
  id: string,
  updates: Partial<Omit<Event, "id" | "creator_id" | "created_at">>
): Promise<Event | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (fields.length === 0) return getEventById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query<Event>(
    `UPDATE events SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}
