import Image from "next/image";

type Step = "connect" | "ai" | "subscribe";

const BASE_STEPS: { id: Step; label: string }[] = [
  { id: "connect", label: "Connect" },
  { id: "ai", label: "Choose AI" },
];

export function OnboardingShell({
  current,
  showSubscribe,
  greeting,
  children,
}: {
  current: Step;
  showSubscribe: boolean;
  greeting?: string;
  children: React.ReactNode;
}) {
  const steps = showSubscribe
    ? [...BASE_STEPS, { id: "subscribe" as Step, label: "Activate" }]
    : BASE_STEPS;
  const currentIndex = steps.findIndex((s) => s.id === current);

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-10 sm:py-14">
      {/* Brand */}
      <div className="flex items-center justify-center gap-2.5">
        <Image src="/logo.png" alt="ZenScail" width={30} height={27} priority />
        <span className="font-serif text-xl tracking-tight text-(--ink)">ZenScail</span>
      </div>

      {greeting && (
        <p className="mt-6 text-center text-sm font-semibold uppercase tracking-widest text-(--accent)">
          {greeting}
        </p>
      )}

      {/* Stepper */}
      <ol className="mt-5 flex items-center justify-center gap-2.5">
        {steps.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li key={step.id} className="flex items-center gap-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${
                    active
                      ? "bg-(--ink) text-(--bg)"
                      : done
                        ? "bg-(--sage) text-white"
                        : "border border-(--line) bg-(--paper) text-(--muted)"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className={`text-sm font-medium ${
                    active ? "text-(--ink)" : "text-(--muted)"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <span className={`h-px w-6 ${done ? "bg-(--sage)" : "bg-(--line)"}`} />
              )}
            </li>
          );
        })}
      </ol>

      {/* Step body */}
      <div className="mt-10 flex-1">{children}</div>

      <p className="mt-10 text-center text-xs text-(--muted)">
        You can change any of this later in Settings.
      </p>
    </div>
  );
}
