import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { BriefShowcase } from "@/components/BriefShowcase";
import { Features } from "@/components/Features";
import { Demo } from "@/components/Demo";
import { Pricing } from "@/components/Pricing";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";

export default function Home() {
  return (
    <>
      <Nav />
      <Hero />
      <BriefShowcase />
      <Features />
      <section className="section" id="demo">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="eyebrow">Try it right here</span>
            <h2 className="display">
              Go on, <em>click around.</em>
            </h2>
            <p className="lede">
              This is a living preview of ZenScail. Open emails, pick a reply,
              book the meeting the AI found for you.
            </p>
          </Reveal>
          <Reveal>
            <Demo />
          </Reveal>
        </div>
      </section>
      <Pricing />
      <FinalCta />
      <Footer />
    </>
  );
}
