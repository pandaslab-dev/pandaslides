import { SlideCanvas } from "../components/SlideCanvas";
import { resolveSlide, useLiveStateConnection } from "../state/liveState";

function LogoScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(212,164,62,0.16),transparent_28%),linear-gradient(180deg,#090c12_0%,#0d131b_100%)] text-center">
      <div>
        <div className="text-6xl font-semibold tracking-tight text-white">
          Panda<span className="text-[color:var(--color-accent-400)]">Slides</span>
        </div>
        <p className="mt-4 text-lg text-slate-300">Live presentation output ready</p>
      </div>
    </div>
  );
}

export function DisplayPage() {
  const { state, loading, error } = useLiveStateConnection();

  if (loading && !state) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-slate-300">Connecting display...</div>;
  }

  if (error || !state) {
    return <div className="flex min-h-screen items-center justify-center bg-black px-6 text-center text-slate-400">{error ?? "Display unavailable."}</div>;
  }

  if (state.blackout) {
    return <div className="min-h-screen bg-black" />;
  }

  if (state.logo) {
    return <LogoScreen />;
  }

  const liveEntry = resolveSlide(state.service, state.live);

  return (
    <div className="min-h-screen bg-black p-6 sm:p-8">
      <SlideCanvas slide={liveEntry.slide} className="min-h-[calc(100vh-3rem)]" />
    </div>
  );
}
