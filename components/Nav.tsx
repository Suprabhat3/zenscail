"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "@/lib/auth-client";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { data: session, isPending } = useSession();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`nav${scrolled ? " scrolled" : ""}`}>
      <div className="wrap nav-inner">
        <a className="logo" href="/">
          <Image src="/logo.png" alt="ZenScail" width={33} height={30} priority />
          <span>ZenScail</span>
        </a>
        <div className="nav-links">
          <a href="/#features">Features</a>
          <a href="/#demo">See it work</a>
          <a href="/#pricing">Pricing</a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {session ? (
            <Link className="btn btn-primary btn-sm" href="/dashboard">
              Open app →
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="btn btn-ghost btn-sm"
                style={{ visibility: isPending ? "hidden" : undefined }}
              >
                Sign in
              </Link>
              <Link className="btn btn-primary btn-sm" href="/login?mode=signup">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
