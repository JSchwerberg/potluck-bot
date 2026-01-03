# Potluck Telegram Bot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Telegram bot for managing potluck events with admin controls, inline sharing, and structured RSVP flows.

**Architecture:** TypeScript bot using `grammy` framework with PostgreSQL for persistence. All user interactions flow through inline keyboards, with complex input (dish details) handled in private chat via deep-linking.

**Tech Stack:** Node.js 20+, TypeScript, grammy, pg (node-postgres), postgres-migrations, Docker (for local Postgres).

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `src/index.ts`

**Step 1: Initialize npm project**

Run: `npm init -y`

**Step 2: Install dependencies**

Run: `npm install grammy pg dotenv`
Run: `npm install -D typescript @types/node @types/pg tsx`

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create .env.example**

```
BOT_TOKEN=your_telegram_bot_token_here
DATABASE_URL=postgres://postgres:postgres@localhost:5432/potluck
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
.env
*.log
```

**Step 6: Create src/index.ts (minimal bot)**

```typescript
import { Bot } from "grammy";
import "dotenv/config";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN environment variable is required");
}

const bot = new Bot(token);

bot.command("start", (ctx) => ctx.reply("Welcome to Potluck Bot!"));

bot.start();
console.log("Bot started");
```

**Step 7: Add npm scripts to package.json**

Edit `package.json` to add:
```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**Step 8: Verify bot starts**

Run: `echo "BOT_TOKEN=test" > .env && npm run build`
Expected: Compiles without errors (will fail at runtime without real token, that's OK).

**Step 9: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Node.js/TypeScript project with grammy"
```

---

## Task 2: Database Setup & Migrations

**Files:**
- Create: `docker-compose.yml`
- Create: `migrations/001-initial-schema.sql`
- Create: `src/db/index.ts`
- Create: `src/db/migrate.ts`

**Step 1: Create docker-compose.yml**

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: potluck
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**Step 2: Start Postgres**

Run: `docker compose up -d`
Expected: Postgres container running on port 5432.

**Step 3: Install migration library**

Run: `npm install postgres-migrations`

**Step 4: Create migrations directory**

Run: `mkdir -p migrations`

**Step 5: Create initial migration file**

Create `migrations/001-initial-schema.sql`:

```sql
-- Users table (Telegram users)
CREATE TABLE users (
    tg_id BIGINT PRIMARY KEY,
    username VARCHAR(255),
    display_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id BIGINT NOT NULL REFERENCES users(tg_id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location TEXT,
    event_date TIMESTAMPTZ,
    max_attendees INT,
    allow_guests BOOLEAN DEFAULT TRUE,
    food_mode VARCHAR(20) DEFAULT 'categories', -- 'categories' or 'slots'
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'cancelled', 'completed'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dish categories (for slot mode)
CREATE TABLE dish_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    max_count INT, -- NULL means unlimited
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RSVPs table
CREATE TABLE rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(tg_id),
    status VARCHAR(20) NOT NULL DEFAULT 'going', -- 'going', 'maybe', 'declined'
    guest_count INT DEFAULT 0,
    guest_names TEXT, -- Optional comma-separated names
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- Dishes table
CREATE TABLE dishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rsvp_id UUID NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    description VARCHAR(255) NOT NULL,
    is_vegan BOOLEAN DEFAULT FALSE,
    is_vegetarian BOOLEAN DEFAULT FALSE,
    is_gluten_free BOOLEAN DEFAULT FALSE,
    contains_nuts BOOLEAN DEFAULT FALSE,
    contains_dairy BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_events_creator ON events(creator_id);
CREATE INDEX idx_rsvps_event ON rsvps(event_id);
CREATE INDEX idx_rsvps_user ON rsvps(user_id);
CREATE INDEX idx_dishes_rsvp ON dishes(rsvp_id);
```

**Step 6: Create src/db/index.ts**

```typescript
import pg from "pg";
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const pool = new Pool({ connectionString });

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}
```

**Step 7: Create src/db/migrate.ts**

