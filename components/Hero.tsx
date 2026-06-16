"use client";

import { BetaCta } from "./BetaCta";
import { useTypewriter } from "./useTypewriter";

const BRIEF_HTML =
  "Good morning, Maya. <mark>3 emails</mark> need a reply — the Linear contract is the urgent one. Your <mark>1:1 with Sam</mark> moved to 2:30pm, so your afternoon is clear for deep work. I drafted a reply to the invoice thread; one tap to send.";

export function Hero() {
  const { text, done } = useTypewriter(BRIEF_HTML, { speed: 18, delay: 600 });

  return (
    <header className="hero" id="top">
      <div className="hero-horizon" aria-hidden="true">
        <svg width="100%" height="100%" viewBox="0 0 1400 760" preserveAspectRatio="xMidYMax slice">
          <circle cx="1050" cy="780" r="520" fill="none" stroke="var(--line)" strokeWidth="1.5" />
          <circle cx="1050" cy="780" r="640" fill="none" stroke="var(--line-soft)" strokeWidth="1.5" />
          <circle cx="1050" cy="780" r="400" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="2 10" strokeLinecap="round" />
          <circle cx="1050" cy="780" r="760" fill="none" stroke="var(--line-soft)" strokeWidth="1.5" />
        </svg>
      </div>
      <div className="wrap hero-grid">
        <div className="reveal in-view">
          <span className="eyebrow">
            Email + calendar + AI
            <span
              style={{
                marginLeft: 10,
                padding: "2px 10px",
                borderRadius: 99,
                background: "var(--accent-soft)",
                color: "var(--accent-deep)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              NOW IN BETA
            </span>
          </span>
          <h1 className="display" style={{ marginTop: 20 }}>
            Your day,
            <br />
            already{" "}
            <span className="underline-word">
              <em>sorted.</em>
              <svg viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true">
                <path d="M 4 9 Q 50 3 100 8 T 196 7" />
              </svg>
            </span>
          </h1>
          <p className="lede">
            ZenScail reads your inbox and calendar so you don&rsquo;t have to.
            Every morning, one calm brief: what matters, what can wait, and
            what&rsquo;s already handled for you.
          </p>
          <BetaCta showNote />
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="hv-card hv-cal float">
            <div className="hv-cal-month">
              <span>April</span>
              <span>2026</span>
            </div>
            <div className="hv-cal-days">
              <span className="dim">M</span><span className="dim">T</span><span className="dim">W</span><span className="dim">T</span><span className="dim">F</span><span className="dim">S</span><span className="dim">S</span>
              <span>6</span><span className="dot">7</span><span className="today">8</span><span className="dot">9</span><span>10</span><span className="dim">11</span><span className="dim">12</span>
              <span className="dot">13</span><span>14</span><span>15</span><span className="dot">16</span><span>17</span><span className="dim">18</span><span className="dim">19</span>
            </div>
          </div>

          <div className="hv-card hv-brief">
            <div className="hv-head">
              <svg className="hv-sun" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
                <circle cx="17" cy="17" r="16" fill="var(--accent-soft)" />
                <circle cx="17" cy="20" r="6" fill="var(--accent)" />
                <path d="M 7 24 H 27" stroke="var(--accent-deep)" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <div>
                <strong>Your morning brief</strong>
                <span>Wednesday, April 8 · 7:00 AM</span>
              </div>
            </div>
            <p className="hv-brief-body">
              {/* our own constant — safe to inject */}
              <span dangerouslySetInnerHTML={{ __html: text }} />
              {!done && <span className="typed-cursor" />}
            </p>
          </div>

          <div className="hv-card hv-event float float-b">
            <span className="hv-event-bar" />
            <div>
              <strong>1:1 with Sam</strong>
              <span>Moved to 2:30 PM — you said yes</span>
            </div>
          </div>

          <div className="hv-reminder float float-c">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M 8 2 C 5.5 2 4 4 4 6.5 V 10 L 2.5 12 H 13.5 L 12 10 V 6.5 C 12 4 10.5 2 8 2 Z"
                fill="none"
                stroke="var(--gold)"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M 6.5 13.5 A 1.8 1.8 0 0 0 9.5 13.5"
                fill="none"
                stroke="var(--gold)"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span>Nudge: Priya&rsquo;s contract — reply before Friday</span>
          </div>

          <div className="hv-card hv-reply float">
            <span className="hv-reply-label">
              <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
                <path d="M 6.5 0.5 L 7.8 4.7 L 12 6 L 7.8 7.3 L 6.5 11.5 L 5.2 7.3 L 1 6 L 5.2 4.7 Z" fill="var(--accent)" />
              </svg>
              <span>Draft ready</span>
            </span>
            <p>
              &ldquo;Hi Priya — terms look good on our side. I&rsquo;ll sign
              today so we&rsquo;re ahead of Friday&hellip;&rdquo;
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
