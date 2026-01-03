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
