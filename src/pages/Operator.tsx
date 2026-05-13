import { useEffect, useMemo } from "react";
import { SlideCanvas } from "../components/SlideCanvas";
import { flattenSlides, getNextPointer, getSocket, resolveSlide, useLiveStateConnection } from "../state/liveState";

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
      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${
        active
          ? "border-amber-400/80 bg-amber-400/16 text-amber-100"
          : "border-white/8 bg-white/4 text-slate-100 hover:border-white/16 hover:bg-white/8"
      }`}
    >
      <span>{label}</span>
      <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[11px] tracking-[0.12em] text-slate-300 uppercase">
        {shortcut}
      </span>
    </button>
  );
}

export function OperatorPage() {
  const { state, loading, error } = useLiveStateConnection();
  const socket = getSocket();

  const liveEntry = useMemo(() => (state ? resolveSlide(state.service, state.live) : null), [state]);
  const selectedEntry = useMemo(() => (state ? resolveSlide(state.service, state.selected) : null), [state]);
  const nextEntry = useMemo(() => {
    if (!state) {
      return null;
    }

    return resolveSlide(state.service, getNextPointer(state.service, state.live));
  }, [state]);
  const flatSlides = useMemo(() => (state ? flattenSlides(state.service) : []), [state]);

  useEffect(() => {
    if (!state) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }

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
    return <div className="flex min-h-screen items-center justify-center bg-[color:var(--color-surface-950)] text-slate-200">Connecting to PandaSlides...</div>;
  }

  if (error || !state || !liveEntry || !selectedEntry || !nextEntry) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--color-surface-950)] px-6 text-center text-slate-300">
        {error ?? "Live state is unavailable."}
      </div>
    );
  }

  const liveFlatIndex = flatSlides.findIndex((entry) => entry.slide.id === liveEntry.slide.id);

  return (
    <div className="min-h-screen bg-[color:var(--color-surface-950)] text-[color:var(--color-copy-100)]">
      <div className="border-b border-white/6 bg-black/18">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-6 px-6 py-4">
          <div>
            <div className="text-2xl font-semibold tracking-tight">
              <span className="text-white">Panda</span>
              <span className="text-[color:var(--color-accent-400)]">Slides</span>
            </div>
            <p className="mt-1 text-sm text-[color:var(--color-copy-300)]">{state.service.title} live control</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 text-sm text-emerald-200">
              Live item: {liveEntry.item.title}
            </div>
            <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-sm text-slate-300">
              Slide {liveFlatIndex + 1} of {flatSlides.length}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1800px] gap-5 px-4 py-5 xl:grid-cols-[340px_minmax(0,1fr)_320px]">
        <aside className="panel flex min-h-[calc(100vh-130px)] flex-col overflow-hidden">
          <div className="border-b border-white/6 px-5 py-4">
            <div className="section-label">Service Playlist</div>
            <p className="mt-2 text-sm text-[color:var(--color-copy-300)]">Select any slide, then send it live.</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {state.service.items.map((item, itemIndex) => (
              <div key={item.id} className="rounded-2xl border border-white/6 bg-black/10 p-2">
                <div className="flex items-center justify-between px-2 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                    <p className="text-xs text-[color:var(--color-copy-300)]">{item.subtitle ?? `${item.slides.length} slide${item.slides.length === 1 ? "" : "s"}`}</p>
                  </div>
                  <div className="text-xs text-slate-500">{item.slides.length} slides</div>
                </div>

                <div className="space-y-2">
                  {item.slides.map((slide, slideIndex) => {
                    const isSelected = state.selected.itemIndex === itemIndex && state.selected.slideIndex === slideIndex;
                    const isLive = state.live.itemIndex === itemIndex && state.live.slideIndex === slideIndex;

                    return (
                      <button
                        key={slide.id}
                        type="button"
                        onClick={() => socket.emit("operator:action", { type: "select", payload: { itemIndex, slideIndex } })}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                          isSelected
                            ? "border-amber-400/70 bg-amber-400/10"
                            : "border-white/5 bg-white/3 hover:border-white/12 hover:bg-white/6"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-100">{slide.label}</span>
                          {isLive ? (
                            <span className="rounded-full bg-emerald-500/18 px-2 py-1 text-[10px] font-semibold tracking-[0.16em] text-emerald-200 uppercase">
                              Live
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[color:var(--color-copy-300)]">{slide.lines.join(" / ")}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.75fr)]">
            <section className="panel overflow-hidden p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="section-label">Current Slide</div>
                  <h2 className="mt-2 text-lg font-semibold text-white">{liveEntry.item.title}</h2>
                </div>
                <span className="rounded-full bg-emerald-500/14 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-emerald-200 uppercase">
                  Live
                </span>
              </div>
              <SlideCanvas slide={liveEntry.slide} />
            </section>

            <section className="panel overflow-hidden p-4">
              <div className="mb-4">
                <div className="section-label">Next Slide</div>
                <h2 className="mt-2 text-lg font-semibold text-white">{nextEntry.slide.label}</h2>
              </div>
              <SlideCanvas slide={nextEntry.slide} compact />
            </section>
          </div>

          <section className="panel p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="section-label">Selected For Go Live</div>
                <p className="mt-2 text-lg font-semibold text-white">
                  {selectedEntry.item.title} / {selectedEntry.slide.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => socket.emit("operator:action", { type: "goLive" })}
                className="rounded-xl border border-amber-300/50 bg-[color:var(--color-accent-500)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[color:var(--color-accent-400)]"
              >
                Go Live
              </button>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
              <SlideCanvas slide={selectedEntry.slide} compact />

              <div className="grid gap-3">
                <ControlButton label="Previous" shortcut="Left" onClick={() => socket.emit("operator:action", { type: "previous" })} />
                <ControlButton label="Next" shortcut="Right" onClick={() => socket.emit("operator:action", { type: "next" })} />
                <ControlButton label="Blackout" shortcut="B" active={state.blackout} onClick={() => socket.emit("operator:action", { type: "toggleBlackout" })} />
                <ControlButton label="Logo" shortcut="L" active={state.logo} onClick={() => socket.emit("operator:action", { type: "toggleLogo" })} />
              </div>
            </div>
          </section>
        </main>

        <aside className="space-y-5">
          <section className="panel p-5">
            <div className="section-label">Live Outputs</div>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-white/6 bg-black/10 p-4">
                <p className="text-sm font-semibold text-white">Audience Display</p>
                <p className="mt-1 text-sm text-[color:var(--color-copy-300)]">Open `/display` on the output screen.</p>
              </div>
              <div className="rounded-xl border border-white/6 bg-black/10 p-4">
                <p className="text-sm font-semibold text-white">Stage Display</p>
                <p className="mt-1 text-sm text-[color:var(--color-copy-300)]">Open `/stage` on a confidence monitor.</p>
              </div>
            </div>
          </section>

          <section className="panel p-5">
            <div className="section-label">Shortcuts</div>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              <div className="flex items-center justify-between rounded-xl border border-white/6 bg-black/10 px-3 py-3">
                <span>Next slide</span>
                <span className="text-[color:var(--color-copy-300)]">Right Arrow</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/6 bg-black/10 px-3 py-3">
                <span>Previous slide</span>
                <span className="text-[color:var(--color-copy-300)]">Left Arrow</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/6 bg-black/10 px-3 py-3">
                <span>Blackout</span>
                <span className="text-[color:var(--color-copy-300)]">B</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/6 bg-black/10 px-3 py-3">
                <span>Logo</span>
                <span className="text-[color:var(--color-copy-300)]">L</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
