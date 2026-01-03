import { InlineKeyboard } from "grammy";
import { getEventById } from "../db/events.js";
import { upsertRsvp, addDish, getAttendeeCount, getAllAllergens } from "../db/rsvps.js";
import { upsertUser } from "../db/users.js";
import { DISH_CATEGORIES, type RsvpStatus } from "../types.js";
import type { BotContext, BotConversation } from "../context.js";

export async function rsvpConversation(
  conversation: BotConversation,
  ctx: BotContext
) {
  const user = ctx.from;
  if (!user) {
    await ctx.reply("Could not identify user.");
    return;
  }

  // Extract event ID from start param
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
      addDish(rsvp.id, category, description, selectedAllergenIds)
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
