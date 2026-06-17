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
  </head>
  <body style="margin:0;padding:0;background:${C.bg};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg};font-size:1px;line-height:1px;">${opts.preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:40px 16px;">
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
              <td style="background:${C.paper};border:1px solid ${C.line};border-radius:20px;padding:40px 36px;box-shadow:0 12px 32px -16px rgba(37,32,26,0.25);">
                ${opts.body}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:24px 8px 0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:${C.muted};">
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