```typescript
import { migrate } from "postgres-migrations";
import "dotenv/config";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL is required");
}

const url = new URL(dbUrl);

async function runMigrations() {
  await migrate(
    {
      host: url.hostname,
      port: parseInt(url.port || "5432"),
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
    },
    "./migrations"
  );
  console.log("Migrations complete");
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
```

**Step 8: Add migrate script to package.json**

Add to scripts:
```json
"migrate": "tsx src/db/migrate.ts"
```

**Step 9: Update .env.example**

Ensure it has:
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/potluck
```

**Step 10: Run migrations**

Run: `cp .env.example .env && npm run migrate`
Expected: "Migrations complete"

**Step 11: Verify schema**

Run: `docker exec -it $(docker ps -qf "name=postgres") psql -U postgres -d potluck -c "\dt"`
Expected: Lists users, events, rsvps, dishes, dish_slots tables.

**Step 12: Commit**

```bash
git add .
git commit -m "feat(db): add PostgreSQL schema and migration system"
```

---

## Task 3: Core Types & Repository Layer

**Files:**
- Create: `src/types.ts`
- Create: `src/db/users.ts`
- Create: `src/db/events.ts`
- Create: `src/db/rsvps.ts`

**Step 1: Create src/types.ts**

```typescript
export interface User {
  tg_id: number;
  username: string | null;
  display_name: string | null;
  created_at: Date;
}

export type EventStatus = "active" | "cancelled" | "completed";
export type FoodMode = "categories" | "slots";

export interface Event {
  id: string;
  creator_id: number;
  title: string;
  description: string | null;
  location: string | null;
  event_date: Date | null;
  max_attendees: number | null;
  allow_guests: boolean;
  food_mode: FoodMode;
  status: EventStatus;
  created_at: Date;
  updated_at: Date;
}

export type RsvpStatus = "going" | "maybe" | "declined";

