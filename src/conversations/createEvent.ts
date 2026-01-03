import { InlineKeyboard } from "grammy";
import { createEvent } from "../db/events.js";
import { upsertUser } from "../db/users.js";
import { fmt, bold, italic, FormattedString } from "../utils/format.js";
import type { FoodMode } from "../types.js";
import type { BotContext, BotConversation } from "../context.js";

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
  if (descCtx.callbackQuery?.data === "skip_desc") {
    await descCtx.answerCallbackQuery();
    // description stays undefined
  } else if (descCtx.message?.text && descCtx.message.text !== "/skip") {
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
  const foodPrompt = fmt`How should food be organized?
- ${bold()}Categories${bold()}: People pick a category (Main, Side, etc.)
- ${bold()}Slots${bold()}: You define exactly what's needed`;
  await ctx.reply(foodPrompt.text, {
    reply_markup: foodKeyboard,
    entities: foodPrompt.entities,
  });
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

  // Show summary - user input is safely escaped via FormattedString
  const summaryParts: FormattedString[] = [
    FormattedString.bold(event.title),
  ];
  if (event.description) {
    summaryParts.push(FormattedString.italic(event.description));
  }
  if (event.location) {
    summaryParts.push(new FormattedString(`Location: ${event.location}`));
  }
  if (event.event_date) {
    summaryParts.push(new FormattedString(`Date: ${event.event_date.toLocaleString()}`));
  }
  summaryParts.push(new FormattedString(
    event.max_attendees ? `Max: ${event.max_attendees} people` : "No limit"
  ));
  summaryParts.push(new FormattedString(`Food: ${event.food_mode}`));

  const summary = FormattedString.join(
    [new FormattedString("Event created!\n\n"), ...summaryParts],
    "\n"
  );

  const adminKeyboard = new InlineKeyboard()
    .text("Edit", `edit_${event.id}`)
    .text("Share", `share_${event.id}`);

  await ctx.reply(summary.text, {
    reply_markup: adminKeyboard,
    entities: summary.entities,
  });
}
