import { useEffect, useMemo } from "react";
import { SlideCanvas } from "../components/SlideCanvas";
import { flattenSlides, getNextPointer, getSocket, resolveSlide, useLiveStateConnection } from "../state/liveState";
import type { ServiceItem } from "../data/demoService";

const TYPE_ABBREV: Record<ServiceItem["type"], string> = {
  intro: "INT",
  song: "SNG",
  scripture: "SCR",
  sermon: "MSG",
  announcements: "ANN",
  closing: "END",
};

const TYPE_COLOR: Record<ServiceItem["type"], string> = {
  intro: "text-slate-400",
  song: "text-purple-400",
  scripture: "text-sky-400",
  sermon: "text-amber-400",
  announcements: "text-teal-400",
  closing: "text-slate-400",
};

const SHORTCUTS = [
  { label: "Next slide", key: "→" },
  { label: "Prev slide", key: "←" },
  { label: "Blackout", key: "B" },
  { label: "Logo", key: "L" },
] as const;

function ControlButton({
  label,
  shortcut,
  active = false,
  onClick,
}: {
  label: string;
  shortcut: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between rounded border px-2.5 py-2 text-xs font-semibold uppercase tracking-wide transition ${
        active
          ? "border-amber-400/50 bg-amber-400/14 text-amber-200"
          : "border-white/8 bg-white/4 text-slate-300 hover:border-white/16 hover:bg-white/8 hover:text-white"
      }`}
    >
      <span>{label}</span>
      <kbd className="ml-2 rounded border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] normal-case tracking-normal text-slate-500">
        {shortcut}
      </kbd>
    </button>
  );
}

export function OperatorPage() {
  const { state, loading, error } = useLiveStateConnection();
  const socket = getSocket();

  const liveEntry = useMemo(() => (state ? resolveSlide(state.service, state.live) : null), [state]);
  const selectedEntry = useMemo(() => (state ? resolveSlide(state.service, state.selected) : null), [state]);
  const nextEntry = useMemo(() => {
    if (!state) return null;
    return resolveSlide(state.service, getNextPointer(state.service, state.live));
  }, [state]);
  const flatSlides = useMemo(() => (state ? flattenSlides(state.service) : []), [state]);

  useEffect(() => {
    if (!state) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      const key = event.key.toLowerCase();

      if (event.key === "ArrowRight") {
        event.preventDefault();
        socket.emit("operator:action", { type: "next" });
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        socket.emit("operator:action", { type: "previous" });
      } else if (key === "b") {
        event.preventDefault();
        socket.emit("operator:action", { type: "toggleBlackout" });
      } else if (key === "l") {
        event.preventDefault();
        socket.emit("operator:action", { type: "toggleLogo" });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [socket, state]);

  if (loading && !state) {
    return (
      <div className="flex h-screen items-center justify-center bg-[color:var(--color-surface-950)] text-sm text-slate-500">
        Connecting to PandaSlides…
      </div>
    );
  }

  if (error || !state || !liveEntry || !selectedEntry || !nextEntry) {
    return (
      <div className="flex h-screen items-center justify-center bg-[color:var(--color-surface-950)] px-6 text-center text-sm text-slate-400">
        {error ?? "Live state is unavailable."}
      </div>
    );
  }

  const liveFlatIndex = flatSlides.findIndex((e) => e.slide.id === liveEntry.slide.id);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[color:var(--color-surface-950)] text-[color:var(--color-copy-100)]">

      {/* ── App Bar ───────────────────────────────────────────────── */}
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-[color:var(--color-border-700)] bg-[color:var(--color-surface-900)] px-4">
        <span className="text-sm font-semibold tracking-tight">
          Panda<span className="text-[color:var(--color-accent-400)]">Slides</span>
        </span>

        <div className="h-4 w-px bg-[color:var(--color-border-700)]" />

        <span className="truncate text-xs text-[color:var(--color-copy-300)]">
          {state.service.title}
        </span>

        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Live
            </span>
          </div>

          <div className="h-4 w-px bg-[color:var(--color-border-700)]" />

          <span className="font-mono text-[11px] text-[color:var(--color-copy-300)]">
            {liveFlatIndex + 1}
            <span className="mx-1 text-slate-600">/</span>
            {flatSlides.length}
          </span>
        </div>
      </header>

      {/* ── Workspace ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Rundown ──────────────────────────────────────── */}
        <aside className="flex w-64 shrink-0 flex-col overflow-hidden border-r border-[color:var(--color-border-700)]">
          <div className="flex h-8 shrink-0 items-center border-b border-[color:var(--color-border-700)] px-3">
            <span className="section-label">Rundown</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {state.service.items.map((item, itemIndex) => (
              <div key={item.id}>
                {/* Item group header */}
                <div className="flex items-center gap-2 border-b border-[color:var(--color-border-700)] bg-[color:var(--color-surface-900)] px-3 py-1.5">
                  <span className={`shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.2em] ${TYPE_COLOR[item.type]}`}>
                    {TYPE_ABBREV[item.type]}
                  </span>
                  <span className="truncate text-[11px] font-semibold text-slate-200">
                    {item.title}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-500">
                    {item.slides.length}
                  </span>
                </div>

                {/* Slide rows */}
                {item.slides.map((slide, slideIndex) => {
                  const isSelected =
                    state.selected.itemIndex === itemIndex &&
                    state.selected.slideIndex === slideIndex;
                  const isLive =
                    state.live.itemIndex === itemIndex &&
                    state.live.slideIndex === slideIndex;

                  return (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() =>
                        socket.emit("operator:action", {
                          type: "select",
                          payload: { itemIndex, slideIndex },
                        })
                      }
                      className={`w-full border-b border-l-2 border-white/5 px-3 py-2 text-left transition ${
                        isLive
                          ? "border-l-emerald-500 bg-emerald-500/8"
                          : isSelected
                          ? "border-l-amber-400 bg-amber-400/8"
                          : "border-l-transparent hover:bg-white/4"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-[11px] font-medium text-slate-200">
                          {slide.label}
                        </span>
                        {isLive && (
                          <span className="shrink-0 rounded-sm bg-emerald-500/20 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                            LIVE
                          </span>
                        )}
                        {isSelected && !isLive && (
                          <span className="shrink-0 rounded-sm bg-amber-400/16 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-amber-300">
                            SEL
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[10px] leading-4 text-slate-500">
                        {slide.lines[0]}
                      </p>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        {/* ── Center: Previews ───────────────────────────────────── */}
        <main className="flex flex-1 flex-col overflow-hidden">

          {/* Top row: Live + Next */}
          <div className="flex flex-1 overflow-hidden border-b border-[color:var(--color-border-700)]">

            {/* Live preview — dominant */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-[color:var(--color-border-700)] p-3">
              <div className="mb-2 flex shrink-0 items-center gap-2">
                <div className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Live
                </div>
                <span className="truncate text-[11px] text-slate-400">
                  {liveEntry.item.title}
                  <span className="mx-1.5 text-slate-600">/</span>
                  {liveEntry.slide.label}
                </span>
                {state.blackout && (
                  <span className="ml-auto shrink-0 rounded border border-white/8 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">
                    BLACKOUT
                  </span>
                )}
                {state.logo && !state.blackout && (
                  <span className="ml-auto shrink-0 rounded border border-white/8 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">
                    LOGO
                  </span>
                )}
              </div>
              <SlideCanvas slide={liveEntry.slide} className="flex-1" />
            </div>

            {/* Next preview — secondary */}
            <div className="flex w-56 shrink-0 flex-col overflow-hidden p-3">
              <div className="mb-2 flex shrink-0 items-center gap-2">
                <span className="section-label">Next</span>
                <span className="truncate text-[10px] text-slate-500">
                  {nextEntry.slide.label}
                </span>
              </div>
              <SlideCanvas slide={nextEntry.slide} compact className="flex-1" />
            </div>
          </div>

          {/* Bottom row: Selected + Transport */}
          <div className="flex h-[220px] shrink-0 overflow-hidden">

            {/* Selected slide preview */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-[color:var(--color-border-700)] p-3">
              <div className="mb-2 flex shrink-0 items-center gap-2">
                <span className="section-label">Selected</span>
                <span className="truncate text-[10px] text-amber-300/70">
                  {selectedEntry.item.title}
                  <span className="mx-1 text-slate-600">/</span>
                  {selectedEntry.slide.label}
                </span>
              </div>
              <SlideCanvas slide={selectedEntry.slide} compact className="flex-1" />
            </div>

            {/* Transport controls */}
            <div className="flex w-56 shrink-0 flex-col gap-2 p-3">
              <div className="grid grid-cols-2 gap-1.5">
                <ControlButton
                  label="Prev"
                  shortcut="←"
                  onClick={() => socket.emit("operator:action", { type: "previous" })}
                />
                <ControlButton
                  label="Next"
                  shortcut="→"
                  onClick={() => socket.emit("operator:action", { type: "next" })}
                />
                <ControlButton
                  label="Blackout"
                  shortcut="B"
                  active={state.blackout}
                  onClick={() => socket.emit("operator:action", { type: "toggleBlackout" })}
                />
                <ControlButton
                  label="Logo"
                  shortcut="L"
                  active={state.logo}
                  onClick={() => socket.emit("operator:action", { type: "toggleLogo" })}
                />
              </div>

              <button
                type="button"
                onClick={() => socket.emit("operator:action", { type: "goLive" })}
                className="flex flex-1 items-center justify-center gap-2 rounded border border-amber-400/30 bg-amber-500/16 font-mono text-xs font-bold uppercase tracking-[0.22em] text-amber-300 transition hover:border-amber-400/50 hover:bg-amber-500/24 hover:text-amber-200 active:scale-[0.99]"
              >
                <span className="text-sm leading-none">↑</span>
                Go Live
              </button>
            </div>
          </div>
        </main>

        {/* ── Right: System ──────────────────────────────────────── */}
        <aside className="flex w-48 shrink-0 flex-col overflow-hidden border-l border-[color:var(--color-border-700)]">
          <div className="flex h-8 shrink-0 items-center border-b border-[color:var(--color-border-700)] px-3">
            <span className="section-label">System</span>
          </div>

          {/* Outputs */}
          <div className="border-b border-[color:var(--color-border-700)] px-3 py-3">
            <p className="mb-2.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Outputs
            </p>
            <div className="space-y-2.5">
              <div>
                <p className="text-[11px] font-semibold text-slate-200">Audience Display</p>
                <p className="mt-0.5 font-mono text-[10px] text-slate-500">/display</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-200">Stage Display</p>
                <p className="mt-0.5 font-mono text-[10px] text-slate-500">/stage</p>
              </div>
            </div>
          </div>

          {/* Shortcuts */}
          <div className="px-3 py-3">
            <p className="mb-2.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Shortcuts
            </p>
            <div className="space-y-2">
              {SHORTCUTS.map(({ label, key }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">{label}</span>
                  <kbd className="rounded border border-white/8 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}
