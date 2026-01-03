import { InlineKeyboard } from "grammy";
import type { MessageEntity } from "grammy/types";
import { getEventsByCreator } from "../db/events.js";
import { getAttendeeCount } from "../db/rsvps.js";
import { FormattedString } from "../utils/format.js";
import type { Event } from "../types.js";
import type { BotContext } from "../context.js";

export function buildEventCard(
  event: Event,
  attendeeCount: number
): { text: string; entities: MessageEntity[]; keyboard: InlineKeyboard } {
  // Build formatted text using FormattedString to safely escape user input
  const parts: FormattedString[] = [
    FormattedString.bold(event.title),
  ];
  
  if (event.description) {
    parts.push(FormattedString.italic(event.description));
  }
  
  parts.push(new FormattedString("")); // empty line
  
  if (event.location) {
    parts.push(new FormattedString(`Location: ${event.location}`));
  }
  
  if (event.event_date) {
    const dateStr = `${event.event_date.toLocaleDateString()} ${event.event_date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    parts.push(new FormattedString(`Date: ${dateStr}`));
  }
  
  parts.push(new FormattedString("")); // empty line
  
  const spotsText = event.max_attendees
    ? `Spots: ${attendeeCount}/${event.max_attendees}`
    : `Attendees: ${attendeeCount}`;
  parts.push(new FormattedString(spotsText));

  const formatted = FormattedString.join(parts, "\n");

  const keyboard = new InlineKeyboard()
    .text("RSVP", `rsvp_${event.id}`)
    .text("View Details", `details_${event.id}`);

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
          .text("RSVP", `rsvp_${event.id}`)
          .text("View Details", `details_${event.id}`),
      };
    })
  );

  await ctx.answerInlineQuery(results, { cache_time: 0 });
}
