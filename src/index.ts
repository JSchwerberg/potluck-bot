import { Bot } from "grammy";
import "dotenv/config";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN environment variable is required");
}

const bot = new Bot(token);

bot.command("start", (ctx) => ctx.reply("Welcome to Potluck Bot!"));

bot.start();
console.log("Bot started");
