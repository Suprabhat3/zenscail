import "server-only";

import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { DEMO_COOKIE } from "@/lib/demo-shared";
import type { InboxMessage } from "@/lib/gmail";
import type { CachedEvent } from "@/lib/gcal";
import type { Priority, Category } from "@/lib/ai/classify";
import type { EmailSummaryData } from "@/lib/ai/summary";
import type { Brief, BriefEvent } from "@/lib/ai/brief";

/**
 * Demo / tour mode. A visitor who clicks "Explore the demo" on the login page
 * gets a cookie that lets the (otherwise auth-gated) app render with hardcoded
 * dummy data — no Corsair, no Prisma, no real session.
 *
 * SAFETY: demo mode only ever short-circuits the *read* path (page render).
 * Every mutating server action still calls requireSession(), so a demo visitor
 * physically cannot send mail, create events, or persist anything — they're
 * redirected to /login the moment they hit a real action. The client also
 * intercepts those actions first and shows a friendly "one login away" prompt.
 *
 * Demo is suppressed for anyone with a real session, so a stale cookie can
 * never make a signed-in user see fake data.
 */
export async function isDemoMode(): Promise<boolean> {
  const jar = await cookies();
  if (jar.get(DEMO_COOKIE)?.value !== "1") return false;
  const session = await getSession();
  return !session;
}

export const DEMO_USER = {
  id: "demo-user",
  name: "Piyush Garg",
  email: "you@zenscail.com",
} as const;

export const DEMO_IDENTITY = {
  displayName: DEMO_USER.name,
  primaryEmail: DEMO_USER.email,
  loginEmail: DEMO_USER.email,
  connectedEmail: DEMO_USER.email,
  image: null as string | null,
  mismatch: false,
};

export const DEMO_CHAT_OPTIONS = {
  tier: "cloud" as const,
  provider: "anthropic",
  defaultModel: "demo-cloud",
  models: [{ id: "demo-cloud", label: "ZenScail Cloud" }],
};

// --- Dummy inbox ----------------------------------------------------------

type DemoMessageSeed = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  /** minutes ago */
  ago: number;
  unread: boolean;
  priority: Priority;
  reason?: string;
  category: Category;
  hasListUnsubscribe?: boolean;
  summary?: EmailSummaryData;
};

