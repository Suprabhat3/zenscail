/* ZenScail — Tweaks panel (accent, paper tone, motion) */
const ZS_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#E11D48",
  "paper": "warm",
  "motion": true
}/*EDITMODE-END*/;

const ZS_ACCENTS = {
  "#E11D48": { deep: "#B81239", soft: "#FCE9ED", tint: "#F9DFE5" },
  "#C2410C": { deep: "#9A3412", soft: "#FBEADF", tint: "#F7DCC9" },
  "#0F766E": { deep: "#0B5953", soft: "#E2F0EE", tint: "#CFE5E2" },
  "#7C3AED": { deep: "#6326C7", soft: "#EFE8FC", tint: "#E3D7F9" }
};

const ZS_PAPERS = {
  warm: { bg: "#FAF5EC", deep: "#F2EBDD", paper: "#FFFDF8", line: "#E6DCC8", lineSoft: "#EFE7D6" },
  neutral: { bg: "#F7F6F3", deep: "#EDEBE5", paper: "#FFFFFF", line: "#E2DFD7", lineSoft: "#ECEAE3" }
};

function ZenScailTweaks() {
  const [t, setTweak] = useTweaks(ZS_TWEAK_DEFAULTS);

  React.useEffect(() => {
    const r = document.documentElement.style;
    const a = ZS_ACCENTS[t.accent] || ZS_ACCENTS["#E11D48"];
    r.setProperty("--accent", t.accent);
    r.setProperty("--accent-deep", a.deep);
    r.setProperty("--accent-soft", a.soft);
    r.setProperty("--accent-tint", a.tint);
    const p = ZS_PAPERS[t.paper] || ZS_PAPERS.warm;
    r.setProperty("--bg", p.bg);
    r.setProperty("--bg-deep", p.deep);
    r.setProperty("--paper", p.paper);
    r.setProperty("--line", p.line);
    r.setProperty("--line-soft", p.lineSoft);
    document.body.classList.toggle("motion-off", !t.motion);
    r.setProperty("--motion-play", t.motion ? "running" : "paused");
    document.querySelectorAll(".float").forEach((el) => {
      el.style.animationPlayState = t.motion ? "running" : "paused";
    });
  }, [t]);

  return (
    <TweaksPanel>
      <TweakSection label="Theme"></TweakSection>
      <TweakColor
        label="Accent"
        value={t.accent}
        options={["#E11D48", "#C2410C", "#0F766E", "#7C3AED"]}
        onChange={(v) => setTweak("accent", v)}
      ></TweakColor>
      <TweakRadio
        label="Paper tone"
        value={t.paper}
        options={["warm", "neutral"]}
        onChange={(v) => setTweak("paper", v)}
      ></TweakRadio>
      <TweakSection label="Motion"></TweakSection>
      <TweakToggle
        label="Lively animations"
        value={t.motion}
        onChange={(v) => setTweak("motion", v)}
      ></TweakToggle>
    </TweaksPanel>
  );
}

const zsTweaksRoot = document.getElementById("zs-tweaks-root");
if (zsTweaksRoot) {
  ReactDOM.createRoot(zsTweaksRoot).render(<ZenScailTweaks></ZenScailTweaks>);
}