export interface Rsvp {
  id: string;
  event_id: string;
  user_id: number;
  status: RsvpStatus;
  guest_count: number;
  guest_names: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Dish {
  id: string;
  rsvp_id: string;
  category: string;
  description: string;
  is_vegan: boolean;
  is_vegetarian: boolean;
  is_gluten_free: boolean;
  contains_nuts: boolean;
  contains_dairy: boolean;
  created_at: Date;
}

export interface DishSlot {
  id: string;
  event_id: string;
  category: string;
  max_count: number | null;
  created_at: Date;
}

export const DISH_CATEGORIES = [
  "main",
  "side",
  "dessert",
  "drink",
  "other",
] as const;

export type DishCategory = (typeof DISH_CATEGORIES)[number];
```

**Step 2: Create src/db/users.ts**

```typescript
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
```

**Step 3: Create src/db/events.ts**

```typescript
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
```

**Step 4: Create src/db/rsvps.ts**

```typescript
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
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat(db): add types and repository layer for users, events, rsvps"
```

---

## Task 4: Event Creation Wizard (Admin Flow)

**Files:**
- Create: `src/conversations/createEvent.ts`
- Modify: `src/index.ts`

**Step 1: Install conversations plugin**

Run: `npm install @grammyjs/conversations`

**Step 2: Create src/conversations/createEvent.ts**

```typescript
import type { Conversation, ConversationFlavor } from "@grammyjs/conversations";
import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { createEvent } from "../db/events.js";
import { upsertUser } from "../db/users.js";
import type { FoodMode } from "../types.js";

export type BotContext = Context & ConversationFlavor;
export type BotConversation = Conversation<BotContext>;

export async function createEventConversation(
  conversation: BotConversation,
  ctx: BotContext
) {
  const user = ctx.from;
  if (!user) {
    await ctx.reply("Could not identify user.");
    return;
  }

  // Ensure user exists in DB
  await conversation.external(() =>
    upsertUser(user.id, user.username ?? null, user.first_name)
  );

  // Step 1: Title
  await ctx.reply("Let's create a new event! What's the name of your potluck?");
  const titleMsg = await conversation.waitFor("message:text");
  const title = titleMsg.message.text;

  // Step 2: Description (optional)
  await ctx.reply(
    "Add a description (or send /skip):",
    { reply_markup: new InlineKeyboard().text("Skip", "skip_desc") }
  );
  let description: string | undefined;
  const descCtx = await conversation.wait();
  if (descCtx.message?.text && descCtx.message.text !== "/skip") {
    description = descCtx.message.text;
  }

  // Step 3: Location
  await ctx.reply("Where is it? (Send address or share location, or /skip)");
  let location: string | undefined;
  const locCtx = await conversation.wait();
  if (locCtx.message?.text && locCtx.message.text !== "/skip") {
    location = locCtx.message.text;
  } else if (locCtx.message?.location) {
    location = `${locCtx.message.location.latitude}, ${locCtx.message.location.longitude}`;
  }

  // Step 4: Date
  await ctx.reply("When is it? (e.g., 'Saturday 6pm' or '2026-01-15 18:00', or /skip)");
  let eventDate: Date | undefined;
  const dateCtx = await conversation.wait();
  if (dateCtx.message?.text && dateCtx.message.text !== "/skip") {
    const parsed = new Date(dateCtx.message.text);
    if (!isNaN(parsed.getTime())) {
      eventDate = parsed;
    } else {
      await ctx.reply("Couldn't parse that date, skipping for now.");
    }
  }

  // Step 5: Max attendees
  const maxKeyboard = new InlineKeyboard()
    .text("10", "max_10")
    .text("20", "max_20")
    .text("50", "max_50")
    .row()
    .text("Unlimited", "max_none");
  await ctx.reply("Max attendees?", { reply_markup: maxKeyboard });
  const maxCtx = await conversation.waitFor("callback_query:data");
  let maxAttendees: number | undefined;
  const maxData = maxCtx.callbackQuery.data;
  if (maxData.startsWith("max_") && maxData !== "max_none") {
    maxAttendees = parseInt(maxData.replace("max_", ""), 10);
  }
  await maxCtx.answerCallbackQuery();

  // Step 6: Food mode
  const foodKeyboard = new InlineKeyboard()
    .text("Categories (flexible)", "food_categories")
    .text("Slots (strict)", "food_slots");
  await ctx.reply(
    "How should food be organized?\n" +
      "- *Categories*: People pick a category (Main, Side, etc.)\n" +
      "- *Slots*: You define exactly what's needed",
    { reply_markup: foodKeyboard, parse_mode: "Markdown" }
  );
  const foodCtx = await conversation.waitFor("callback_query:data");
  const foodMode: FoodMode = foodCtx.callbackQuery.data === "food_slots" ? "slots" : "categories";
  await foodCtx.answerCallbackQuery();

  // Create the event
  const event = await conversation.external(() =>
    createEvent({
      creator_id: user.id,
      title,
      description,
      location,
      event_date: eventDate,
      max_attendees: maxAttendees,
      food_mode: foodMode,
    })
  );

  // Show summary
  const summary = [
    `*${event.title}*`,
    event.description ? `_${event.description}_` : null,
    event.location ? `Location: ${event.location}` : null,
    event.event_date ? `Date: ${event.event_date.toLocaleString()}` : null,
    event.max_attendees ? `Max: ${event.max_attendees} people` : "No limit",
    `Food: ${event.food_mode}`,
  ]
    .filter(Boolean)
    .join("\n");

  const adminKeyboard = new InlineKeyboard()
    .text("Edit", `edit_${event.id}`)
    .text("Share", `share_${event.id}`);

  await ctx.reply(`Event created!\n\n${summary}`, {
    reply_markup: adminKeyboard,
    parse_mode: "Markdown",
  });
}
```

**Step 3: Update src/index.ts to wire up conversations**

```typescript
import { Bot, session } from "grammy";
import {
  conversations,
  createConversation,
} from "@grammyjs/conversations";
import type { ConversationFlavor } from "@grammyjs/conversations";
import type { Context } from "grammy";
import "dotenv/config";

import { createEventConversation } from "./conversations/createEvent.js";

export type BotContext = Context & ConversationFlavor;

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN environment variable is required");
}

