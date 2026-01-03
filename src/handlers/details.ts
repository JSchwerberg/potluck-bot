import type { BotContext } from "../context.js";
import { getEventByIdAndToken } from "../db/events.js";
import { getRsvpsForEvent, getDishesForEvent } from "../db/rsvps.js";
import { getUsersByIds } from "../db/users.js";
import { fmt, bold } from "../utils/format.js";
import type { Rsvp, DishWithAllergens, User } from "../types.js";

export async function sendEventDetails(
  ctx: BotContext,
  eventId: string,
  token: string
) {
  const event = await getEventByIdAndToken(eventId, token);
  if (!event) {
    await ctx.reply("Event not found or invalid link.");
    return;
  }

  const rsvps = await getRsvpsForEvent(eventId);
  const dishes = await getDishesForEvent(eventId);

  // Batch fetch all users to avoid N+1 queries
  const userIds = rsvps.map(r => r.user_id);
  const usersMap = await getUsersByIds(userIds);

  const goingRsvps = rsvps.filter((r) => r.status === "going");
  const maybeRsvps = rsvps.filter((r) => r.status === "maybe");

  // Build attendee section - now uses batched user map
  const buildAttendeeList = (
    rsvpList: Rsvp[],
    users: Map<number, User>
  ): string[] => {
    const lines: string[] = [];
    for (const rsvp of rsvpList) {
      const user = users.get(rsvp.user_id);
      const name = user?.display_name ?? user?.username ?? `User ${rsvp.user_id}`;
      const guestStr = rsvp.guest_count > 0 ? ` (+${rsvp.guest_count})` : "";
      const userDishes = dishes.filter((d) => d.rsvp_id === rsvp.id);

      if (userDishes.length > 0) {
        for (const dish of userDishes) {
          const tagStr = formatAllergenTags(dish);
          lines.push(`- ${name}${guestStr}: ${dish.description}${tagStr}`);
        }
      } else {
        lines.push(`- ${name}${guestStr}`);
      }
    }
    return lines;
  };

  const goingLines = buildAttendeeList(goingRsvps, usersMap);
  const maybeLines = buildAttendeeList(maybeRsvps, usersMap);

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

  // Build formatted output using template tags
  const goingList = goingLines.length > 0 ? goingLines.join("\n") : "None yet";
  const maybeList = maybeLines.length > 0 ? maybeLines.join("\n") : "None";
  const menu = menuSummary || "No dishes yet";

  const formatted = fmt`${bold()}${event.title}${bold()}

${bold()}Going (${totalGoing}):${bold()}
${goingList}

${bold()}Maybe (${totalMaybe}):${bold()}
${maybeList}

${bold()}Menu:${bold()} ${menu}`;

  await ctx.reply(formatted.text, { entities: formatted.entities });
}

function formatAllergenTags(dish: DishWithAllergens): string {
  if (dish.allergens.length === 0) return "";
  
  const tags = dish.allergens.map(a => {
    // Use short codes for common allergens
    switch (a.name) {
      case "vegan": return "V";
      case "vegetarian": return "VG";
      case "gluten_free": return "GF";
      case "dairy": return "DAIRY";
      case "nuts": return "NUTS";
      case "peanuts": return "PEANUTS";
      case "eggs": return "EGGS";
      case "shellfish": return "SHELLFISH";
      case "fish": return "FISH";
      case "wheat": return "WHEAT";
      case "soy": return "SOY";
      case "sesame": return "SESAME";
      default: return a.name.toUpperCase();
    }
  });
  
  return ` [${tags.join(", ")}]`;
}
