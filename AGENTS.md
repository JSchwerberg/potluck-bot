# AGENTS.md - Potluck Bot

Guidelines for AI coding agents working in this repository.

## Project Overview

Telegram bot for managing potluck events using grammy framework with PostgreSQL.

**Tech Stack:** Node.js 20+, TypeScript, grammy, pg (node-postgres), vitest

## Build, Test, and Run Commands

```bash
# Install dependencies
npm install

# Development (hot reload)
npm run dev

# Build TypeScript
npm run build

# Run production
npm start

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run a single test file
npx vitest run src/db/__tests__/events.test.ts

# Run tests matching a pattern
npx vitest run -t "creates an event"

# Run database migrations
npm run migrate

# Start local PostgreSQL (required for tests)
docker compose up -d postgres
```

## Project Structure

```
src/
├── index.ts              # Bot entry point, middleware setup
├── context.ts            # Shared BotContext and BotConversation types
├── types.ts              # Domain types (User, Event, Rsvp, Dish, Allergen)
├── conversations/        # grammy conversation handlers
│   ├── createEvent.ts    # Event creation wizard
│   └── rsvp.ts           # RSVP flow
├── handlers/             # Non-conversation handlers
│   ├── inline.ts         # Inline query handler
│   ├── callbacks.ts      # Callback query handler
│   └── details.ts        # Event details view
└── db/                   # Database layer
    ├── index.ts          # Pool and query helper
    ├── migrate.ts        # Migration runner
    ├── users.ts          # User repository
    ├── events.ts         # Event repository
    ├── rsvps.ts          # RSVP and dish repository
    └── __tests__/        # Repository tests
migrations/               # SQL migration files
```

## Code Style Guidelines

### Imports

- Use ES modules with `.js` extension for local imports (required by NodeNext)
- Use `type` keyword for type-only imports
- Order: external packages, then local modules, then types

```typescript
// External packages first
import { Bot, session } from "grammy";
import { conversations } from "@grammyjs/conversations";

// Local modules
import { createEvent } from "./db/events.js";

// Type-only imports
import type { BotContext } from "./context.js";
import type { Event, FoodMode } from "./types.js";
```

### TypeScript

- Strict mode enabled (`"strict": true`)
- Target ES2022 with NodeNext module resolution
- Always define return types for exported functions
- Use `interface` for object shapes, `type` for unions/aliases
- Prefer `null` over `undefined` for database nullable fields

```typescript
// Return types on exported functions
export async function getEventById(id: string): Promise<Event | null> {
  // ...
}

// Interface for domain objects
export interface Event {
  id: string;
  title: string;
  description: string | null;  // null for DB nullable
}

// Type for unions
export type EventStatus = "active" | "cancelled" | "completed";
```

### Naming Conventions

- **Files:** kebab-case for multi-word (`create-event.ts`), lowercase for single word
- **Functions:** camelCase, verb prefixes (`getEventById`, `createEvent`, `upsertUser`)
- **Types/Interfaces:** PascalCase (`BotContext`, `CreateEventInput`)
- **Constants:** SCREAMING_SNAKE_CASE for arrays, camelCase for objects
- **Database columns:** snake_case (matches PostgreSQL convention)

### Database Layer

- Repository pattern: one file per entity in `src/db/`
- Use parameterized queries with `$1, $2, ...` placeholders
- Return `null` for not-found single items, empty array for lists
- Use `RETURNING *` for INSERT/UPDATE operations

```typescript
export async function getEventById(id: string): Promise<Event | null> {
  const result = await query<Event>(
    "SELECT * FROM events WHERE id = $1",
    [id]
  );
  return result.rows[0] ?? null;
}
```

### PostgreSQL BIGINT Handling

PostgreSQL BIGINT columns (like Telegram user IDs) return as strings in Node.js.
When comparing in tests, convert with `Number()`:

```typescript
// In tests
expect(Number(event.creator_id)).toBe(testUserId);
```

### Bot Handlers

- Use shared `BotContext` type from `src/context.ts`
- Conversations go in `src/conversations/`, handlers in `src/handlers/`
- Use `conversation.external()` for database calls in conversations
- Answer callback queries to prevent loading indicators

```typescript
import type { BotContext, BotConversation } from "../context.js";

export async function myConversation(
  conversation: BotConversation,
  ctx: BotContext
) {
  // Database calls must be wrapped
  const event = await conversation.external(() => getEventById(id));
  
  // Always answer callbacks
  await ctx.answerCallbackQuery();
}
```

### Error Handling

- Validate required environment variables at startup with thrown errors
- Return `null` for not-found, don't throw
- Use early returns for guard clauses

```typescript
const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN environment variable is required");
}
```

### Testing

- Tests live in `__tests__/` directories adjacent to source
- Use vitest with `describe`, `it`, `expect`
- Clean up test data in `afterAll`
- Close pool connection after tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("events repository", () => {
  afterAll(async () => {
    await query("DELETE FROM events WHERE creator_id = $1", [testUserId]);
    await pool.end();
  });

  it("creates an event", async () => {
    const event = await createEvent({ ... });
    expect(event.id).toBeDefined();
  });
});
```

## Environment Variables

Required in `.env`:
```
BOT_TOKEN=your_telegram_bot_token
DATABASE_URL=postgres://postgres:postgres@localhost:5432/potluck
```

## Common Tasks

**Add a new bot command:**
1. Add handler in `src/index.ts` using `bot.command("name", handler)`

**Add a new conversation:**
1. Create file in `src/conversations/`
2. Import and register with `createConversation()` in `src/index.ts`

**Add a new database table:**
1. Create migration in `migrations/NNN-description.sql`
2. Add types to `src/types.ts`
3. Create repository file in `src/db/`

**Add a new allergen:**
Insert into `allergens` table - no code changes needed.
