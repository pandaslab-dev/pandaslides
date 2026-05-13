import { SlideCanvas } from "../components/SlideCanvas";
import { useLiveStateConnection } from "../state/liveState";

function LogoScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(212,164,62,0.16),transparent_28%),linear-gradient(180deg,#090c12_0%,#0d131b_100%)] text-center">
      <div>
        <div className="text-[10px] font-bold tracking-[0.32em] text-amber-300/70 uppercase">Logo</div>
        <div className="mt-3 text-6xl font-semibold tracking-tight text-white">
          Panda<span className="text-[color:var(--color-accent-400)]">Slides</span>
        </div>
        <p className="mt-4 text-sm text-[#8d9db0]">Live presentation output ready</p>
      </div>
    </div>
  );
}

export function DisplayPage() {
  const { workspace, snapshot, loading, error } = useLiveStateConnection();

  if (loading && !workspace) {
    return <div className="flex h-screen items-center justify-center bg-black text-[#8d9db0]">Connecting display…</div>;
  }

  if (error && !workspace) {
    return <div className="flex h-screen items-center justify-center bg-black px-6 text-center text-[#6a7a8e]">{error}</div>;
  }

  if (snapshot.mode === "blackout") {
    return <div className="h-screen bg-black" />;
  }

  if (snapshot.mode === "logo") {
    return <LogoScreen />;
  }

  if (!snapshot.project || !snapshot.live) {
    return (
      <div className="flex h-screen items-center justify-center bg-black px-6 text-center text-[11px] font-semibold tracking-[0.22em] text-[#4a5a6e] uppercase">
        Waiting for live output
      </div>
    );
  }

  return (
    <div className="h-screen bg-black p-4">
      <SlideCanvas slide={snapshot.live.slide} className="h-full" />
    </div>
  );
}