const bot = new Bot<BotContext>(token);

// Session & Conversations middleware
bot.use(
  session({
    initial: () => ({}),
  })
);
bot.use(conversations());
bot.use(createConversation(createEventConversation));

// Commands
bot.command("start", (ctx) =>
  ctx.reply(
    "Welcome to Potluck Bot!\n\n" +
      "Use /create to create a new event.\n" +
      "Use @YourBotName in any chat to share events."
  )
);

bot.command("create", async (ctx) => {
  await ctx.conversation.enter("createEventConversation");
});

bot.start();
console.log("Bot started");
```

**Step 4: Verify it compiles**

Run: `npm run build`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add .
git commit -m "feat(bot): add event creation wizard with conversations plugin"
```

---

## Task 5: Inline Mode (Sharing Events)

**Files:**
- Create: `src/handlers/inline.ts`
- Modify: `src/index.ts`

**Step 1: Create src/handlers/inline.ts**

```typescript
import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { getEventsByCreator, getEventById } from "../db/events.js";
import { getAttendeeCount, getRsvpsForEvent } from "../db/rsvps.js";
import type { Event } from "../types.js";

export function buildEventCard(
  event: Event,
  attendeeCount: number,
  forInline = false
): { text: string; keyboard: InlineKeyboard } {
  const lines = [
    `*${event.title}*`,
    event.description ? `_${event.description}_` : null,
    "",
    event.location ? `Location: ${event.location}` : null,
    event.event_date
      ? `Date: ${event.event_date.toLocaleDateString()} ${event.event_date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : null,
    "",
    event.max_attendees
      ? `Spots: ${attendeeCount}/${event.max_attendees}`
      : `Attendees: ${attendeeCount}`,
  ].filter((line) => line !== null);

  const keyboard = new InlineKeyboard()
    .text("RSVP", `rsvp_${event.id}`)
    .text("View Details", `details_${event.id}`);

  return { text: lines.join("\n"), keyboard };
}

export async function handleInlineQuery(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  const events = await getEventsByCreator(user.id);

  if (events.length === 0) {
    await ctx.answerInlineQuery([], {
      button: { text: "Create your first event", start_parameter: "create" },
      cache_time: 0,
    });
    return;
  }

  const results = await Promise.all(
    events.map(async (event) => {
      const count = await getAttendeeCount(event.id);
      const { text } = buildEventCard(event, count, true);

      return {
        type: "article" as const,
        id: event.id,
        title: event.title,
        description: event.description ?? `${count} attending`,
        input_message_content: {
          message_text: text,
          parse_mode: "Markdown" as const,
        },
        reply_markup: new InlineKeyboard()
          .text("RSVP", `rsvp_${event.id}`)
          .text("View Details", `details_${event.id}`),
      };
    })
  );

  await ctx.answerInlineQuery(results, { cache_time: 0 });
}
```

**Step 2: Update src/index.ts to add inline handler**

Add import:
```typescript
import { handleInlineQuery } from "./handlers/inline.js";
```

Add before `bot.start()`:
```typescript
bot.on("inline_query", handleInlineQuery);
```

**Step 3: Verify it compiles**

Run: `npm run build`
Expected: No errors.

**Step 4: Commit**

```bash
git add .
git commit -m "feat(bot): add inline query handler for sharing events"
```

---

## Task 6: RSVP Flow (Deep-Link to PM)

**Files:**
- Create: `src/conversations/rsvp.ts`
- Create: `src/handlers/callbacks.ts`
- Modify: `src/index.ts`

**Step 1: Create src/handlers/callbacks.ts**

```typescript
import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { getEventById } from "../db/events.js";
import { getAttendeeCount, getRsvpsForEvent, getDishesForEvent } from "../db/rsvps.js";
import { getUserById } from "../db/users.js";
import { buildEventCard } from "./inline.js";

