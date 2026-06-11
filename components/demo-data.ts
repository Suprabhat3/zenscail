export type DemoEmail = {
  id: string;
  from: string;
  time: string;
  subj: string;
  prev: string;
  tag: [string, string];
  meta: string;
  summary: string[];
  replies: { label: string; draft: string }[];
};

export const EMAILS: DemoEmail[] = [
  {
    id: "linear",
    from: "Priya Nair",
    time: "8:42 AM",
    subj: "Contract renewal — need your sign-off by Friday",
    prev: "Hi Maya, following up on the renewal terms we discussed last week…",
    tag: ["action", "Needs reply"],
    meta: "Priya Nair · to you, Sam · thread of 9",
    summary: [
      "Renewal terms updated: 12-month term at the same rate, net-30 billing.",
      "Legal already approved the redlines on Tuesday — nothing is blocking.",
      "Priya needs your signature by <strong>Friday EOD</strong> or pricing resets.",
    ],
    replies: [
      {
        label: "Looks good — signing today",
        draft:
          "Hi Priya — thanks for shepherding this through. The terms look good on our side, and legal’s already cleared the redlines. I’ll get my signature on it today so we’re well ahead of Friday. — Maya",
      },
      {
        label: "One question first",
        draft:
          "Hi Priya — almost there. Quick question before I sign: does the net-30 billing start from invoice date or delivery date? Once that’s confirmed I’ll sign right away. — Maya",
      },
      {
        label: "Loop in finance",
        draft:
          "Hi Priya — terms look right to me. I’m looping in Dana from finance to give the billing schedule a final once-over, then I’ll sign. We’ll be done well before Friday. — Maya",
      },
    ],
  },
  {
    id: "invoice",
    from: "Atlas Studio",
    time: "8:15 AM",
    subj: "Invoice #2041 — March retainer",
    prev: "Please find attached the invoice for March. Payment is due within…",
    tag: ["action", "Needs reply"],
    meta: "Atlas Studio · to you · thread of 2",
    summary: [
      "March retainer invoice: <strong>$4,800</strong>, due April 14 (net-30).",
      "Same scope as February — no line-item changes.",
      "They asked you to confirm receipt so their books close on time.",
    ],
    replies: [
      {
        label: "Confirm — payment scheduled",
        draft:
          "Hi team — confirming receipt of invoice #2041. Everything matches the agreed scope, and I’ve scheduled payment for April 10, ahead of the due date. Thanks as always! — Maya",
      },
      {
        label: "Ask for PO number",
        draft:
          "Hi team — got the invoice, thank you. Could you re-issue it with our PO number (ZS-0231) referenced? Our finance system needs it to process payment. Appreciate it! — Maya",
      },
    ],
  },
  {
    id: "standup",
    from: "Sam Okafor",
    time: "7:58 AM",
    subj: "Moving our 1:1 to 2:30 today?",
    prev: "Morning! Something came up at noon — any chance we can shift…",
    tag: ["meeting", "Meeting"],
    meta: "Sam Okafor · to you · thread of 3",
    summary: [
      "Sam asks to move today’s 1:1 from <strong>12:00 to 2:30pm</strong>.",
      "Your 2:30 slot is free — ZenScail already checked your calendar.",
      "He wants to cover the Q2 roadmap and one hiring update.",
    ],
    replies: [
      {
        label: "2:30 works — confirmed",
        draft:
          "Morning Sam — 2:30 works perfectly, calendar’s already updated. I’ll bring my notes on the Q2 roadmap, and curious to hear the hiring update. See you then! — Maya",
      },
      {
        label: "Propose 4pm instead",
        draft:
          "Hey Sam — 2:30 is a bit tight on my end. Could we do 4:00 instead? I’m free then and we’d have the full half hour for the roadmap. — Maya",
      },
    ],
  },
  {
    id: "digest",
    from: "Field Notes Weekly",
    time: "6:30 AM",
    subj: "Issue 81 — the slow productivity movement",
    prev: "This week: why doing less, better, is having a moment…",
    tag: ["fyi", "FYI"],
    meta: "Field Notes Weekly · newsletter",
    summary: [
      "Newsletter — nothing for you to act on.",
      "Main essay argues focus time beats response time for knowledge work.",
      "ZenScail filed it under <strong>Reading</strong>; it never hit your inbox sound.",
    ],
    replies: [],
  },
];
