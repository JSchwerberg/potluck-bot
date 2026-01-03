import type { BotContext } from "../context.js";
import { getEventById } from "../db/events.js";
import { getRsvpsForEvent, getDishesForEvent } from "../db/rsvps.js";
import { getUserById } from "../db/users.js";

export async function handleCallbackQuery(ctx: BotContext) {
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

  // View Details button -> redirect to PM
  if (data.startsWith("details_")) {
    const eventId = data.replace("details_", "");
    const event = await getEventById(eventId);

    if (!event) {
      await ctx.answerCallbackQuery({ text: "Event not found", show_alert: true });
      return;
    }

    const botInfo = await ctx.api.getMe();
    const deepLink = `https://t.me/${botInfo.username}?start=details_${eventId}`;

    await ctx.answerCallbackQuery({ url: deepLink });
    return;
  }

  await ctx.answerCallbackQuery();
}
