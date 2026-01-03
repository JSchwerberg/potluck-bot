# Potluck Telegram Bot – Design Document

## 1. Overview
**Goal:** Create a frictionless Telegram bot for organizing potluck-style events.
**Core Value:** Solves the chaos of "who is bringing what" in group chats by providing a structured, interactive RSVP and dish management system.
**Platform:** Telegram (Bot API), Node.js, PostgreSQL.

---

## 2. Core Concepts

### 2.1 The Event
An event is the central entity. It is **link-accessible** but typically shared into groups via **Inline Mode**.
*   **Visibility:** Anyone with the link/message can RSVP.
*   **Ownership:** Created by one Admin (User).
*   **State:** Draft -> Active -> (Optional: Completed/Cancelled).

### 2.2 The User
*   **Admin:** The creator. Has rights to edit details, remove attendees, and broadcast messages.
*   **Attendee:** A Telegram user who has RSVP'd.
*   **Guest (+1):** An anonymous headcount attached to an Attendee (e.g., "John + 2").

### 2.3 The Dish
*   **Categorized Mode (Default):** Dishes are sorted into buckets (Mains, Sides, Desserts, Drinks, Utensils/Other).
*   **Slot Mode (Advanced):** Admin defines specific needs (e.g., "Main Dish [0/3 filled]").
*   **Attributes:** Name/Description, Allergen Flags (Nuts, Dairy, Gluten, Vegan/Veg).

---

## 3. User Experience (UX) Flows

### 3.1 Event Creation (Admin)
*   **Context:** Private Chat (PM).
*   **Trigger:** `/create` command.
*   **Flow:**
    1.  **Name:** "Give your feast a name."
    2.  **Date/Time:** "When is it?" (Natural language parsing preferred).
    3.  **Location:** "Where?" (Accepts text address or Telegram Location attachment).
    4.  **Settings:** Max attendees (default: unlimited), +1s allowed (default: yes).
    5.  **Food Mode:** Categories vs. Slots.
*   **Output:** Admin Dashboard Card with **[ Edit ]**, **[ Share ]**, **[ Delete ]**.

### 3.2 Sharing (Inline Mode)
*   **Context:** Any Group Chat.
*   **Trigger:** User types `@PotluckBot` in the text field.
*   **Display:** List of user's active events.
*   **Action:** Selecting an event posts the **Event Card**.
    *   *Header:* Title, Date, Location.
    *   *Stats:* "5/12 spots taken".
    *   *Menu Summary:* "2 Mains, 1 Side, 3 Drinks".
    *   *Buttons:* **[ RSVP ]** | **[ View Menu/Attendees ]**

### 3.3 The RSVP Loop
*   **Context:** Transitions from Group -> Private Chat (Deep Linking).
*   **Trigger:** Clicking **[ RSVP ]** on the Event Card.
*   **Flow:**
    1.  **Status:** "Are you coming?" (Yes | Maybe | No).
    2.  **Headcount:** "Bringing guests?" (0 | +1 | +2 | ...).
    3.  **Dish Category:** "What are you bringing?" (Main | Side | Dessert | Drink | Nothing).
    4.  **Dish Detail:** "Description?" (e.g., "Spicy Wings").
    5.  **Allergens:** Toggle buttons (e.g., [Contains Nuts], [Vegetarian]).
*   **Completion:** Bot confirms success and silently updates the Event Card in the group.

### 3.4 Viewing Details
*   **Trigger:** Clicking **[ View Menu/Attendees ]**.
*   **Action:** Bot sends a temporary/ephemeral message (or PM) with the full list:
    *   *Alice (+1):* 🥗 Greek Salad (Veg)
    *   *Bob:* 🍗 Fried Chicken
    *   *Charlie:* 🥤 Soda
    *   *Summary:* Total 4 people.

---

## 4. Technical Architecture

### 4.1 Stack
*   **Runtime:** Node.js (TypeScript).
*   **Framework:** `grammy` (Modern, type-safe Telegram Bot framework) or `telegraf`.
*   **Database:** PostgreSQL.
*   **Hosting:** Dockerized container.

### 4.2 Data Schema (Simplified)

**Events Table**
```sql
id UUID PRIMARY KEY,
creator_id BIGINT, -- Telegram User ID
title VARCHAR(255),
description TEXT,
location TEXT,
event_date TIMESTAMP,
max_attendees INT,
allow_guests BOOLEAN DEFAULT TRUE,
status VARCHAR(20) -- 'active', 'cancelled'
```

**Users Table**
```sql
tg_id BIGINT PRIMARY KEY,
username VARCHAR(255),
display_name VARCHAR(255)
```

**RSVPs Table**
```sql
id UUID PRIMARY KEY,
event_id UUID REFERENCES Events(id),
user_id BIGINT REFERENCES Users(tg_id),
status VARCHAR(20), -- 'going', 'maybe', 'declined'
guest_count INT DEFAULT 0,
created_at TIMESTAMP
```

**Dishes Table**
```sql
id UUID PRIMARY KEY,
rsvp_id UUID REFERENCES RSVPs(id),
category VARCHAR(50), -- 'main', 'side', 'drink', etc.
description VARCHAR(255),
is_vegan BOOLEAN,
is_vegetarian BOOLEAN,
is_gluten_free BOOLEAN,
contains_nuts BOOLEAN,
contains_dairy BOOLEAN
```

---

## 5. Future Iterations (Backlog)
*   **Waitlists:** If max attendees reached, auto-queue users.
*   **Reminders:** Push notifications 24h/1h before event.
*   **Export:** Generate a PDF or Text list for shopping.
*   **Payments:** "Chip in $5 for pizza" integration.
