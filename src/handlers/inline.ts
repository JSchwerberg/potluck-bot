import { InlineKeyboard } from "grammy";
import { getEventsByCreator } from "../db/events.js";
import { getAttendeeCount } from "../db/rsvps.js";
import type { Event } from "../types.js";
import type { BotContext } from "../context.js";

export function buildEventCard(
  event: Event,
  attendeeCount: number
): { text: string; keyboard: InlineKeyboard } {
  const lines = [
    `*${event.title}*`,
    event.description ? `_${event.description}_` : null,
    "",
    event.location ? `Location: ${event.location}` : null,
    event.event_date
      ? `Date: ${event.event_date.toLocaleDateString()} ${event.event_date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : null,
    "",
    event.max_attendees
      ? `Spots: ${attendeeCount}/${event.max_attendees}`
      : `Attendees: ${attendeeCount}`,
  ].filter((line) => line !== null);

  const keyboard = new InlineKeyboard()
    .text("RSVP", `rsvp_${event.id}`)
    .text("View Details", `details_${event.id}`);

  return { text: lines.join("\n"), keyboard };
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
      const { text } = buildEventCard(event, count);

      return {
        type: "article" as const,
        id: event.id,
        title: event.title,
        description: event.description ?? `${count} attending`,
        input_message_content: {
          message_text: text,
          parse_mode: "Markdown" as const,
        },
        reply_markup: new InlineKeyboard()
          .text("RSVP", `rsvp_${event.id}`)
          .text("View Details", `details_${event.id}`),
      };
    })
  );

  await ctx.answerInlineQuery(results, { cache_time: 0 });
}
