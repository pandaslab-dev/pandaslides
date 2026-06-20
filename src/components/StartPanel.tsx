import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { formatUpdatedAt, type RecentProjectRecord } from "../utils/projectStorage";

type StartPanelProps = {
  open: boolean;
  recentProjects: RecentProjectRecord[];
  hideOnStartup: boolean;
  onClose: () => void;
  onToggleHideOnStartup: (hidden: boolean) => void;
  onOpenProjectFile: () => void;
  onLoadDemo: () => void;
  onCreateBlank: () => void;
  onCreateSundayService: () => void;
  onCreateEventDeck: () => void;
  onCreateSongSet: () => void;
  onOpenRecentProject: (project: RecentProjectRecord) => void;
  onLearnAction: (topic: string) => void;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionRow({
  label,
  description,
  onClick,
  accent = false,
}: {
  label: string;
  description: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 border-b border-[#1a2230] px-3 py-2 text-left transition-colors last:border-b-0 ${
        accent
          ? "hover:bg-amber-400/6"
          : "hover:bg-white/4"
      }`}
    >
      <div className={`mt-[3px] h-[6px] w-[6px] flex-none rounded-full ${accent ? "bg-amber-400/60" : "bg-[#2e3d50]"}`} />
      <div>
        <div className={`text-[12px] font-semibold ${accent ? "text-amber-100" : "text-[#c0ccd8]"}`}>{label}</div>
        <div className="mt-[2px] text-[10px] leading-[1.5] text-[#3a4a5e]">{description}</div>
      </div>
    </button>
  );
}

function PanelCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col border-r border-[#1a2230] last:border-r-0">
      <div className="flex h-[28px] items-center border-b border-[#1a2230] bg-[#090d15] px-3">
        <span className="panel-label">{title}</span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ─── Drag helpers ─────────────────────────────────────────────────────────────

function clamp(x: number, y: number, w: number, h: number) {
  const pad = 20;
  return {
    x: Math.min(Math.max(pad, x), Math.max(pad, window.innerWidth - w - pad)),
    y: Math.min(Math.max(pad, y), Math.max(pad, window.innerHeight - h - pad)),
  };
}

// ─── StartPanel ───────────────────────────────────────────────────────────────

export function StartPanel({
  open,
  recentProjects,
  hideOnStartup,
  onClose,
  onToggleHideOnStartup,
  onOpenProjectFile,
  onLoadDemo,
  onCreateBlank,
  onCreateSundayService,
  onCreateEventDeck,
  onCreateSongSet,
  onOpenRecentProject,
  onLearnAction,
}: StartPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const recentRows = useMemo(() => recentProjects.slice(0, 6), [recentProjects]);

  // Center on open
  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const { offsetWidth, offsetHeight } = panelRef.current;
    setPosition(
      clamp(
        Math.round((window.innerWidth - offsetWidth) / 2),
        Math.round((window.innerHeight - offsetHeight) / 2),
        offsetWidth,
        offsetHeight,
      ),
    );
  }, [open, isMinimized]);

  // Drag handling
  useEffect(() => {
    if (!open || !isDragging) return;

    function onMove(e: PointerEvent) {
      if (!panelRef.current) return;
      setPosition(
        clamp(
          e.clientX - dragOffsetRef.current.x,
          e.clientY - dragOffsetRef.current.y,
          panelRef.current.offsetWidth,
          panelRef.current.offsetHeight,
        ),
      );
    }

    function onUp() {
      setIsDragging(false);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isDragging, open]);

  // Constrain on resize
  useEffect(() => {
    if (!open) return;

    function onResize() {
      if (!panelRef.current) return;
      setPosition((p) => clamp(p.x, p.y, panelRef.current!.offsetWidth, panelRef.current!.offsetHeight));
    }

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 bg-black/30">
      <div
        ref={panelRef}
        className="absolute w-[min(860px,calc(100vw-32px))] overflow-hidden border border-[#2a3547] bg-[#0d1320] shadow-[0_24px_64px_rgba(0,0,0,0.65)]"
        style={{ left: position.x, top: position.y }}
      >
        {/* ── BANNER / DRAG HANDLE ──────────────────────────────────────── */}
        <div
          className="start-panel-banner cursor-grab border-b border-[#1e2a38] px-4 py-3 active:cursor-grabbing"
          onPointerDown={(e) => {
            const t = e.target as HTMLElement;
            if (t.closest("button") || t.closest("input") || t.closest("label")) return;
            if (!panelRef.current) return;
            const rect = panelRef.current.getBoundingClientRect();
            dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            setIsDragging(true);
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[9px] font-bold tracking-[0.3em] text-amber-300/70 uppercase">Welcome</div>
              <h1 className="mt-1 text-[24px] font-semibold leading-none tracking-tight text-white">
                Panda<span className="text-amber-400">Slides</span>
              </h1>
              <p className="mt-1.5 text-[11px] text-[#7a8a9a]">
                Live presentation control for churches, events, and performers.
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsMinimized((m) => !m)}
                className="flex h-5 w-5 items-center justify-center border border-white/8 bg-black/20 text-[11px] text-[#6a7a8e] transition-colors hover:border-white/16 hover:text-white"
                aria-label={isMinimized ? "Expand" : "Minimize"}
              >
                {isMinimized ? "+" : "–"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-5 w-5 items-center justify-center border border-white/8 bg-black/20 text-[13px] text-[#6a7a8e] transition-colors hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-300"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        {/* ── BODY ──────────────────────────────────────────────────────── */}
        {!isMinimized ? (
          <>
            <div className="grid bg-[#0a0e18] md:grid-cols-3">
              {/* OPEN */}
              <PanelCol title="Open">
                <ActionRow
                  label="Open Project File"
                  description="Load a .pandaslides file from disk."
                  onClick={onOpenProjectFile}
                  accent
                />
                <ActionRow
                  label="Load Demo Service"
                  description="Open the built-in Sunday Service demo."
                  onClick={onLoadDemo}
                />

                {/* Recent projects */}
                <div className="border-t border-[#1a2230]">
                  <div className="flex h-[26px] items-center border-b border-[#1a2230] bg-[#090d15] px-3">
                    <span className="panel-label">Recent</span>
                  </div>
                  <div>
                    {recentRows.length > 0 ? (
                      recentRows.map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => onOpenRecentProject(project)}
                          className="flex w-full items-center gap-2 border-b border-[#1a2230] px-3 py-[6px] text-left transition-colors last:border-b-0 hover:bg-white/4"
                        >
                          <span className="min-w-[28px] border border-white/7 bg-black/20 px-[4px] py-[1px] text-center text-[8px] font-bold tracking-wider text-[#3a4a5e] uppercase">
                            {project.typeLabel.slice(0, 3)}
                          </span>
                          <span className="flex-1 truncate text-[11px] text-[#8d9db0]">{project.name}</span>
                          <span className="flex-none text-[10px] text-[#2e3d50]">
                            {formatUpdatedAt(project.updatedAt)}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-[11px] text-[#2e3d50]">No recent projects.</div>
                    )}
                  </div>
                </div>
              </PanelCol>

              {/* CREATE */}
              <PanelCol title="Create New">
                <ActionRow
                  label="Blank Presentation"
                  description="Start from an empty project."
                  onClick={onCreateBlank}
                  accent
                />
                <ActionRow
                  label="Sunday Service"
                  description="Church-ready rundown with worship and sermon."
                  onClick={onCreateSundayService}
                />
                <ActionRow
                  label="Event Deck"
                  description="Simple live event presentation deck."
                  onClick={onCreateEventDeck}
                />
                <ActionRow
                  label="Song Set"
                  description="Quick worship or setlist project."
                  onClick={onCreateSongSet}
                />
              </PanelCol>

              {/* LEARN */}
              <PanelCol title="Learn / Setup">
                <ActionRow
                  label="Operator View"
                  description="How the control workspace is organized."
                  onClick={() => onLearnAction("Operator View guide coming soon.")}
                />
                <ActionRow
                  label="Audience Display"
                  description="Route the public output to /display."
                  onClick={() => onLearnAction("Open /display on the audience screen to show slides live.")}
                />
                <ActionRow
                  label="Stage Display"
                  description="Confidence monitor at /stage."
                  onClick={() => onLearnAction("Open /stage on the confidence monitor. It shows current, next, and the clock.")}
                />
                <ActionRow
                  label="Keyboard Shortcuts"
                  description="Hotkeys for live operation."
                  onClick={() =>
                    onLearnAction("Shortcuts: → next live · ← previous live · ↓ queue next · ↑ queue previous · Space or Enter go live · B blackout · L logo.")
                  }
                />

                {/* Keyboard shortcut quick reference */}
                <div className="border-t border-[#1a2230]">
                  <div className="flex h-[26px] items-center border-b border-[#1a2230] bg-[#090d15] px-3">
                    <span className="panel-label">Keys</span>
                  </div>
                  {(
                    [
                      ["Next", "→"],
                      ["Prev", "←"],
                      ["Queue Next", "↓"],
                      ["Queue Prev", "↑"],
                      ["Go Live", "Space / Enter"],
                      ["Blackout", "B"],
                      ["Logo", "L"],
                    ] as [string, string][]
                  ).map(([action, key]) => (
                    <div
                      key={action}
                      className="flex items-center justify-between border-b border-[#1a2230] px-3 py-[5px] last:border-b-0"
                    >
                      <span className="text-[10px] text-[#4a5a6e]">{action}</span>
                      <span className="border border-white/7 bg-black/20 px-[5px] py-[1px] font-mono text-[9px] text-[#2e3d50]">
                        {key}
                      </span>
                    </div>
                  ))}
                </div>
              </PanelCol>
            </div>

            {/* ── FOOTER ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between border-t border-[#1a2230] bg-[#090d15] px-4 py-2">
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[#4a5a6e]">
                <input
                  type="checkbox"
                  checked={hideOnStartup}
                  onChange={(e) => onToggleHideOnStartup(e.target.checked)}
                  className="h-3 w-3 rounded-none border border-white/15 bg-black/20 accent-amber-400"
                />
                Don't show on startup
              </label>
              <span className="text-[10px] text-[#2e3d50]">PandaSlides · workspace launcher</span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
