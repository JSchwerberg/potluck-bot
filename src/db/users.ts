import { query } from "./index.js";
import type { User } from "../types.js";

export async function upsertUser(
  tgId: number,
  username: string | null,
  displayName: string | null
): Promise<User> {
  const result = await query<User>(
    `INSERT INTO users (tg_id, username, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (tg_id) DO UPDATE SET
       username = EXCLUDED.username,
       display_name = EXCLUDED.display_name
     RETURNING *`,
    [tgId, username, displayName]
  );
  return result.rows[0];
}

export async function getUserById(tgId: number): Promise<User | null> {
  const result = await query<User>(
    "SELECT * FROM users WHERE tg_id = $1",
    [tgId]
  );
  return result.rows[0] ?? null;
}
