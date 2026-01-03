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