export async function handleCallbackQuery(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  // RSVP button -> redirect to PM
  if (data.startsWith("rsvp_")) {
    const eventId = data.replace("rsvp_", "");
    const botInfo = await ctx.api.getMe();
    const deepLink = `https://t.me/${botInfo.username}?start=rsvp_${eventId}`;

    await ctx.answerCallbackQuery({
      url: deepLink,
    });
    return;
  }

  // View Details button -> send details in PM or as alert
  if (data.startsWith("details_")) {
    const eventId = data.replace("details_", "");
    const event = await getEventById(eventId);

    if (!event) {
      await ctx.answerCallbackQuery({ text: "Event not found", show_alert: true });
      return;
    }

    const rsvps = await getRsvpsForEvent(eventId);
    const dishes = await getDishesForEvent(eventId);

    // Build attendee list
    const attendeeLines: string[] = [];
    for (const rsvp of rsvps.filter((r) => r.status === "going")) {
      const user = await getUserById(rsvp.user_id);
      const name = user?.display_name ?? user?.username ?? `User ${rsvp.user_id}`;
      const guestStr = rsvp.guest_count > 0 ? ` (+${rsvp.guest_count})` : "";
      const userDishes = dishes.filter((d) => d.rsvp_id === rsvp.id);
      const dishStr = userDishes.length > 0
        ? `: ${userDishes.map((d) => d.description).join(", ")}`
        : "";
      attendeeLines.push(`- ${name}${guestStr}${dishStr}`);
    }

    const text = [
      `*${event.title}* - Attendees`,
      "",
      attendeeLines.length > 0 ? attendeeLines.join("\n") : "_No one yet!_",
    ].join("\n");

    // Send as a new message in PM
    const botInfo = await ctx.api.getMe();
    const deepLink = `https://t.me/${botInfo.username}?start=details_${eventId}`;

    await ctx.answerCallbackQuery({ url: deepLink });
    return;
  }

  await ctx.answerCallbackQuery();
}
```

**Step 2: Create src/conversations/rsvp.ts**

```typescript
import type { Conversation, ConversationFlavor } from "@grammyjs/conversations";
import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { getEventById } from "../db/events.js";
import { upsertRsvp, getRsvp, addDish, getAttendeeCount } from "../db/rsvps.js";
import { upsertUser } from "../db/users.js";
import { DISH_CATEGORIES, type RsvpStatus } from "../types.js";

export type BotContext = Context & ConversationFlavor;
export type BotConversation = Conversation<BotContext>;

