export const ASK_AI_PROMPT =
  "Summarize what Zescail offers based on this page: https://zenscail.com. Cover what the product is, who it's for, pricing if mentioned, and what makes it different from alternatives. Use plain language.";

export type AskAiProvider = "chatgpt" | "claude" | "gemini";

export const ASK_AI_PROVIDERS: {
  id: AskAiProvider;
  label: string;
  icon: string;
  href: string;
}[] = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    icon: "/chatgpt.png",
    href: `https://chatgpt.com/?q=${encodeURIComponent(ASK_AI_PROMPT)}`,
  },
  {
    id: "claude",
    label: "Claude",
    icon: "/claude.png",
    href: `https://claude.ai/new?q=${encodeURIComponent(ASK_AI_PROMPT)}`,
  },
  {
    id: "gemini",
    label: "Gemini",
    icon: "/gemini.png",
    href: `https://gemini.google.com/app?q=${encodeURIComponent(ASK_AI_PROMPT)}`,
  },
];
