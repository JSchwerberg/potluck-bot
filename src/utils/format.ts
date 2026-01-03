// Re-export formatting utilities from @grammyjs/parse-mode
// This provides a single import point and allows easy switching if needed

export {
  fmt,
  bold,
  italic,
  underline,
  code,
  pre,
  link,
  spoiler,
  FormattedString,
} from "@grammyjs/parse-mode";
export type { TextWithEntities } from "@grammyjs/parse-mode";
