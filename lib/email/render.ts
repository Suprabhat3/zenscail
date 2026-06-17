import "server-only";

/**
 * Hand-crafted, inline-styled HTML emails. We avoid react-email/MJML so the
 * markup is dependency-free and renders consistently across mail clients
 * (Gmail, Outlook, Apple Mail) which strip <style> blocks and ignore CSS vars.
 *
 * Palette mirrors app/globals.css (cream paper · warm ink · rose accent).
 */

const C = {
  bg: "#FAF5EC",
  bgDeep: "#F2EBDD",
  paper: "#FFFDF8",
  ink: "#25201A",
  inkSoft: "#4E463B",
  muted: "#8A8073",
  line: "#E4DBC9",
  accent: "#E11D48",
  accentDeep: "#B81239",
  accentSoft: "#FCE9ED",
  sage: "#6E7F5E",
  gold: "#C98A2D",
};

const APP_URL =
  process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

/** Shared shell: centered cream card with the ZenScail wordmark + footer. */
function layout(opts: { preheader: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>ZenScail</title>
    <style>
      /* Mobile clients that honor <style> (Apple Mail, Gmail app, Outlook app):
         tighten the generous desktop padding so copy isn't squeezed into a
         2–3-word column on a phone. Inline styles are the desktop fallback. */
      @media only screen and (max-width: 600px) {
        .zs-outer { padding: 24px 10px !important; }
        .zs-card { padding: 26px 20px !important; border-radius: 16px !important; }
        .zs-footer { padding: 18px 4px 0 !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${C.bg};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg};font-size:1px;line-height:1px;">${opts.preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="zs-outer" style="background:${C.bg};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <!-- Wordmark -->
            <tr>
              <td style="padding:0 8px 22px;">
                <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:400;color:${C.ink};letter-spacing:-0.01em;">
                  Zen<span style="color:${C.accent};">Scail</span>
                </span>
              </td>
            </tr>
            <!-- Card -->
            <tr>
              <td class="zs-card" style="background:${C.paper};border:1px solid ${C.line};border-radius:20px;padding:36px 32px;box-shadow:0 12px 32px -16px rgba(37,32,26,0.25);">
                ${opts.body}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td class="zs-footer" style="padding:24px 8px 0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:${C.muted};">
                ZenScail — a calmer inbox, an AI that works while you don't.<br />
                You're receiving this because you created a ZenScail account.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const sans = "font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;";
const serif = "font-family:Georgia,'Times New Roman',serif;";

function greeting(name?: string): string {
  const who = name?.trim().split(/\s+/)[0];
  return who ? `Hi ${escapeHtml(who)},` : "Hi there,";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Wrap user-composed email content (an inline-styled HTML fragment, e.g. from
 * the rich composer or the AI "Prettify" step) in the branded ZenScail card so
 * it renders consistently across mail clients. `preheader` is the hidden inbox
 * preview line. Returns a full HTML document ready for the HTML MIME part.
 */
export function wrapComposedEmail(opts: { body: string; preheader?: string }): string {
  return layout({ preheader: opts.preheader ?? "", body: opts.body });
}

export function verificationEmail(opts: { code: string; name?: string }): {
  subject: string;
  html: string;
  text: string;
} {
  // One digit per cell — reads like the OTP boxes in the app, and survives
  // every mail client (no letter-spacing rounding, no font fallback drift).
  const cells = opts.code
    .split("")
    .map(
      (d) => `
        <td style="padding:0 5px;">
          <div style="${sans}width:48px;height:60px;line-height:60px;text-align:center;background:${C.paper};border:1.5px solid ${C.line};border-radius:12px;font-size:30px;font-weight:700;color:${C.accentDeep};box-shadow:inset 0 -2px 0 ${C.bgDeep};">${escapeHtml(d)}</div>
        </td>`,
    )
    .join("");

  const body = `
    <div style="${sans}font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${C.accent};margin:0 0 10px;">Verify it's you</div>
    <h1 style="${serif}margin:0 0 14px;font-size:27px;font-weight:400;color:${C.ink};">One code stands between<br/>you and a calmer inbox</h1>
    <p style="${sans}margin:0 0 24px;font-size:15px;line-height:23px;color:${C.inkSoft};">
      ${greeting(opts.name)} drop this code into ZenScail to confirm your email. Then we'll start quietly taming the chaos for you.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 22px;">
      <tr>${cells}</tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
      <tr>
        <td style="background:${C.bgDeep};border-radius:12px;padding:12px 16px;">
          <span style="${sans}font-size:13px;line-height:20px;color:${C.inkSoft};">⏳ Expires in <strong style="color:${C.ink};">5 minutes</strong> — about the time it takes to <em>not</em> check your inbox.</span>
        </td>
      </tr>
    </table>
    <p style="${sans}margin:0;font-size:13px;line-height:20px;color:${C.muted};">
      Didn't try to sign up? Then someone has great taste and the wrong email — ignore this and nothing happens.
    </p>`;
  return {
    subject: `${opts.code} is your ZenScail verification code`,
    html: layout({ preheader: `Your verification code is ${opts.code}`, body }),
    text: `${greeting(opts.name)}\n\nYour ZenScail verification code is: ${opts.code}\n\nIt expires in 5 minutes. If you didn't sign up, ignore this email.`,
  };
}

export function onboardingEmail(opts: { name?: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const features: { icon: string; title: string; desc: string }[] = [
    { icon: "🔗", title: "Connect Gmail & Calendar", desc: "One secure link wires up your inbox and schedule — no setup spreadsheets, no IT ticket." },
    { icon: "🎯", title: "Triage with AI priority", desc: "Urgent mail floats to the top automatically. The newsletters you'll never read? They learn to sit down." },
    { icon: "✨", title: "Ask your assistant anything", desc: "“Reply to Sam and book 30 min Thursday” — it drafts, sends, and schedules while you sip the coffee." },
    { icon: "⌨️", title: "Fly with the keyboard", desc: "Gmail-style shortcuts (c, r, e, j/k, g i) for mouse-free triage. Your wrist will thank you." },
  ];
  const list = features
    .map(
      (f) => `
      <tr>
        <td width="34" valign="top" style="${sans}font-size:18px;line-height:24px;padding:0 0 18px;">${f.icon}</td>
        <td style="padding:0 0 18px;">
          <div style="${sans}font-size:15px;font-weight:600;color:${C.ink};margin:0 0 2px;">${f.title}</div>
          <div style="${sans}font-size:14px;line-height:21px;color:${C.inkSoft};">${f.desc}</div>
        </td>
      </tr>`,
    )
    .join("");

  const body = `
    <div style="${sans}font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${C.accent};margin:0 0 10px;">Welcome aboard 🎉</div>
    <h1 style="${serif}margin:0 0 14px;font-size:27px;font-weight:400;color:${C.ink};">Your inbox just exhaled</h1>
    <p style="${sans}margin:0 0 24px;font-size:15px;line-height:23px;color:${C.inkSoft};">
      ${greeting(opts.name)} you're in. ZenScail folds your Gmail and Google Calendar into one quiet, AI-assisted workspace — the kind of calm you usually have to pay a meditation app for. Here's what's waiting:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${list}</table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 6px;">
      <tr>
        <td style="background:${C.accent};border-radius:999px;box-shadow:0 8px 20px -8px ${C.accent};">
          <a href="${APP_URL}/connect" style="${sans}display:inline-block;padding:13px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Connect your account &rarr;</a>
        </td>
      </tr>
    </table>
    <p style="${sans}margin:18px 0 0;font-size:13px;line-height:20px;color:${C.muted};">
      Pro tip: press <span style="color:${C.ink};font-weight:600;">?</span> anywhere in the app to summon every keyboard shortcut. Power users only — but we both know that's you.
    </p>`;
  return {
    subject: "Welcome to ZenScail — let's connect your inbox",
    html: layout({ preheader: "Connect Gmail & Calendar and let your AI assistant take it from here.", body }),
    text: `${greeting(opts.name)}\n\nWelcome to ZenScail! Connect your Gmail and Google Calendar to get started: ${APP_URL}/connect\n\nWith ZenScail you can triage mail with AI priority, ask your assistant to draft/send/schedule, and fly through your inbox with keyboard shortcuts.`,
  };
}

/** "₹749", "$12", etc. Symbol-prefixed major-unit amount for the receipt. */
function money(amount: number, currency: string): string {
  const symbols: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
  const sym = symbols[currency.toUpperCase()];
  return sym ? `${sym}${amount}` : `${amount} ${currency.toUpperCase()}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/**
 * Payment receipt — sent only on the Cloud path, right after the subscription
 * is verified. Confirms the charge with a clean line-item card, the renewal
 * date, and a link to manage billing.
 */
export function cloudReceiptEmail(opts: {
  name?: string;
  amount: number;
  currency: string;
  interval: "month" | "year";
  /** When the next charge happens (current period end). */
  renewsOn?: Date | null;
}): { subject: string; html: string; text: string } {
  const price = money(opts.amount, opts.currency);
  const per = `/${opts.interval}`;
  const renews = opts.renewsOn ? fmtDate(opts.renewsOn) : "next cycle";

  const row = (label: string, value: string, strong = false) => `
    <tr>
      <td style="${sans}padding:11px 0;font-size:14px;color:${C.muted};border-bottom:1px solid ${C.line};">${label}</td>
      <td align="right" style="${sans}padding:11px 0;font-size:14px;${strong ? `font-weight:700;color:${C.ink};` : `color:${C.inkSoft};`}border-bottom:1px solid ${C.line};">${value}</td>
    </tr>`;

  const body = `
    <div style="${sans}font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${C.sage};margin:0 0 10px;">Payment received ✓</div>
    <h1 style="${serif}margin:0 0 14px;font-size:27px;font-weight:400;color:${C.ink};">You're officially on ZenScail Cloud</h1>
    <p style="${sans}margin:0 0 24px;font-size:15px;line-height:23px;color:${C.inkSoft};">
      ${greeting(opts.name)} thank you — your payment went through and Cloud is now humming in the background. No API keys to babysit, no setup. Just a calmer inbox, on us. Here's your receipt for the records:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bgDeep};border-radius:16px;padding:8px 20px;margin:0 0 22px;">
      <tr>
        <td style="padding:14px 0 6px;">
          <div style="${sans}font-size:16px;font-weight:700;color:${C.ink};">ZenScail Cloud</div>
          <div style="${sans}font-size:13px;color:${C.muted};">Hosted AI · models included · cancel anytime</div>
        </td>
        <td align="right" style="padding:14px 0 6px;">
          <span style="${serif}font-size:26px;color:${C.ink};">${price}</span><span style="${sans}font-size:13px;color:${C.muted};">${per}</span>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
      ${row("Billed today", price)}
      ${row("Billing cycle", opts.interval === "month" ? "Monthly" : "Yearly")}
      ${row("Renews on", renews)}
      ${row("Total paid", price, true)}
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">
      <tr>
        <td style="border:1.5px solid ${C.line};border-radius:999px;">
          <a href="${APP_URL}/settings/billing" style="${sans}display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:${C.ink};text-decoration:none;">Manage billing &rarr;</a>
        </td>
      </tr>
    </table>
    <p style="${sans}margin:16px 0 0;font-size:13px;line-height:20px;color:${C.muted};">
      Cancel whenever you like — you'll keep Cloud until <strong style="color:${C.inkSoft};">${renews}</strong>, no awkward exit interview. Questions about the charge? Just reply to this email.
    </p>`;

  return {
    subject: `Receipt — ZenScail Cloud (${price}${per})`,
    html: layout({ preheader: `Payment received. You're on ZenScail Cloud — ${price}${per}, renews ${renews}.`, body }),
    text: `${greeting(opts.name)}\n\nPayment received — welcome to ZenScail Cloud.\n\nZenScail Cloud: ${price}${per}\nBilling cycle: ${opts.interval === "month" ? "Monthly" : "Yearly"}\nRenews on: ${renews}\nTotal paid: ${price}\n\nManage billing: ${APP_URL}/settings/billing\n\nCancel anytime — you keep Cloud until ${renews}. Reply to this email with any questions.`,
  };
}

/**
 * The "last email you'll read manually" — the grand finale, sent once when a
 * fully-set-up user first lands on the dashboard (both BYOK and Cloud). A warm,
 * confident overview of what ZenScail now does for them, with personality.
 */
export function activatedEmail(opts: { name?: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const powers: { icon: string; text: string }[] = [
    { icon: "☀️", text: "<strong>A morning brief at 9:00</strong> — what matters, what can wait, what's already handled. Read it over coffee, not your inbox." },
    { icon: "🎯", text: "<strong>Auto-triage</strong> sorts urgent from noise the moment mail lands, so the important stuff never gets buried." },
    { icon: "✍️", text: "<strong>Replies in your voice</strong> — “Tell them yes, propose Thursday 3pm” and it drafts, schedules, and sends." },
    { icon: "📅", text: "<strong>Calendar on autopilot</strong> — book meetings, share availability links, and protect your deep-work blocks." },
    { icon: "🔔", text: "<strong>Follow-ups that follow themselves</strong> — it nudges you when someone goes quiet, so nothing slips." },
  ];
  const list = powers
    .map(
      (p) => `
      <tr>
        <td width="34" valign="top" style="${sans}font-size:18px;line-height:23px;padding:0 0 16px;">${p.icon}</td>
        <td style="${sans}font-size:14px;line-height:22px;color:${C.inkSoft};padding:0 0 16px;">${p.text}</td>
      </tr>`,
    )
    .join("");

  const body = `
    <div style="${sans}font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${C.accent};margin:0 0 10px;">You're all set 🎈</div>
    <h1 style="${serif}margin:0 0 16px;font-size:28px;font-weight:400;color:${C.ink};line-height:1.2;">This is the last email<br/>you'll read manually.</h1>
    <p style="${sans}margin:0 0 14px;font-size:15px;line-height:23px;color:${C.inkSoft};">
      ${greeting(opts.name)} we mean it. From here on, ZenScail reads the inbox so you don't have to. You skim one calm brief; we handle the hundred messages behind it.
    </p>
    <p style="${sans}margin:0 0 22px;font-size:15px;line-height:23px;color:${C.inkSoft};">
      Here's what's now working quietly on your behalf:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">${list}</table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 6px;">
      <tr>
        <td style="background:${C.accent};border-radius:999px;box-shadow:0 8px 20px -8px ${C.accent};">
          <a href="${APP_URL}/dashboard" style="${sans}display:inline-block;padding:13px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Open your morning brief &rarr;</a>
        </td>
      </tr>
    </table>
    <p style="${sans}margin:18px 0 0;font-size:13px;line-height:20px;color:${C.muted};">
      Go ahead — close this tab and live your life. We'll ping you only when something genuinely needs <em>you</em>. That's the whole point.
    </p>`;

  return {
    subject: "The last email you'll read manually 🎈",
    html: layout({ preheader: "You're all set. From here on, ZenScail reads the inbox so you don't have to.", body }),
    text: `${greeting(opts.name)}\n\nThis is the last email you'll read manually — we mean it.\n\nFrom here on, ZenScail handles your inbox:\n- A morning brief at 9:00 with what matters\n- Auto-triage that sorts urgent from noise\n- Replies drafted and sent in your voice\n- Calendar booking, availability links, deep-work protection\n- Follow-up nudges when someone goes quiet\n\nOpen your brief: ${APP_URL}/dashboard\n\nClose this tab and live your life — we'll ping you only when something genuinely needs you.`,
  };
}
