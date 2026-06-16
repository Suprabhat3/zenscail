import { Reveal } from "./Reveal";
import { BetaCta } from "./BetaCta";

export function FinalCta() {
  return (
    <section className="cta-final" id="join">
      <Reveal className="wrap">
        <svg className="cta-sun" width="72" height="48" viewBox="0 0 72 48" aria-hidden="true">
          <circle cx="36" cy="36" r="16" fill="var(--accent)" />
          <path d="M 4 40 H 68" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
          <path d="M 36 4 V 12 M 14 13 L 19.5 18.5 M 58 13 L 52.5 18.5" stroke="var(--gold)" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        <h2 className="display">
          Tomorrow morning
          <br />
          could feel <em>different.</em>
        </h2>
        <p className="lede">
          ZenScail is in open beta and free to start — sign up and get your first
          morning brief tomorrow.
        </p>
        <div style={{ marginTop: 32, display: "flex", justifyContent: "center" }}>
          <BetaCta />
        </div>
      </Reveal>
    </section>
  );
}
