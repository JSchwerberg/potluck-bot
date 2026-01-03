import type { Context, SessionFlavor } from "grammy";
import type { Conversation, ConversationFlavor } from "@grammyjs/conversations";

// Define session data structure
export interface SessionData {
  // Add session data here as needed
}

// Combined context type with session and conversation flavors
export type BotContext = Context & SessionFlavor<SessionData> & ConversationFlavor<Context>;

// Conversation type - both type params should be BotContext
export type BotConversation = Conversation<BotContext, BotContext>;
