import Image from "next/image";

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <a className="logo" href="/">
              <Image src="/logo.png" alt="ZenScail" width={27} height={24} />
              <span>ZenScail</span>
            </a>
            <p className="footer-tag">
              Email and calendar, gathered into one calm morning brief. Built
              for people who&rsquo;d rather be working.
            </p>
            <div className="footer-social">
              <a
                href="https://x.com/suprabhat_3"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="ZenScail on X (Twitter)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
                </svg>
              </a>
              <a
                href="https://www.linkedin.com/in/suprabhatt"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="ZenScail on LinkedIn"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.266 2.37 4.266 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124ZM7.119 20.452H3.555V9h3.564v11.452Z" />
                </svg>
              </a>
              <a
                href="https://new.suprabhat.site"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Developer's portfolio"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M 3 12 H 21 M 12 3 a 13.5 13.5 0 0 1 0 18 M 12 3 a 13.5 13.5 0 0 0 0 18" />
                </svg>
              </a>
            </div>
          </div>
          <div>
            <h4>Product</h4>
            <ul>
              <li><a href="/#features">Features</a></li>
              <li><a href="/#demo">Live demo</a></li>
              <li><a href="/#pricing">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li><a href="/about">About</a></li>
              <li><a href="/founder">Founder</a></li>
              <li><a href="/contact">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4>Trust</h4>
            <ul>
              <li><a href="/privacy">Privacy</a></li>
              <li><a href="/security">Security</a></li>
              <li><a href="/terms">Terms</a></li>
              <li><a href="/cookies">Cookies</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-base">
          <span>
            &copy; 2026 ZenScail. All rights reserved. &middot;{" "}
            <a href="mailto:team@zenscail.com">team@zenscail.com</a>
          </span>
          <span>Made with care, before 9 AM.</span>
        </div>
      </div>
    </footer>
  );
}
