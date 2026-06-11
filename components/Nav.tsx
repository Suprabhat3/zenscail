"use client";

import { useEffect, useState } from "react";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`nav${scrolled ? " scrolled" : ""}`}>
      <div className="wrap nav-inner">
        <a className="logo" href="#top">
          <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
            <path
              d="M 15 3.5 A 11.5 11.5 0 1 0 26.5 15"
              fill="none"
              stroke="var(--ink)"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <circle cx="23.5" cy="7.5" r="3.4" fill="var(--accent)" />
          </svg>
          <span>ZenScail</span>
        </a>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#demo">See it work</a>
          <a href="#pricing">Pricing</a>
        </div>
        <a className="btn btn-primary btn-sm" href="#join">
          Join the waitlist
        </a>
      </div>
    </nav>
  );
}
