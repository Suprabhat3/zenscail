"use client";

import { useState } from "react";
import { EMAILS } from "./demo-data";
import { useTypewriter } from "./useTypewriter";

type Pane = "brief" | "inbox" | "cal";

const SparkIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 13 13" aria-hidden="true">
    <path d="M 6.5 0.5 L 7.8 4.7 L 12 6 L 7.8 7.3 L 6.5 11.5 L 5.2 7.3 L 1 6 L 5.2 4.7 Z" fill="var(--accent)" />
  </svg>
);

function DraftBox({ draft }: { draft: string }) {
  const { text, done } = useTypewriter(draft, { speed: 8, delay: 100 });
  return (
    <div className="draft-box show">
      {text}
      {!done && <span className="typed-cursor" />}
    </div>
  );
}

export function Demo() {
  const [activePane, setActivePane] = useState<Pane>("inbox");
  const [selectedId, setSelectedId] = useState(EMAILS[0].id);
  const [pickedReply, setPickedReply] = useState<number | null>(null);
  const [slotBooked, setSlotBooked] = useState(false);

  const email = EMAILS.find((e) => e.id === selectedId) ?? EMAILS[0];

  function selectEmail(id: string) {
    setSelectedId(id);
    setPickedReply(null);
  }

  const tabs: { pane: Pane; label: string; badge?: string; icon: React.ReactNode }[] = [
    {
      pane: "brief",
      label: "Daily brief",
      icon: (
        <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
          <circle cx="8.5" cy="10" r="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M 2 14 H 15 M 8.5 2 V 4 M 3 5 L 4.5 6.5 M 14 5 L 12.5 6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none" />
        </svg>
      ),
    },
    {
      pane: "inbox",
      label: "Inbox",
      badge: "3",
      icon: (
        <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
          <rect x="1.5" y="3" width="14" height="11" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M 2 5 L 8.5 9.5 L 15 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      pane: "cal",
      label: "Calendar",
      icon: (
        <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
          <rect x="1.5" y="2.5" width="14" height="12.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M 1.5 6.5 H 15.5 M 5 1 V 4 M 12 1 V 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none" />
        </svg>
      ),
    },
  ];

  return (
    <div className="demo-shell" id="demo-app">
      <div className="demo-titlebar">
        <span className="dot-tl" />
        <span className="dot-tl" />
        <span className="dot-tl" />
        <span className="demo-addr">zenscail.com</span>
        <span className="demo-hint">
          <SparkIcon />
          <span>Interactive — everything is clickable</span>
        </span>
      </div>
      <div className="demo-body">
        <div className="demo-side">
          {tabs.map((tab) => (
            <button
              key={tab.pane}
              type="button"
              className={`demo-tab${activePane === tab.pane ? " active" : ""}`}
              onClick={() => setActivePane(tab.pane)}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge && <span className="badge">{tab.badge}</span>}
            </button>
          ))}
          <p className="demo-side-foot">Maya&rsquo;s workspace · Wednesday, April 8</p>
        </div>

        {activePane === "brief" && (
          <div className="demo-pane active">
            <div className="briefp">
              <h3>Good morning, Maya</h3>
              <p className="bp-sub">Here&rsquo;s your Wednesday in thirty seconds.</p>
              <ul className="brief-items" style={{ marginTop: 20 }}>
                <li><span className="bi-time">First</span><span><strong>Reply to Priya</strong> — contract sign-off due Friday. Draft is waiting in your inbox.</span></li>
                <li><span className="bi-time">9:30 AM</span><span><strong>Design review</strong> — product team, 45 min. Figma linked in the invite.</span></li>
                <li><span className="bi-time">2:30 PM</span><span><strong>1:1 with Sam</strong> — he moved it from noon and wants to cover the Q2 roadmap.</span></li>
                <li><span className="bi-time">Heads up</span><span>Atlas Studio invoice (<strong>$4,800</strong>) due April 14 — confirm receipt when you get a sec.</span></li>
                <li><span className="bi-time">Quiet</span><span>After 3 PM you&rsquo;re free. I&rsquo;ve held it for deep work — say the word and I&rsquo;ll let meetings in.</span></li>
              </ul>
            </div>
          </div>
        )}

        {activePane === "inbox" && (
          <div className="demo-pane inbox-pane active">
            <div className="email-list">
              {EMAILS.map((em) => (
                <button
                  key={em.id}
                  type="button"
                  className={`email-row${em.id === selectedId ? " selected" : ""}`}
                  onClick={() => selectEmail(em.id)}
                >
                  <span className="er-top">
                    <span className="er-from">{em.from}</span>
                    <span className="er-time">{em.time}</span>
                  </span>
                  <span className="er-subj">{em.subj}</span>
                  <span className="er-prev">{em.prev}</span>
                  <span className={`er-tag tag-${em.tag[0]}`}>{em.tag[1]}</span>
                </button>
              ))}
            </div>
            <div className="email-detail">
              <h4 className="ed-subject">{email.subj}</h4>
              <p className="ed-meta">{email.meta}</p>
              <div className="ai-summary">
                <span className="ai-summary-label">
                  <SparkIcon size={12} />
                  <span>ZenScail summary</span>
                </span>
                <ul>
                  {email.summary.map((s, i) => (
                    // summary strings are our own constants — safe to inject
                    <li key={i} dangerouslySetInnerHTML={{ __html: s }} />
                  ))}
                </ul>
              </div>
              {email.replies.length > 0 && (
                <div className="reply-chips">
                  <p className="reply-chips-label">Reply in your voice — pick a direction:</p>
                  <div className="reply-chip-row">
                    {email.replies.map((r, i) => (
                      <button
                        key={r.label}
                        type="button"
                        className={`reply-chip${pickedReply === i ? " picked" : ""}`}
                        onClick={() => setPickedReply(i)}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  {pickedReply !== null && (
                    <DraftBox
                      key={`${email.id}-${pickedReply}`}
                      draft={email.replies[pickedReply].draft}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activePane === "cal" && (
          <div className="demo-pane cal-pane active">
            <div className="cal-head">
              <h3>This week</h3>
              <span>April 6 – 10</span>
            </div>
            <div className="cal-scroll">
            <div className="cal-grid">
              <span className="cg-corner" />
              <span className="cg-day">Mon 6</span>
              <span className="cg-day">Tue 7</span>
              <span className="cg-day cg-today">Wed 8</span>
              <span className="cg-day">Thu 9</span>
              <span className="cg-day">Fri 10</span>
              <span className="cg-hour">9 AM</span>
              <span className="cg-cell"><span className="cal-event ce-sage">Team sync</span></span>
              <span className="cg-cell" />
              <span className="cg-cell"><span className="cal-event ce-gold ce-tall">Design review<br />9:30 – 10:15</span></span>
              <span className="cg-cell" />
              <span className="cg-cell"><span className="cal-event ce-sage">Planning</span></span>
              <span className="cg-hour">10 AM</span>
              <span className="cg-cell" />
              <span className="cg-cell"><span className="cal-event ce-rose">Priya — terms call</span></span>
              <span className="cg-cell" />
              <span className="cg-cell" />
              <span className="cg-cell" />
              <span className="cg-hour">11 AM</span>
              <span className="cg-cell" />
              <span className="cg-cell" />
              <span className="cg-cell" />
              <span className="cg-cell">
                <span
                  className={`cal-suggest${slotBooked ? " confirmed" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSlotBooked(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSlotBooked(true);
                  }}
                >
                  {slotBooked ? "Booked ✓ — invite sent" : "AI found this slot — tap to book"}
                </span>
              </span>
              <span className="cg-cell" />
              <span className="cg-hour">2 PM</span>
              <span className="cg-cell" />
              <span className="cg-cell"><span className="cal-event ce-sage">Interview</span></span>
              <span className="cg-cell"><span className="cal-event ce-rose">1:1 with Sam · 2:30</span></span>
              <span className="cg-cell" />
              <span className="cg-cell" />
            </div>
            </div>
            <p className="cal-foot">
              <svg width="15" height="15" viewBox="0 0 13 13" aria-hidden="true">
                <path d="M 6.5 0.5 L 7.8 4.7 L 12 6 L 7.8 7.3 L 6.5 11.5 L 5.2 7.3 L 1 6 L 5.2 4.7 Z" fill="var(--accent)" />
              </svg>
              {slotBooked ? (
                <span>
                  Done. Invite sent to Priya and Sam — <strong>Thursday 11:00</strong> works for all three calendars.
                </span>
              ) : (
                <span>
                  You asked for 30 minutes with Priya and Sam this week. <strong>Thursday 11:00</strong> works for everyone — tap the slot to book it.
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