export async function rsvpConversation(
  conversation: BotConversation,
  ctx: BotContext
) {
  const user = ctx.from;
  if (!user) {
    await ctx.reply("Could not identify user.");
    return;
  }

  // Extract event ID from session or start param
  const startPayload = ctx.match;
  if (typeof startPayload !== "string" || !startPayload.startsWith("rsvp_")) {
    await ctx.reply("Invalid RSVP link.");
    return;
  }

  const eventId = startPayload.replace("rsvp_", "");
  const event = await conversation.external(() => getEventById(eventId));

  if (!event) {
    await ctx.reply("Event not found.");
    return;
  }

  // Ensure user exists
  await conversation.external(() =>
    upsertUser(user.id, user.username ?? null, user.first_name)
  );

  // Check capacity
  const currentCount = await conversation.external(() => getAttendeeCount(eventId));
  const isFull = event.max_attendees !== null && currentCount >= event.max_attendees;

  // Step 1: Status
  const statusKeyboard = new InlineKeyboard()
    .text("Yes, I'm coming!", "status_going")
    .row()
    .text("Maybe", "status_maybe")
    .text("Can't make it", "status_declined");

  await ctx.reply(
    `*${event.title}*\n\nAre you coming?${isFull ? "\n\n_Note: Event is full, you may be waitlisted_" : ""}`,
    { reply_markup: statusKeyboard, parse_mode: "Markdown" }
  );

  const statusCtx = await conversation.waitFor("callback_query:data");
  const statusData = statusCtx.callbackQuery.data;
  const status = statusData.replace("status_", "") as RsvpStatus;
  await statusCtx.answerCallbackQuery();

  if (status === "declined") {
    await conversation.external(() => upsertRsvp(eventId, user.id, "declined", 0));
    await ctx.reply("Got it, maybe next time!");
    return;
  }

  // Step 2: Guests
  let guestCount = 0;
  if (event.allow_guests) {
    const guestKeyboard = new InlineKeyboard()
      .text("Just me", "guests_0")
      .text("+1", "guests_1")
      .text("+2", "guests_2")
      .text("More...", "guests_more");

    await ctx.reply("Bringing anyone?", { reply_markup: guestKeyboard });
    const guestCtx = await conversation.waitFor("callback_query:data");
    const guestData = guestCtx.callbackQuery.data;

    if (guestData === "guests_more") {
      await guestCtx.answerCallbackQuery();
      await ctx.reply("How many guests? (Enter a number)");
      const numCtx = await conversation.waitFor("message:text");
      guestCount = parseInt(numCtx.message.text, 10) || 0;
    } else {
      guestCount = parseInt(guestData.replace("guests_", ""), 10);
      await guestCtx.answerCallbackQuery();
    }
  }

  // Create/update RSVP
  const rsvp = await conversation.external(() =>
    upsertRsvp(eventId, user.id, status, guestCount)
  );

  // Step 3: Dish category
  const categoryKeyboard = new InlineKeyboard();
  for (const cat of DISH_CATEGORIES) {
    categoryKeyboard.text(cat.charAt(0).toUpperCase() + cat.slice(1), `cat_${cat}`);
  }
  categoryKeyboard.row().text("Nothing / Surprise", "cat_skip");

  await ctx.reply("What are you bringing?", { reply_markup: categoryKeyboard });
  const catCtx = await conversation.waitFor("callback_query:data");
  const catData = catCtx.callbackQuery.data;
  await catCtx.answerCallbackQuery();

  if (catData !== "cat_skip") {
    const category = catData.replace("cat_", "");

    // Step 4: Dish description
    await ctx.reply(`What ${category} dish? (e.g., "Spicy Wings", "Caesar Salad")`);
    const dishCtx = await conversation.waitFor("message:text");
    const description = dishCtx.message.text;

    // Step 5: Allergens
    const allergenKeyboard = new InlineKeyboard()
      .text("Vegetarian", "allerg_veg")
      .text("Vegan", "allerg_vegan")
      .row()
      .text("Gluten-Free", "allerg_gf")
      .text("Contains Nuts", "allerg_nuts")
      .row()
      .text("Contains Dairy", "allerg_dairy")
      .text("Done", "allerg_done");

    await ctx.reply("Any dietary info? (Select all that apply, then Done)", {
      reply_markup: allergenKeyboard,
    });

    const allergens = {
      is_vegetarian: false,
      is_vegan: false,
      is_gluten_free: false,
      contains_nuts: false,
      contains_dairy: false,
    };

    // Loop until done
    while (true) {
      const allergCtx = await conversation.waitFor("callback_query:data");
      const allergData = allergCtx.callbackQuery.data;

      if (allergData === "allerg_done") {
        await allergCtx.answerCallbackQuery();
        break;
      }

      switch (allergData) {
        case "allerg_veg":
          allergens.is_vegetarian = !allergens.is_vegetarian;
          break;
        case "allerg_vegan":
          allergens.is_vegan = !allergens.is_vegan;
          break;
        case "allerg_gf":
          allergens.is_gluten_free = !allergens.is_gluten_free;
          break;
        case "allerg_nuts":
          allergens.contains_nuts = !allergens.contains_nuts;
          break;
        case "allerg_dairy":
          allergens.contains_dairy = !allergens.contains_dairy;
          break;
      }
      await allergCtx.answerCallbackQuery("Toggled!");
    }

    await conversation.external(() =>
      addDish(rsvp.id, category, description, allergens)
    );
  }

  // Confirmation
  const statusEmoji = status === "going" ? "Yes" : "Maybe";
  const guestStr = guestCount > 0 ? ` (+${guestCount} guest${guestCount > 1 ? "s" : ""})` : "";

  await ctx.reply(
    `You're all set for *${event.title}*!\n\nStatus: ${statusEmoji}${guestStr}`,
    { parse_mode: "Markdown" }
  );
}
```

**Step 3: Update src/index.ts**

Add imports:
```typescript
import { rsvpConversation } from "./conversations/rsvp.js";
import { handleCallbackQuery } from "./handlers/callbacks.js";
```

Register the conversation after `createConversation(createEventConversation)`:
```typescript
bot.use(createConversation(rsvpConversation));
```

Update the start command to handle deep links:
```typescript
bot.command("start", async (ctx) => {
  const payload = ctx.match;

  if (typeof payload === "string" && payload.startsWith("rsvp_")) {
    await ctx.conversation.enter("rsvpConversation");
    return;
  }

  if (payload === "create") {
    await ctx.conversation.enter("createEventConversation");
    return;
  }

  await ctx.reply(
    "Welcome to Potluck Bot!\n\n" +
      "Use /create to create a new event.\n" +
      "Use @YourBotName in any chat to share events."
  );
});
```

Add callback handler before `bot.start()`:
```typescript
bot.on("callback_query:data", handleCallbackQuery);
```

**Step 4: Verify it compiles**

Run: `npm run build`
Expected: No errors.

**Step 5: Commit**

```bash
git add .
git commit -m "feat(bot): add RSVP flow with deep-linking and dish selection"
```

---

## Task 7: View Details Handler

**Files:**
- Create: `src/handlers/details.ts`
- Modify: `src/index.ts`

**Step 1: Create src/handlers/details.ts**

```typescript
import type { Context } from "grammy";
import { getEventById } from "../db/events.js";
import { getRsvpsForEvent, getDishesForEvent } from "../db/rsvps.js";
import { getUserById } from "../db/users.js";

