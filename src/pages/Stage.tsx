import { useEffect, useState } from "react";
import { useLiveStateConnection } from "../state/liveState";

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

function StagePanelHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex h-[30px] items-center justify-between border-b border-[#1e2835] bg-[#090d15] px-3">
      <span className="panel-label">{title}</span>
      {meta ? <span className="text-[10px] text-[#3a4a5e]">{meta}</span> : null}
    </div>
  );
}

function StageTextPanel({
  title,
  body,
  meta,
  emptyLabel,
}: {
  title: string;
  body: string;
  meta?: string;
  emptyLabel: string;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col border border-[#1e2835] bg-[#0d1119]">
      <StagePanelHeader title={title} meta={meta} />
      <div className="flex flex-1 items-center justify-center px-6 py-5">
        {body.trim().length > 0 ? (
          <div className="slide-text max-w-[19ch] whitespace-pre-wrap text-center text-4xl leading-[1.08] text-white xl:text-6xl">
            {body}
          </div>
        ) : (
          <div className="text-[11px] font-semibold tracking-[0.22em] text-[#4a5a5e] uppercase">{emptyLabel}</div>
        )}
      </div>
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[#161e2a] px-3 py-2 last:border-b-0">
      <div className="text-[10px] font-semibold tracking-[0.18em] text-[#5a6a7e] uppercase">{label}</div>
      <div className="mt-1 text-[12px] text-[#d5dde6]">{value}</div>
    </div>
  );
}

export function StagePage() {
  const { workspace, snapshot, loading, error } = useLiveStateConnection();
  const time = useClock();

  if (loading && !workspace) {
    return <div className="flex h-screen items-center justify-center bg-[#030507] text-[#8d9db0]">Connecting stage display…</div>;
  }

  if (error && !workspace) {
    return <div className="flex h-screen items-center justify-center bg-[#030507] px-6 text-center text-[#6a7a8e]">{error}</div>;
  }

  if (!snapshot.project || !snapshot.live) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#030507] px-6 text-center text-[11px] font-semibold tracking-[0.22em] text-[#4a5a6e] uppercase">
        Waiting for live output
      </div>
    );
  }

  const modeLabel = snapshot.mode === "blackout" ? "Blackout" : snapshot.mode === "logo" ? "Logo" : "Slides Live";
  const currentBody = snapshot.mode === "live" ? snapshot.live.slide.body : `${modeLabel}\nOutput active`;
  const nextBody = snapshot.mode === "live" ? snapshot.next?.slide.body ?? "" : `${modeLabel}\nPreview held`;

  return (
    <div className="h-screen bg-[#030507] px-4 py-4 text-white">
      <div className="mx-auto grid h-full max-w-[1800px] gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px]">
        <StageTextPanel
          title="Current Slide"
          meta={snapshot.live.slide.title}
          body={currentBody}
          emptyLabel="No current slide text"
        />
        <StageTextPanel
          title="Next Slide"
          meta={snapshot.next?.slide.title ?? "End"}
          body={nextBody}
          emptyLabel="No next slide"
        />

        <aside className="flex min-h-0 flex-col border border-[#1e2835] bg-[#0d1119]">
          <StagePanelHeader title="Stage" meta={snapshot.slidePosition ? `${snapshot.slidePosition.current} / ${snapshot.slidePosition.total}` : undefined} />

          <div className="border-b border-[#161e2a] px-3 py-3">
            <div className="text-[10px] font-semibold tracking-[0.18em] text-[#5a6a7e] uppercase">Clock</div>
            <div className="mt-2 text-5xl font-semibold tracking-tight text-[color:var(--color-accent-400)]">{time}</div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <MetaRow label="Current Item" value={snapshot.live.item.title} />
            <MetaRow label="Current Slide" value={snapshot.live.slide.title} />
            <MetaRow label="Next Item" value={snapshot.next?.item.title ?? "No next item"} />
            <MetaRow label="Next Slide" value={snapshot.next?.slide.title ?? "No next slide"} />
            <MetaRow label="Output Mode" value={modeLabel} />
          </div>
        </aside>
      </div>
    </div>
  );
}
