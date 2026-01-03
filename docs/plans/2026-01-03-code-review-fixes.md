# Code Review Fixes Plan

Fixes for issues identified in CODE_REVIEW.md.

## Task 1: Install @grammyjs/parse-mode and Refactor Formatting (Critical)

Replace Markdown string formatting with entity-based formatting to prevent injection.

**Steps:**
1. Run `npm install @grammyjs/parse-mode`
2. Create `src/utils/format.ts` with re-exports for convenient imports
3. Update `src/conversations/createEvent.ts`:
   - Import `fmt`, `bold`, `italic` from parse-mode
   - Replace summary construction with `fmt` template
   - Change `ctx.reply(..., { parse_mode: "Markdown" })` to `ctx.reply(msg.text, { entities: msg.entities })`
4. Update `src/conversations/rsvp.ts`:
   - Replace event title display and confirmation message
5. Update `src/handlers/inline.ts`:
   - Update `buildEventCard` to return entity-based formatting
   - Update `input_message_content` to use entities instead of parse_mode
6. Update `src/handlers/details.ts`:
   - Replace all Markdown formatting with fmt/entities

**Verify:** `npm run build` compiles, bot messages display correctly without user-injected formatting.

---

## Task 2: Add Share Tokens (High)

Add share_token column to events for access control.

**Steps:**
1. Create `migrations/003-add-share-token.sql`:
   ```sql
   ALTER TABLE events ADD COLUMN share_token VARCHAR(12);
   UPDATE events SET share_token = substr(md5(random()::text), 1, 12);
   ALTER TABLE events ALTER COLUMN share_token SET NOT NULL;
   ```
2. Update `src/types.ts` - add `share_token: string` to Event interface
3. Update `src/db/events.ts`:
   - `createEvent`: generate 12-char hex token using `crypto.randomBytes(6).toString('hex')`
   - Add `getEventByIdAndToken(id, token)` function
4. Update `src/conversations/createEvent.ts`:
   - Update share button callback to include token: `share_${event.id}_${event.share_token}`
5. Update `src/handlers/inline.ts`:
   - Include token in RSVP/details button callbacks
6. Update `src/conversations/rsvp.ts`:
   - Parse `rsvp_{eventId}_{token}` format
   - Validate token matches event
7. Update `src/handlers/callbacks.ts`:
   - Parse token from callback data
   - Validate before redirecting
8. Update `src/handlers/details.ts` / `src/index.ts`:
   - Parse and validate token for details deep link

**Verify:** `npm run migrate`, old links fail, new links with token work.

---

## Task 3: Enforce Capacity (Critical)

Block RSVPs that would exceed max_attendees.

**Steps:**
1. Update `src/db/rsvps.ts`:
   - Add `getRsvpWithCount(eventId, userId)` to get existing RSVP if any
2. Update `src/conversations/rsvp.ts`:
   - After collecting guest count, calculate projected total
   - If user has existing RSVP, subtract their current count
   - If projected > max_attendees, show error and offer "Maybe" or fewer guests
   - Only block "going" status, allow "maybe"/"declined"

**Verify:** Create event with max 2, RSVP as going+1 guest, try second RSVP - should be blocked.

---

## Task 4: Check Event Status (High)

Reject RSVPs for cancelled/completed events.

**Steps:**
1. Update `src/conversations/rsvp.ts`:
   - After fetching event, check `event.status !== "active"`
   - If not active, reply "This event is no longer accepting RSVPs." and return

**Verify:** Set event status to 'cancelled' in DB, try RSVP - should be rejected.

---

## Task 5: Handle Skip Buttons (High)

Fix unhandled skip buttons in create-event flow.

**Steps:**
1. Update `src/conversations/createEvent.ts`:
   - For description step: use `conversation.wait()` instead of `waitFor`
   - Check for `callbackQuery?.data === "skip_desc"`, answer and skip
   - Apply same pattern to location and date steps if they have skip buttons

**Verify:** Click "Skip" button in event creation - should acknowledge and proceed.

---

## Task 6: Validate Guest Count (High)

Prevent negative/excessive guest counts.

**Steps:**
1. Update `src/conversations/rsvp.ts`:
   - After parsing guest count from "More..." option
   - Validate: `isNaN(parsed) || parsed < 0 || parsed > 20`
   - If invalid, reply with error and re-prompt or default to 0

**Verify:** Enter -5 or 1000 as guest count - should reject and re-prompt.

---

## Task 7: Whitelist updateEvent Fields (Medium)

Prevent arbitrary field updates.

**Steps:**
1. Update `src/db/events.ts`:
   - Define `ALLOWED_UPDATE_FIELDS` constant
   - Filter updates object before building query
   - Remove `updated_at` from iteration (it's added explicitly)

**Verify:** `npm run build`, existing update functionality works.

---

## Task 8: Batch Database Queries (Medium)

Fix N+1 queries in details view and dish allergens.

**Steps:**
1. Update `src/db/users.ts`:
   - Add `getUsersByIds(ids: number[]): Promise<Map<number, User>>`
2. Update `src/db/rsvps.ts`:
   - Rewrite `getDishesForEvent` to use single JOIN query
   - Group allergens by dish_id in application code
3. Update `src/handlers/details.ts`:
   - Fetch all users in one call at start
   - Pass user map to `buildAttendeeList`

**Verify:** Check DB query count in details view (should be ~3 queries instead of N+1).

---

## Task 9: Remove dish_slots Table (Low)

Clean up unused schema.

**Steps:**
1. Create `migrations/004-remove-dish-slots.sql`:
   ```sql
   DROP TABLE IF EXISTS dish_slots;
   ```
2. Update `src/types.ts`:
   - Remove `DishSlot` interface

**Verify:** `npm run migrate`, `npm run build`.

---

## Task 10: Add Graceful Shutdown (Low)

Close database pool on process termination.

**Steps:**
1. Update `src/index.ts`:
   - Add SIGINT/SIGTERM handlers to stop bot
   - Add pool.end() on shutdown
   - Add bot.catch() for error logging

**Verify:** Start bot, send SIGINT (Ctrl+C), check clean exit without hanging.

---

## Task 11: Expand Test Coverage (Low)

Add tests for RSVPs and critical business logic.

**Steps:**
1. Create `src/db/__tests__/rsvps.test.ts`:
   - Test upsertRsvp create and update
   - Test getAttendeeCount with guests
   - Test addDish with allergens
2. Create `src/db/__tests__/users.test.ts`:
   - Test upsertUser and getUsersByIds
3. Update existing tests to verify share token generation

**Verify:** `npm test` - all tests pass.
