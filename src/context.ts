import type { Context, SessionFlavor } from "grammy";
import type { Conversation, ConversationFlavor } from "@grammyjs/conversations";

// Define session data structure (empty for now, will be extended as needed)
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SessionData {}

// Combined context type with session and conversation flavors
export type BotContext = Context & SessionFlavor<SessionData> & ConversationFlavor<Context>;

// Conversation type - both type params should be BotContext
export type BotConversation = Conversation<BotContext, BotContext>;
