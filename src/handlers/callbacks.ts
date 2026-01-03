import type { BotContext } from "../context.js";
import { getEventByIdAndToken } from "../db/events.js";

// Parse event ID and token from callback data like "rsvp_uuid_token"
function parseEventData(data: string, prefix: string): { eventId: string; token: string } | null {
  const payload = data.replace(prefix, "");
  const lastUnderscore = payload.lastIndexOf("_");
  if (lastUnderscore === -1) return null;
  
  const eventId = payload.substring(0, lastUnderscore);
  const token = payload.substring(lastUnderscore + 1);
  
  if (!eventId || !token) return null;
  return { eventId, token };
}

export async function handleCallbackQuery(ctx: BotContext) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  // RSVP button -> redirect to PM
  if (data.startsWith("rsvp_")) {
    const parsed = parseEventData(data, "rsvp_");
    if (!parsed) {
      await ctx.answerCallbackQuery({ text: "Invalid link", show_alert: true });
      return;
    }

    // Validate token before redirecting
    const event = await getEventByIdAndToken(parsed.eventId, parsed.token);
    if (!event) {
      await ctx.answerCallbackQuery({ text: "Event not found or invalid link", show_alert: true });
      return;
    }

    const botInfo = await ctx.api.getMe();
    const deepLink = `https://t.me/${botInfo.username}?start=rsvp_${parsed.eventId}_${parsed.token}`;

    await ctx.answerCallbackQuery({ url: deepLink });
    return;
  }

  // View Details button -> redirect to PM
  if (data.startsWith("details_")) {
    const parsed = parseEventData(data, "details_");
    if (!parsed) {
      await ctx.answerCallbackQuery({ text: "Invalid link", show_alert: true });
      return;
    }

    // Validate token before redirecting
    const event = await getEventByIdAndToken(parsed.eventId, parsed.token);
    if (!event) {
      await ctx.answerCallbackQuery({ text: "Event not found or invalid link", show_alert: true });
      return;
    }

    const botInfo = await ctx.api.getMe();
    const deepLink = `https://t.me/${botInfo.username}?start=details_${parsed.eventId}_${parsed.token}`;

    await ctx.answerCallbackQuery({ url: deepLink });
    return;
  }

  await ctx.answerCallbackQuery();
}
