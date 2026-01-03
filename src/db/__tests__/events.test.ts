import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool, query } from "../index.js";
import {
  createEvent,
  getEventById,
  getEventByIdAndToken,
  getEventsByCreator,
  updateEvent,
} from "../events.js";
import { upsertUser, getUsersByIds } from "../users.js";
import { upsertRsvp, getAttendeeCount } from "../rsvps.js";

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

  it("retrieves event by id and valid token", async () => {
    const created = await createEvent({
      creator_id: testUserId,
      title: "Token Test Event",
    });

    // Valid token should return the event
    const found = await getEventByIdAndToken(created.id, created.share_token);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);

    // Invalid token should return null
    const notFound = await getEventByIdAndToken(created.id, "invalid_token");
    expect(notFound).toBeNull();
  });

  it("updateEvent only allows whitelisted fields", async () => {
    const created = await createEvent({
      creator_id: testUserId,
      title: "Update Test",
    });

    // Update allowed field
    const updated = await updateEvent(created.id, { title: "Updated Title" });
    expect(updated?.title).toBe("Updated Title");

    // Attempting to update protected fields should be ignored
    // Cast to any to bypass TypeScript - simulating malicious input
    const attemptProtected = await updateEvent(created.id, {
      title: "Another Update",
      share_token: "hacked_token",
      creator_id: 12345,
    } as Record<string, unknown>);
    expect(attemptProtected?.title).toBe("Another Update");
    expect(attemptProtected?.share_token).toBe(created.share_token);
    expect(Number(attemptProtected?.creator_id)).toBe(testUserId);
  });

  it("getUsersByIds returns map of users", async () => {
    const user2Id = testUserId + 1;
    await upsertUser(user2Id, "testuser2", "Test User 2");

    const usersMap = await getUsersByIds([testUserId, user2Id]);
    expect(usersMap.size).toBe(2);
    expect(usersMap.get(testUserId)?.username).toBe("testuser");
    expect(usersMap.get(user2Id)?.username).toBe("testuser2");

    // Empty array should return empty map
    const emptyMap = await getUsersByIds([]);
    expect(emptyMap.size).toBe(0);

    // Cleanup
    await query("DELETE FROM users WHERE tg_id = $1", [user2Id]);
  });

  it("getAttendeeCount sums guests correctly", async () => {
    const event = await createEvent({
      creator_id: testUserId,
      title: "Attendee Count Test",
    });

    // No RSVPs yet
    const initialCount = await getAttendeeCount(event.id);
    expect(initialCount).toBe(0);

    // Add RSVP with 2 guests
    await upsertRsvp(event.id, testUserId, "going", 2);
    const withGuests = await getAttendeeCount(event.id);
    expect(withGuests).toBe(3); // 1 user + 2 guests

    // Add another user with 1 guest
    const user2Id = testUserId + 2;
    await upsertUser(user2Id, "testuser3", "Test User 3");
    await upsertRsvp(event.id, user2Id, "going", 1);
    const totalCount = await getAttendeeCount(event.id);
    expect(totalCount).toBe(5); // (1+2) + (1+1)

    // Maybe status should not count
    const user3Id = testUserId + 3;
    await upsertUser(user3Id, "testuser4", "Test User 4");
    await upsertRsvp(event.id, user3Id, "maybe", 5);
    const stillFive = await getAttendeeCount(event.id);
    expect(stillFive).toBe(5); // Only "going" counts

    // Cleanup - RSVPs first due to FK constraint
    await query("DELETE FROM rsvps WHERE event_id = $1", [event.id]);
    await query("DELETE FROM users WHERE tg_id = $1", [user2Id]);
    await query("DELETE FROM users WHERE tg_id = $1", [user3Id]);
  });
});