export async function sendEventDetails(ctx: Context, eventId: string) {
  const event = await getEventById(eventId);
  if (!event) {
    await ctx.reply("Event not found.");
    return;
  }

  const rsvps = await getRsvpsForEvent(eventId);
  const dishes = await getDishesForEvent(eventId);

  const goingRsvps = rsvps.filter((r) => r.status === "going");
  const maybeRsvps = rsvps.filter((r) => r.status === "maybe");

  // Build attendee section
  const buildAttendeeList = async (
    rsvpList: typeof rsvps
  ): Promise<string[]> => {
    const lines: string[] = [];
    for (const rsvp of rsvpList) {
      const user = await getUserById(rsvp.user_id);
      const name = user?.display_name ?? user?.username ?? `User ${rsvp.user_id}`;
      const guestStr = rsvp.guest_count > 0 ? ` (+${rsvp.guest_count})` : "";
      const userDishes = dishes.filter((d) => d.rsvp_id === rsvp.id);

      if (userDishes.length > 0) {
        for (const dish of userDishes) {
          const tags: string[] = [];
          if (dish.is_vegan) tags.push("V");
          if (dish.is_vegetarian) tags.push("VG");
          if (dish.is_gluten_free) tags.push("GF");
          if (dish.contains_nuts) tags.push("NUTS");
          if (dish.contains_dairy) tags.push("DAIRY");
          const tagStr = tags.length > 0 ? ` [${tags.join(",")}]` : "";
          lines.push(`- ${name}${guestStr}: ${dish.description}${tagStr}`);
        }
      } else {
        lines.push(`- ${name}${guestStr}`);
      }
    }
    return lines;
  };

  const goingLines = await buildAttendeeList(goingRsvps);
  const maybeLines = await buildAttendeeList(maybeRsvps);

  // Build menu summary
  const categoryCounts: Record<string, number> = {};
  for (const dish of dishes) {
    categoryCounts[dish.category] = (categoryCounts[dish.category] || 0) + 1;
  }
  const menuSummary = Object.entries(categoryCounts)
    .map(([cat, count]) => `${cat}: ${count}`)
    .join(", ");

  const totalGoing =
    goingRsvps.reduce((sum, r) => sum + 1 + r.guest_count, 0);
  const totalMaybe =
    maybeRsvps.reduce((sum, r) => sum + 1 + r.guest_count, 0);

  const text = [
    `*${event.title}*`,
    "",
    `*Going (${totalGoing}):*`,
    goingLines.length > 0 ? goingLines.join("\n") : "_None yet_",
    "",
    `*Maybe (${totalMaybe}):*`,
    maybeLines.length > 0 ? maybeLines.join("\n") : "_None_",
    "",
    `*Menu:* ${menuSummary || "No dishes yet"}`,
  ].join("\n");

  await ctx.reply(text, { parse_mode: "Markdown" });
}
```

**Step 2: Update src/index.ts start handler**

Update start command to handle details deep link:
```typescript
bot.command("start", async (ctx) => {
  const payload = ctx.match;

  if (typeof payload === "string" && payload.startsWith("rsvp_")) {
    await ctx.conversation.enter("rsvpConversation");
    return;
  }

  if (typeof payload === "string" && payload.startsWith("details_")) {
    const eventId = payload.replace("details_", "");
    const { sendEventDetails } = await import("./handlers/details.js");
    await sendEventDetails(ctx, eventId);
    return;
  }

  if (payload === "create") {
    await ctx.conversation.enter("createEventConversation");
    return;
  }

  await ctx.reply(
    "Welcome to Potluck Bot!\n\n" +
      "Use /create to create a new event.\n" +
      "Use @YourBotName in any chat to share events."
  );
});
```

**Step 3: Verify it compiles**

Run: `npm run build`
Expected: No errors.

**Step 4: Commit**

```bash
git add .
git commit -m "feat(bot): add detailed attendee/menu view handler"
```

---

## Task 8: Basic Tests

**Files:**
- Create: `src/db/__tests__/events.test.ts`
- Modify: `package.json`

**Step 1: Install test dependencies**

Run: `npm install -D vitest`

**Step 2: Add test script to package.json**

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 3: Create src/db/__tests__/events.test.ts**

```typescript
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
    expect(event.creator_id).toBe(testUserId);
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
    expect(events.every((e) => e.creator_id === testUserId)).toBe(true);
  });
});
```

**Step 4: Run tests**

Run: `npm test`
Expected: All tests pass (requires running Postgres).

**Step 5: Commit**

```bash
git add .
git commit -m "test(db): add basic repository tests for events"
```

---

## Task 9: Dockerfile & Production Config

**Files:**
- Create: `Dockerfile`
- Modify: `package.json`

**Step 1: Create Dockerfile**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY migrations ./migrations

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

**Step 2: Update docker-compose.yml for full stack**

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: potluck
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  bot:
    build: .
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      BOT_TOKEN: ${BOT_TOKEN}
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/potluck
    command: sh -c "node dist/db/migrate.js && node dist/index.js"

volumes:
  pgdata:
```

**Step 3: Verify Docker build**

Run: `docker build -t potluck-bot .`
Expected: Build completes successfully.

**Step 4: Commit**

```bash
git add .
git commit -m "chore: add Dockerfile and production docker-compose config"
```

---

## Summary

After completing all tasks you will have:

1. **Project scaffolding** with TypeScript, grammy, and PostgreSQL
2. **Database schema** with migrations for users, events, RSVPs, and dishes
3. **Repository layer** for all CRUD operations
4. **Event creation wizard** using grammy conversations
5. **Inline mode** for sharing events into group chats
6. **RSVP flow** with deep-linking, guest handling, and dish selection
7. **Details view** showing attendees and menu
8. **Basic tests** for the repository layer
9. **Docker setup** for production deployment

### Next Steps (Future Iterations)

- Admin management panel (edit/delete events, remove attendees)
- Slot mode implementation (strict dish limits)
- Broadcast notifications to attendees
- Reminder system (24h/1h before event)
- Waitlist when event is full