// Ten emails that read, top to bottom, like a little story of a day already
// half-handled by ZenScail — each one shows off a capability and nudges the
// visitor toward "I want this for my own inbox".
const DEMO_SEEDS: DemoMessageSeed[] = [
  {
    id: "demo-1",
    from: "ZenScail <hello@zenscail.com>",
    subject: "This is what your inbox feels like now ✨",
    snippet:
      "No more triage. We read every email the moment it lands, flag what's urgent, and draft the replies — you just approve.",
    ago: 6,
    unread: true,
    priority: "normal",
    category: "important",
    summary: {
      tldr: "A quick welcome — ZenScail already sorted, summarized, and prepped your inbox so you only touch what matters.",
      bullets: [
        "Every email is auto-classified by urgency and topic",
        "Hover any message for an instant AI summary (like this one)",
        "Ask the assistant to draft, schedule, or clean up — it does the work",
      ],
      action: "Hover the other emails to see their summaries, then open the assistant.",
    },
  },
  {
    id: "demo-2",
    from: "Priya Nair <priya@brightlabs.io>",
    subject: "Re: Q3 partnership — can we lock the terms by Friday?",
    snippet:
      "Legal signed off on our side. I just need your yes on the revenue split and we can announce next week. Huge for both teams.",
    ago: 38,
    unread: true,
    priority: "urgent",
    reason: "Time-sensitive decision with a Friday deadline from a key partner",
    category: "important",
    summary: {
      tldr: "Priya needs your sign-off on the Q3 revenue split by Friday so the partnership can be announced next week.",
      bullets: [
        "Legal has already approved on Brightlabs' side",
        "Only the revenue split is outstanding",
        "Deadline: Friday — announcement planned for next week",
      ],
      action: "Reply with your decision on the revenue split before Friday.",
    },
  },
  {
    id: "demo-3",
    from: "Stripe <receipts@stripe.com>",
    subject: "Your payout of $4,820.00 is on the way",
    snippet:
      "We've initiated a transfer to your bank account ending in 4471. Funds typically arrive within 1–2 business days.",
    ago: 95,
    unread: false,
    priority: "low",
    category: "notification",
    summary: {
      tldr: "Stripe is sending a $4,820 payout to your account ending 4471, arriving in 1–2 business days.",
      bullets: ["Amount: $4,820.00", "Destination: bank account ••4471", "ETA: 1–2 business days"],
      action: null,
    },
  },
  {
    id: "demo-4",
    from: "Rohan Mehta <rohan@designco.com>",
    subject: "Loved the walkthrough — when can we start?",
    snippet:
      "The team is sold. Send over the SOW whenever you're ready and let's get the kickoff on the calendar for next week.",
    ago: 140,
    unread: true,
    priority: "normal",
    reason: "Warm lead ready to sign — wants a kickoff scheduled",
    category: "important",
    summary: {
      tldr: "Rohan's team is ready to move forward and wants the SOW plus a kickoff meeting next week.",
      bullets: ["They've decided to proceed", "Waiting on the SOW from you", "Wants a kickoff on the calendar next week"],
      action: "Send the SOW and propose a kickoff time next week.",
    },
  },
  {
    id: "demo-5",
    from: "The Hustle <news@thehustle.co>",
    subject: "AI is quietly eating the inbox (and that's good)",
    snippet:
      "Today: why the next billion-dollar productivity tools won't have an inbox at all, plus 3 startups to watch.",
    ago: 210,
    unread: false,
    priority: "low",
    category: "newsletter",
    hasListUnsubscribe: true,
  },
  {
    id: "demo-6",
    from: "ZenScail Calendar <calendar@zenscail.com>",
    subject: "Your day: 3 meetings, and your morning is free",
    snippet:
      "First meeting isn't until after lunch. We blocked your morning for deep work like you asked. Tap to see today.",
    ago: 260,
    unread: true,
    priority: "normal",
    category: "notification",
    summary: {
      tldr: "Three meetings today, all after lunch — your morning is protected for focus time.",
      bullets: ["Morning kept clear for deep work", "3 meetings scheduled this afternoon", "No conflicts detected"],
      action: "Open the calendar to review this afternoon's meetings.",
    },
  },
  {
    id: "demo-7",
    from: "Sneha Iyer <sneha@acmecorp.com>",
    subject: "Following up — did the proposal land okay?",
    snippet:
      "Just bumping this to the top of your inbox. No rush, but I'd love your thoughts before our call. Happy to revise.",
    ago: 1500,
    unread: false,
    priority: "normal",
    reason: "Awaiting your reply — surfaced as a follow-up",
    category: "important",
    summary: {
      tldr: "Sneha is following up on a proposal she sent and wants your feedback before your upcoming call.",
      bullets: ["Second nudge on the same proposal", "Wants feedback ahead of the call", "Open to revising it"],
      action: "Send a short reply with your thoughts, or snooze until before the call.",
    },
  },
  {
    id: "demo-8",
    from: "GitHub <noreply@github.com>",
    subject: "[zenscail] All checks passed on main",
    snippet:
      "Build #1284 succeeded. 142 tests passed in 38s. Deploy to production is ready when you are.",
    ago: 320,
    unread: false,
    priority: "low",
    category: "notification",
  },
  {
    id: "demo-9",
    from: "LinkedIn <messages-noreply@linkedin.com>",
    subject: "You have 4 new connection requests",
    snippet:
      "Grow your network — 4 people want to connect, including 2 founders in your industry.",
    ago: 480,
    unread: false,
    priority: "low",
    category: "social",
    hasListUnsubscribe: true,
  },
  {
    id: "demo-10",
    from: "Dad <ramesh.sharma@gmail.com>",
    subject: "Dinner Sunday? Mum's making biryani 🍲",
    snippet:
      "Your sister's coming over too. 7pm work for you? Don't bring anything, just yourself. Let us know!",
    ago: 720,
    unread: false,
    priority: "normal",
    category: "other",
    summary: {
      tldr: "Your dad is inviting you to family dinner this Sunday at 7pm — biryani, and your sister will be there.",
      bullets: ["Sunday at 7pm", "Family dinner at home", "Just confirm if you can make it"],
      action: "Reply to let them know if 7pm Sunday works.",
    },
  },
];

export function getDemoMessages(now: number = Date.now()): InboxMessage[] {
  return DEMO_SEEDS.map((s) => ({
    id: s.id,
    threadId: s.id,
    from: s.from,
    subject: s.subject,
    snippet: s.snippet,
    internalDate: now - s.ago * 60_000,
    unread: s.unread,
    labelIds: ["INBOX", ...(s.unread ? ["UNREAD"] : [])],
    hasListUnsubscribe: Boolean(s.hasListUnsubscribe),
  }));
}

export type DemoRowMeta = { priority: Priority; reason?: string | null; category?: string | null };

export function getDemoPriorities(): Map<string, DemoRowMeta> {
  return new Map(
    DEMO_SEEDS.map((s) => [
      s.id,
      { priority: s.priority, reason: s.reason ?? null, category: s.category },
    ]),
  );
}

export function getDemoSummary(messageId: string): EmailSummaryData | null {
  return DEMO_SEEDS.find((s) => s.id === messageId)?.summary ?? null;
}

// --- Dummy calendar -------------------------------------------------------

type DemoEventSeed = {
  id: string;
  summary: string;
  /** days from today (0 = today) */
  day: number;
  startHour: number; // 24h
  startMin?: number;
  durationMin: number;
  location?: string;
  attendees?: number;
  allDay?: boolean;
};

