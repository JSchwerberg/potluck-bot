import { InlineKeyboard } from "grammy";
import type { MessageEntity } from "grammy/types";
import { getEventsByCreator } from "../db/events.js";
import { getAttendeeCount } from "../db/rsvps.js";
import { fmt, bold, italic } from "../utils/format.js";
import type { Event } from "../types.js";
import type { BotContext } from "../context.js";

export function buildEventCard(
  event: Event,
  attendeeCount: number
): { text: string; entities: MessageEntity[]; keyboard: InlineKeyboard } {
  // Build formatted text using template tags to safely escape user input
  const descLine = event.description ? fmt`${italic()}${event.description}${italic()}\n` : fmt``;
  const locLine = event.location ? fmt`Location: ${event.location}\n` : fmt``;
  const dateLine = event.event_date
    ? fmt`Date: ${event.event_date.toLocaleDateString()} ${event.event_date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}\n`
    : fmt``;
  const spotsText = event.max_attendees
    ? `Spots: ${attendeeCount}/${event.max_attendees}`
    : `Attendees: ${attendeeCount}`;

  const formatted = fmt`${bold()}${event.title}${bold()}
${descLine}${locLine}${dateLine}
${spotsText}`;

  const keyboard = new InlineKeyboard()
    .text("RSVP", `rsvp_${event.id}_${event.share_token}`)
    .text("View Details", `details_${event.id}_${event.share_token}`);

  return { text: formatted.text, entities: formatted.entities, keyboard };
}

export async function handleInlineQuery(ctx: BotContext) {
  const user = ctx.from;
  if (!user) return;

  const events = await getEventsByCreator(user.id);

  if (events.length === 0) {
    await ctx.answerInlineQuery([], {
      button: { text: "Create your first event", start_parameter: "create" },
      cache_time: 0,
    });
    return;
  }

  const results = await Promise.all(
    events.map(async (event) => {
      const count = await getAttendeeCount(event.id);
      const { text, entities } = buildEventCard(event, count);

      return {
        type: "article" as const,
        id: event.id,
        title: event.title,
        description: event.description ?? `${count} attending`,
        input_message_content: {
          message_text: text,
          entities: entities,
        },
        reply_markup: new InlineKeyboard()
          .text("RSVP", `rsvp_${event.id}_${event.share_token}`)
          .text("View Details", `details_${event.id}_${event.share_token}`),
      };
    })
  );

  await ctx.answerInlineQuery(results, { cache_time: 0 });
}
