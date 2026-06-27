// Client-safe demo constants (no server-only imports). Shared between the
// login page (which sets the cookie) and the server-side demo helpers.

/** Cookie that flags an anonymous "tour" session. Read server-side to swap in
 *  dummy data; never grants any real capability (all mutations still require a
 *  real session). */
export const DEMO_COOKIE = "zs_demo";

/** What the assistant replies with when a demo visitor tries to send a message. */
export const DEMO_CHAT_REPLY =
  "You're exploring ZenScail in **demo mode**, so I can't send messages or take real actions just yet.\n\nBut you're only **one login away** — sign in and I'll read your inbox, draft replies, find open slots, and manage your calendar for you. ✨";
