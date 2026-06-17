// Server-safe helpers + avatar for rendering email senders.

const AVATAR_COLORS = [
  "bg-(--accent-soft) text-(--accent-deep)",
  "bg-[#EAEFE4] text-[#4D5C40]",
  "bg-[#F7ECD8] text-[#8A5F1E]",
  "bg-(--bg-deep) text-(--ink-soft)",
  "bg-[#E8EAF1] text-[#46527A]",
];

/** "Jane Doe <jane@x.com>" → { name: "Jane Doe", email: "jane@x.com" } */
export function parseSender(raw: string): { name: string; email: string } {
  const match = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].trim();
    return { name: name || match[2].trim(), email: match[2].trim() };
  }
  return { name: raw.trim() || "Unknown", email: raw.trim() };
}

export function SenderAvatar({ from, size = 9 }: { from: string; size?: 9 | 10 }) {
  const { name } = parseSender(from);
  const initial = (name[0] || "?").toUpperCase();
  const hash = Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  const dim = size === 10 ? "h-10 w-10 text-base" : "h-9 w-9 text-sm";
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-serif ${dim} ${color}`}
    >
      {initial}
    </span>
  );
}
