import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool, query } from "../index.js";
import { createEvent, getEventById, getEventsByCreator } from "../events.js";
import { upsertUser } from "../users.js";

describe("events repository", () => {
  const testUserId = 999999999;

  beforeAll(async () => {
    // Create test user
    await upsertUser(testUserId, "testuser", "Test User");
  });

  afterAll(async () => {
    // Cleanup
    await query("DELETE FROM events WHERE creator_id = $1", [testUserId]);
    await query("DELETE FROM users WHERE tg_id = $1", [testUserId]);
    await pool.end();
  });

  it("creates an event", async () => {
    const event = await createEvent({
      creator_id: testUserId,
      title: "Test Potluck",
      description: "A test event",
    });

    expect(event.id).toBeDefined();
    expect(event.title).toBe("Test Potluck");
    // PostgreSQL BIGINT returns as string, convert for comparison
    expect(Number(event.creator_id)).toBe(testUserId);
    expect(event.status).toBe("active");
  });

  it("retrieves event by id", async () => {
    const created = await createEvent({
      creator_id: testUserId,
      title: "Another Test",
    });

    const found = await getEventById(created.id);
    expect(found).not.toBeNull();
    expect(found?.title).toBe("Another Test");
  });

  it("retrieves events by creator", async () => {
    const events = await getEventsByCreator(testUserId);
    expect(events.length).toBeGreaterThan(0);
    // PostgreSQL BIGINT returns as string, convert for comparison
    expect(events.every((e) => Number(e.creator_id) === testUserId)).toBe(true);
  });
});
