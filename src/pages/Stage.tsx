import { useEffect, useState } from "react";
import { getNextPointer, resolveSlide, useLiveStateConnection } from "../state/liveState";

function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function StageTextCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className="panel flex h-full flex-col p-6">
      <div className="section-label">{title}</div>
      <div className="mt-5 flex-1">
        <div className="space-y-4 text-balance text-2xl font-semibold leading-tight text-white xl:text-4xl">
          {lines.map((line) => (
            <p key={line} className="m-0">
              {line}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StagePage() {
  const { state, loading, error } = useLiveStateConnection();
  const time = useClock();

  if (loading && !state) {
    return <div className="flex min-h-screen items-center justify-center bg-[#030507] text-slate-200">Connecting stage display...</div>;
  }

  if (error || !state) {
    return <div className="flex min-h-screen items-center justify-center bg-[#030507] px-6 text-center text-slate-400">{error ?? "Stage display unavailable."}</div>;
  }

  const currentEntry = resolveSlide(state.service, state.live);
  const nextEntry = resolveSlide(state.service, getNextPointer(state.service, state.live));

  return (
    <div className="min-h-screen bg-[#030507] px-5 py-5 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-[1800px] gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px]">
        <StageTextCard title="Current Slide" lines={currentEntry.slide.lines} />
        <StageTextCard title="Next Slide" lines={nextEntry.slide.lines} />

        <aside className="panel flex flex-col justify-between p-6">
          <div>
            <div className="section-label">Now</div>
            <div className="mt-4 text-6xl font-semibold tracking-tight text-[color:var(--color-accent-400)]">{time}</div>
          </div>

          <div className="space-y-4 text-sm text-slate-200">
            <div className="rounded-xl border border-white/6 bg-white/4 p-4">
              <div className="section-label">Current Item</div>
              <p className="mt-2 text-lg font-semibold text-white">{currentEntry.item.title}</p>
              <p className="mt-1 text-sm text-slate-400">{currentEntry.slide.label}</p>
            </div>
            <div className="rounded-xl border border-white/6 bg-white/4 p-4">
              <div className="section-label">Next Item</div>
              <p className="mt-2 text-lg font-semibold text-white">{nextEntry.item.title}</p>
              <p className="mt-1 text-sm text-slate-400">{nextEntry.slide.label}</p>
            </div>
            <div className="rounded-xl border border-white/6 bg-white/4 p-4">
              <div className="section-label">Output Mode</div>
              <p className="mt-2 text-lg font-semibold text-white">
                {state.blackout ? "Blackout" : state.logo ? "Logo" : "Slides Live"}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
