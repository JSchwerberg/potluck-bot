import crypto from "crypto";
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

function generateShareToken(): string {
  return crypto.randomBytes(6).toString("hex");
}

export async function createEvent(input: CreateEventInput): Promise<Event> {
  const shareToken = generateShareToken();
  const result = await query<Event>(
    `INSERT INTO events (creator_id, title, description, location, event_date, max_attendees, allow_guests, food_mode, share_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
      shareToken,
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

export async function getEventByIdAndToken(
  id: string,
  token: string
): Promise<Event | null> {
  const result = await query<Event>(
    "SELECT * FROM events WHERE id = $1 AND share_token = $2",
    [id, token]
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

// Whitelist of fields that can be updated
const ALLOWED_UPDATE_FIELDS = [
  "title",
  "description",
  "location",
  "event_date",
  "max_attendees",
  "allow_guests",
  "food_mode",
  "status",
] as const;

export async function updateEvent(
  id: string,
  updates: Partial<Omit<Event, "id" | "creator_id" | "created_at" | "share_token">>
): Promise<Event | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  // Filter to only allowed fields
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && ALLOWED_UPDATE_FIELDS.includes(key as typeof ALLOWED_UPDATE_FIELDS[number])) {
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