const DEMO_EVENT_SEEDS: DemoEventSeed[] = [
  { id: "ev-r", summary: "Sprint retro", day: -1, startHour: 14, durationMin: 45, attendees: 6 },
  { id: "ev-1", summary: "Design review — Brightlabs", day: 0, startHour: 9, startMin: 30, durationMin: 60, location: "Meet", attendees: 4 },
  { id: "ev-2", summary: "Lunch with Rohan", day: 0, startHour: 12, durationMin: 60, location: "Café Verde", attendees: 2 },
  { id: "ev-3", summary: "1:1 with Priya", day: 0, startHour: 15, durationMin: 30, attendees: 2 },
  { id: "ev-4", summary: "Q3 planning", day: 1, startHour: 11, durationMin: 90, location: "Boardroom", attendees: 8 },
  { id: "ev-5", summary: "Investor call", day: 1, startHour: 16, startMin: 30, durationMin: 45, location: "Meet", attendees: 3 },
  { id: "ev-6", summary: "Product demo — Acme", day: 2, startHour: 10, durationMin: 60, location: "Meet", attendees: 5 },
  { id: "ev-7", summary: "Team offsite", day: 3, startHour: 0, durationMin: 0, allDay: true },
];

/** Local-midnight epoch for `now`, in UTC terms — good enough for the demo grid
 *  (the time views auto-widen their hour window to fit whatever lands). */
function startOfTodayUTC(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function ymd(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

export function getDemoEvents(now: number = Date.now()): CachedEvent[] {
  const base = startOfTodayUTC(now);
  return DEMO_EVENT_SEEDS.map((s) => {
    const dayMs = base + s.day * 86_400_000;
    if (s.allDay) {
      return {
        id: s.id,
        summary: s.summary,
        start: { date: ymd(dayMs) },
        end: { date: ymd(dayMs + 86_400_000) },
      } satisfies CachedEvent;
    }
    const startMs = dayMs + (s.startHour * 60 + (s.startMin ?? 0)) * 60_000;
    const endMs = startMs + s.durationMin * 60_000;
    return {
      id: s.id,
      summary: s.summary,
      location: s.location,
      start: { dateTime: new Date(startMs).toISOString() },
      end: { dateTime: new Date(endMs).toISOString() },
      attendees: s.attendees
        ? Array.from({ length: s.attendees }, (_, i) => ({ email: `guest${i}@example.com` }))
        : undefined,
    } satisfies CachedEvent;
  });
}

// --- Dummy daily brief ----------------------------------------------------

export function getDemoBrief(now: number = Date.now()): Brief {
  const events = getDemoEvents(now);
  const todayYmd = ymd(startOfTodayUTC(now));
  const todayEvents: BriefEvent[] = events
    .filter((e) => (e.start?.dateTime ?? e.start?.date ?? "").startsWith(todayYmd))
    .map((e) => ({
      id: e.id ?? "",
      summary: e.summary ?? "",
      start: e.start?.dateTime ?? e.start?.date ?? "",
      end: e.end?.dateTime ?? e.end?.date ?? "",
      allDay: Boolean(e.start?.date && !e.start?.dateTime),
      location: e.location,
      attendeeCount: e.attendees?.length ?? 1,
    }));

  return {
    date: todayYmd,
    headline:
      "One urgent decision, two warm deals, and a clear morning — here's your day at a glance.",
    overview: [
      "Good news first: ZenScail read **42 emails** overnight and only **3** actually need you. ",
      "The one that can't wait is **Priya's Q3 partnership** — she has legal sign-off and needs your call on the revenue split by **Friday**.",
      "",
      "Two deals are warming up: **Rohan is ready to sign** (he wants the SOW and a kickoff), and **Sneha is waiting** on proposal feedback before your call.",
      "",
      "Your morning is protected for deep work — your first meeting is the **Design review at 9:30**, and nothing on your calendar conflicts. Everything else is just noise we've already tucked away.",
    ].join("\n"),
    actionItems: [
      {
        title: "Decide the Q3 revenue split for Priya",
        detail: "Legal already approved on their side; she needs your answer to announce next week. Due Friday.",
        urgency: "high",
        from: "Priya Nair",
        subject: "Re: Q3 partnership — can we lock the terms by Friday?",
        threadId: "demo-2",
        messageId: "demo-2",
      },
      {
        title: "Send Rohan the SOW + propose a kickoff",
        detail: "His team is sold and wants to start next week.",
        urgency: "medium",
        from: "Rohan Mehta",
        subject: "Loved the walkthrough — when can we start?",
        threadId: "demo-4",
        messageId: "demo-4",
      },
      {
        title: "Reply to Sneha with proposal feedback",
        detail: "She's following up and wants your thoughts before the call.",
        urgency: "medium",
        from: "Sneha Iyer",
        subject: "Following up — did the proposal land okay?",
        threadId: "demo-7",
        messageId: "demo-7",
      },
      {
        title: "Confirm Sunday family dinner",
        detail: "7pm, biryani — just need a yes.",
        urgency: "low",
        from: "Dad",
        subject: "Dinner Sunday?",
        threadId: "demo-10",
        messageId: "demo-10",
      },
    ],
    events: todayEvents,
    stats: { emailsReviewed: 42, urgentCount: 1, meetingsToday: todayEvents.length },
    itemStates: {},
    createdAt: new Date(now),
  };
}
