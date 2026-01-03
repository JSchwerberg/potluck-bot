import { Bot, session } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import "dotenv/config";

import type { BotContext, SessionData } from "./context.js";
import { createEventConversation } from "./conversations/createEvent.js";

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

// Commands
bot.command("start", (ctx) =>
  ctx.reply(
    "Welcome to Potluck Bot!\n\n" +
      "Use /create to create a new event.\n" +
      "Use @YourBotName in any chat to share events."
  )
);

bot.command("create", async (ctx) => {
  await ctx.conversation.enter("createEventConversation");
});

bot.start();
console.log("Bot started");
