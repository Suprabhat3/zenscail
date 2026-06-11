import { Reveal } from "./Reveal";

export function BriefShowcase() {
  return (
    <section className="section" id="features">
      <div className="wrap">
        <Reveal className="brief-stage">
          <svg className="brief-sky" viewBox="0 0 1100 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <circle cx="930" cy="90" r="3" fill="#C98A2D" opacity="0.8" />
            <circle cx="1010" cy="170" r="2" fill="#C98A2D" opacity="0.5" />
            <circle cx="860" cy="40" r="2" fill="#FAF5EC" opacity="0.4" />
            <circle cx="980" cy="300" r="2.5" fill="#FAF5EC" opacity="0.3" />
            <circle cx="80" cy="440" r="2" fill="#C98A2D" opacity="0.5" />
            <path d="M -40 530 A 560 560 0 0 1 520 620" fill="none" stroke="#C98A2D" strokeWidth="1" opacity="0.4" />
          </svg>
          <div>
            <span className="eyebrow">The daily brief</span>
            <h2 className="display" style={{ marginTop: 16 }}>
              Open ZenScail.
              <br />
              Read one thing.
              <br />
              <em>Know your whole day.</em>
            </h2>
            <p className="lede">
              Every morning at 7, ZenScail reads overnight email, checks
              today&rsquo;s calendar, and writes you a brief a good chief of
              staff would be proud of. Meetings, must-replies, gentle nudges —
              all in thirty seconds of reading.
            </p>
          </div>
          <Reveal delay={1} className="brief-card">
            <div className="brief-card-head">
              <h3>Wednesday, April 8</h3>
              <time>7:00 AM brief</time>
            </div>
            <ul className="brief-items">
              <li><span className="bi-time">First</span><span><strong>Reply to Priya</strong> — contract renewal needs your sign-off by Friday. A draft is ready.</span></li>
              <li><span className="bi-time">9:30 AM</span><span><strong>Design review</strong> with the product team. Figma file attached to the invite.</span></li>
              <li><span className="bi-time">2:30 PM</span><span><strong>1:1 with Sam</strong> — moved from noon. He wants to talk Q2 roadmap.</span></li>
              <li><span className="bi-time">Heads up</span><span>Atlas Studio&rsquo;s invoice is due next week — <strong>one tap to confirm</strong> receipt.</span></li>
              <li><span className="bi-time">Quiet</span><span>Your afternoon after 3 is clear. Protected it for deep work.</span></li>
            </ul>
          </Reveal>
        </Reveal>
      </div>
    </section>
  );
}
