import { Bot, session } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import "dotenv/config";

import type { BotContext, SessionData } from "./context.js";
import { createEventConversation } from "./conversations/createEvent.js";
import { rsvpConversation } from "./conversations/rsvp.js";
import { handleInlineQuery } from "./handlers/inline.js";
import { handleCallbackQuery } from "./handlers/callbacks.js";
import { sendEventDetails } from "./handlers/details.js";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN environment variable is required");
}

const bot = new Bot<BotContext>(token);

// Session & Conversations middleware
bot.use(
  session({
    initial: (): SessionData => ({}),
  })
);
bot.use(conversations());
bot.use(createConversation(createEventConversation));
bot.use(createConversation(rsvpConversation));

// Commands
bot.command("start", async (ctx) => {
  const payload = ctx.match;

  if (typeof payload === "string" && payload.startsWith("rsvp_")) {
    await ctx.conversation.enter("rsvpConversation");
    return;
  }

  if (typeof payload === "string" && payload.startsWith("details_")) {
    // Parse eventId and token from payload like "details_uuid_token"
    const data = payload.replace("details_", "");
    const lastUnderscore = data.lastIndexOf("_");
    if (lastUnderscore === -1) {
      await ctx.reply("Invalid link.");
      return;
    }
    const eventId = data.substring(0, lastUnderscore);
    const token = data.substring(lastUnderscore + 1);
    await sendEventDetails(ctx, eventId, token);
    return;
  }

  if (payload === "create") {
    await ctx.conversation.enter("createEventConversation");
    return;
  }

  await ctx.reply(
    "Welcome to Potluck Bot!\n\n" +
      "Use /create to create a new event.\n" +
      "Use @YourBotName in any chat to share events."
  );
});

bot.command("create", async (ctx) => {
  await ctx.conversation.enter("createEventConversation");
});

// Inline query handler
bot.on("inline_query", handleInlineQuery);

// Callback query handler
bot.on("callback_query:data", handleCallbackQuery);

bot.start();
console.log("Bot started");
