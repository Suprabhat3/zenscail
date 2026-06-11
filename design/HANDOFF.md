# ZenScail — Design → Next.js Handoff Guide

This folder contains the finished landing page design:

| File | What it is | Where it goes in Next.js |
|---|---|---|
| `ZenScail Landing.html` | Full page markup (source of truth) | Split into React components (see §3) |
| `zenscail.css` | Entire design system + all section styles | `app/globals.css` (or CSS modules) |
| `zenscail-fx.js` | Scroll reveal, nav state, typing effect, waitlist | Rewrite as small hooks/components (§4) |
| `zenscail-demo.js` | Interactive demo data + logic | Rewrite as one client component (§5) |
| `tweaks-panel.jsx`, `zenscail-tweaks.jsx` | Design-time tweak panel | **Do not port** — design tool only |

---

## 1. Scaffold

```bash
npx create-next-app@latest zenscail --app --no-tailwind --eslint
cd zenscail
```

No Tailwind needed — the design is plain CSS custom properties and works as-is.
(If your team prefers Tailwind, keep `globals.css` for the tokens and use Tailwind only for new pages.)

## 2. Fonts (next/font, not the <link> tags)

The HTML loads Google Fonts via `<link>`. In Next.js, use `next/font/google` instead
(no layout shift, self-hosted):

```tsx
// app/layout.tsx
import { Instrument_Serif, Schibsted_Grotesk } from "next/font/google";

const display = Instrument_Serif({
  weight: "400", style: ["normal", "italic"],
  subsets: ["latin"], variable: "--font-display",
});
const body = Schibsted_Grotesk({
  subsets: ["latin"], variable: "--font-body",
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

Then in `globals.css`, **delete** the two `--font-display` / `--font-body` lines from
`:root` (next/font now provides them) and remove the Google Fonts `<link>` tags entirely.

## 3. Component breakdown

Copy `zenscail.css` → `app/globals.css` unchanged. Then split the HTML body into:

```
app/
  layout.tsx
  page.tsx              ← assembles the sections below
components/
  Nav.tsx               ← .nav            (client: scroll listener)
  Hero.tsx              ← .hero           (client: typing effect + waitlist)
  BriefShowcase.tsx     ← #features .brief-stage   (server, static)
  Features.tsx          ← .features-grid  (server, static — SVGs animate via SMIL)
  Demo.tsx              ← #demo           (client: the whole interactive demo)
  Pricing.tsx           ← #pricing        (server, static)
  FinalCta.tsx          ← #join           (client: waitlist form)
  Footer.tsx            ← .footer         (server, static)
  Reveal.tsx            ← scroll-reveal wrapper (client)
  Waitlist.tsx          ← shared form used by Hero + FinalCta
```

Conversion is mostly mechanical: `class` → `className`, close all tags, inline
`style="..."` → `style={{ ... }}`. The SVG attributes used (`stroke-width` etc.)
become camelCase (`strokeWidth`).

Static sections (BriefShowcase, Features, Pricing, Footer) need **no** `"use client"` —
they're pure markup and the SVG animations are SMIL (`<animate>`), which needs no JS.

## 4. Porting zenscail-fx.js → React

Three small pieces:

**a) Reveal-on-scroll** — replace the global IntersectionObserver with a wrapper:

```tsx
// components/Reveal.tsx
"use client";
import { useEffect, useRef } from "react";

export function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: 0|1|2|3 }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && (e.target.classList.add("in-view"), io.disconnect()),
      { threshold: 0.18 }
    );
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`reveal${delay ? ` reveal-d${delay}` : ""}`}>{children}</div>;
}
```

Wrap each section's content in `<Reveal>` where the HTML had `class="reveal"`.

**b) Nav scrolled state** — `useEffect` + `useState(scrollY > 8)` in `Nav.tsx`,
toggling the `scrolled` class.

**c) Typing effect** — port `typeHTML` as a `useTypewriter(html, { speed, delay })`
hook that returns the progressively-built string; render with
`dangerouslySetInnerHTML` (the content is your own constant, so it's safe).
Keep the `prefers-reduced-motion` check: render the full string immediately when set.

## 5. Porting zenscail-demo.js → Demo.tsx

The demo is the only genuinely stateful part. The vanilla JS builds DOM by hand —
in React it collapses nicely:

- Move the `EMAILS` array to `components/demo-data.ts` verbatim.
- State: `activePane` (`"brief" | "inbox" | "cal"`), `selectedEmail` (id),
  `pickedReply` (index | null), `slotBooked` (boolean).
- The email rows, summary bullets, and reply chips all become `.map()` renders —
  delete all the `createElement`/`innerHTML` code.
- Summary strings contain `<strong>` tags → render with `dangerouslySetInnerHTML`
  or split them into typed objects if you prefer.
- Reuse the typewriter hook from §4c for the draft box.

## 6. Make the waitlist real

The form is currently visual-only. Wire it up with a server action:

```tsx
// app/actions.ts
"use server";
export async function joinWaitlist(formData: FormData) {
  const email = formData.get("email");
  // validate, then store: DB row, Resend/Loops audience, or a simple KV
}
```

`Waitlist.tsx` uses `useActionState` for the success state (the `.joined` class swap
already styled in CSS). Keep the existing success pill markup.

## 7. Polish checklist before shipping

- [ ] `metadata` export in `layout.tsx` (title, description, OG image)
- [ ] Replace `#top` placeholder links in the footer (About/Blog/etc.) or remove rows
- [ ] Add a real favicon from the logo mark (the `<svg>` circle + dot in Nav)
- [ ] Lighthouse pass — the page is static-friendly; everything except Demo/Hero/Nav
      can stay as Server Components
- [ ] Decide accent/paper-tone now — the Tweaks panel values were design-time;
      bake your final choice into `:root` in `globals.css` and delete the tweak files

## Gotchas

- **`color-mix()` and `text-wrap: pretty`** are used in the CSS — fine in all modern
  browsers, but check your browserslist if you must support older Safari.
- **Smooth scroll**: `html { scroll-behavior: smooth }` + anchor links work as-is in
  Next; no router needed since it's a single page.
- The `--motion` / `.motion-off` hooks in the CSS belong to the design-time tweaks
  panel; you can delete them, but **keep** the `prefers-reduced-motion` media queries.
