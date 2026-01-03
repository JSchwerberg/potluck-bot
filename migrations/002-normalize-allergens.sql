-- Allergens reference table
CREATE TABLE allergens (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    is_dietary_preference BOOLEAN DEFAULT FALSE
);

-- Junction table for dish allergens
CREATE TABLE dish_allergens (
    dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    allergen_id INT NOT NULL REFERENCES allergens(id) ON DELETE CASCADE,
    PRIMARY KEY (dish_id, allergen_id)
);

CREATE INDEX idx_dish_allergens_dish ON dish_allergens(dish_id);
CREATE INDEX idx_dish_allergens_allergen ON dish_allergens(allergen_id);

-- Seed common allergens
INSERT INTO allergens (name, display_name, is_dietary_preference) VALUES
    -- Dietary preferences
    ('vegan', 'Vegan', TRUE),
    ('vegetarian', 'Vegetarian', TRUE),
    ('gluten_free', 'Gluten-Free', TRUE),
    -- Common allergens (FDA top 9 + extras)
    ('dairy', 'Contains Dairy', FALSE),
    ('eggs', 'Contains Eggs', FALSE),
    ('nuts', 'Contains Tree Nuts', FALSE),
    ('peanuts', 'Contains Peanuts', FALSE),
    ('shellfish', 'Contains Shellfish', FALSE),
    ('fish', 'Contains Fish', FALSE),
    ('wheat', 'Contains Wheat', FALSE),
    ('soy', 'Contains Soy', FALSE),
    ('sesame', 'Contains Sesame', FALSE);

-- Remove old boolean columns from dishes
ALTER TABLE dishes
    DROP COLUMN is_vegan,
    DROP COLUMN is_vegetarian,
    DROP COLUMN is_gluten_free,
    DROP COLUMN contains_nuts,
    DROP COLUMN contains_dairy;
