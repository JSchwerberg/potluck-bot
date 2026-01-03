import { InlineKeyboard } from "grammy";
import { getEventByIdAndToken } from "../db/events.js";
import { upsertRsvp, addDish, getAttendeeCount, getAllAllergens, getRsvp } from "../db/rsvps.js";
import { upsertUser } from "../db/users.js";
import { fmt, bold, italic } from "../utils/format.js";
import { DISH_CATEGORIES, type RsvpStatus } from "../types.js";
import type { BotContext, BotConversation } from "../context.js";

const MAX_GUESTS = 20;

// Parse event ID and token from payload like "rsvp_uuid_token"
function parseEventPayload(payload: string): { eventId: string; token: string } | null {
  const data = payload.replace("rsvp_", "");
  const lastUnderscore = data.lastIndexOf("_");
  if (lastUnderscore === -1) return null;
  
  const eventId = data.substring(0, lastUnderscore);
  const token = data.substring(lastUnderscore + 1);
  
  if (!eventId || !token) return null;
  return { eventId, token };
}

export async function rsvpConversation(
  conversation: BotConversation,
  ctx: BotContext
) {
  const user = ctx.from;
  if (!user) {
    await ctx.reply("Could not identify user.");
    return;
  }

  // Extract event ID and token from start param
  const startPayload = ctx.match;
  if (typeof startPayload !== "string" || !startPayload.startsWith("rsvp_")) {
    await ctx.reply("Invalid RSVP link.");
    return;
  }

  const parsed = parseEventPayload(startPayload);
  if (!parsed) {
    await ctx.reply("Invalid RSVP link.");
    return;
  }

  const { eventId, token } = parsed;
  const event = await conversation.external(() => getEventByIdAndToken(eventId, token));

  if (!event) {
    await ctx.reply("Event not found or invalid link.");
    return;
  }

  // Check event status - reject if not active
  if (event.status !== "active") {
    await ctx.reply("This event is no longer accepting RSVPs.");
    return;
  }

  // Ensure user exists
  await conversation.external(() =>
    upsertUser(user.id, user.username ?? null, user.first_name)
  );

  // Check capacity and existing RSVP
  const currentCount = await conversation.external(() => getAttendeeCount(eventId));
  const existingRsvp = await conversation.external(() => getRsvp(eventId, user.id));
  const existingCount = existingRsvp?.status === "going" ? 1 + existingRsvp.guest_count : 0;
  const isFull = event.max_attendees !== null && currentCount >= event.max_attendees;

  // Step 1: Status
  const statusKeyboard = new InlineKeyboard()
    .text("Yes, I'm coming!", "status_going")
    .row()
    .text("Maybe", "status_maybe")
    .text("Can't make it", "status_declined");

  const titlePrompt = fmt`${bold()}${event.title}${bold()}

Are you coming?${isFull ? fmt`

${italic()}Note: Event is full, you may be waitlisted${italic()}` : ""}`;

  await ctx.reply(titlePrompt.text, {
    reply_markup: statusKeyboard,
    entities: titlePrompt.entities,
  });

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
      await ctx.reply(`How many guests? (Enter a number between 0 and ${MAX_GUESTS})`);
      const numCtx = await conversation.waitFor("message:text");
      const parsed = parseInt(numCtx.message.text, 10);
      
      // Validate guest count
      if (isNaN(parsed) || parsed < 0 || parsed > MAX_GUESTS) {
        await ctx.reply(`Invalid number. Using 0 guests.`);
        guestCount = 0;
      } else {
        guestCount = parsed;
      }
    } else {
      guestCount = parseInt(guestData.replace("guests_", ""), 10);
      await guestCtx.answerCallbackQuery();
    }
  }

  // Enforce capacity for "going" status
  if (status === "going" && event.max_attendees !== null) {
    const projectedCount = currentCount - existingCount + 1 + guestCount;
    if (projectedCount > event.max_attendees) {
      const spotsLeft = Math.max(0, event.max_attendees - (currentCount - existingCount) - 1);
      await ctx.reply(
        `Sorry, this event is full. ` +
        (spotsLeft > 0 
          ? `You can bring at most ${spotsLeft} guest${spotsLeft === 1 ? "" : "s"}, or RSVP as "Maybe".`
          : `You can RSVP as "Maybe" to be notified if spots open up.`)
      );
      return;
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
    const dishDescription = dishCtx.message.text;

    // Step 5: Allergens - fetch from database
    const allAllergens = await conversation.external(() => getAllAllergens());
    
    // Build allergen keyboard - dietary preferences first, then allergens
    const allergenKeyboard = new InlineKeyboard();
    const dietaryPrefs = allAllergens.filter(a => a.is_dietary_preference);
    const allergens = allAllergens.filter(a => !a.is_dietary_preference);
    
    // Add dietary preferences row
    for (const pref of dietaryPrefs) {
      allergenKeyboard.text(pref.display_name, `allerg_${pref.id}`);
    }
    allergenKeyboard.row();
    
    // Add allergens in rows of 2
    for (let i = 0; i < allergens.length; i += 2) {
      allergenKeyboard.text(allergens[i].display_name, `allerg_${allergens[i].id}`);
      if (allergens[i + 1]) {
        allergenKeyboard.text(allergens[i + 1].display_name, `allerg_${allergens[i + 1].id}`);
      }
      allergenKeyboard.row();
    }
    allergenKeyboard.text("Done", "allerg_done");

    await ctx.reply("Any dietary info? (Select all that apply, then Done)", {
      reply_markup: allergenKeyboard,
    });

    const selectedAllergenIds: number[] = [];

    // Loop until done
    while (true) {
      const allergCtx = await conversation.waitFor("callback_query:data");
      const allergData = allergCtx.callbackQuery.data;

      if (allergData === "allerg_done") {
        await allergCtx.answerCallbackQuery();
        break;
      }

      if (allergData.startsWith("allerg_")) {
        const allergenId = parseInt(allergData.replace("allerg_", ""), 10);
        const idx = selectedAllergenIds.indexOf(allergenId);
        if (idx === -1) {
          selectedAllergenIds.push(allergenId);
          await allergCtx.answerCallbackQuery("Added!");
        } else {
          selectedAllergenIds.splice(idx, 1);
          await allergCtx.answerCallbackQuery("Removed!");
        }
      }
    }

    await conversation.external(() =>
      addDish(rsvp.id, category, dishDescription, selectedAllergenIds)
    );
  }

  // Confirmation - user input is safely escaped
  const statusEmoji = status === "going" ? "Yes" : "Maybe";
  const guestStr = guestCount > 0 ? ` (+${guestCount} guest${guestCount > 1 ? "s" : ""})` : "";

  const confirmation = fmt`You're all set for ${bold()}${event.title}${bold()}!

Status: ${statusEmoji}${guestStr}`;

  await ctx.reply(confirmation.text, { entities: confirmation.entities });
}
