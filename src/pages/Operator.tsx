import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { SlideCanvas } from "../components/SlideCanvas";
import { StartPanel } from "../components/StartPanel";
import {
  createBlankProject,
  createDemoProject,
  createEventDeckTemplate,
  createSongSetTemplate,
  createSundayServiceTemplate,
} from "../data/projectTemplates";
import {
  flattenSlides,
  getFirstPointer,
  getNextPointer,
  getPreviousPointer,
  isValidPointer,
  resolveSlide,
  saveLocalWorkspaceState,
  type SlidePointer,
} from "../state/liveState";
import type { PandaSlidesProject } from "../types/project";
import {
  formatUpdatedAt,
  getProjectDownloadName,
  getProjectKindLabel,
  loadRecentProjects,
  normalizeProject,
  parseProjectFileContents,
  prepareProjectForDownload,
  readHideStartPanelPreference,
  saveRecentProject,
  writeHideStartPanelPreference,
  type RecentProjectRecord,
} from "../utils/projectStorage";

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkspaceState = {
  project: PandaSlidesProject | null;
  selected: SlidePointer | null;
  live: SlidePointer | null;
  blackout: boolean;
  logo: boolean;
};

type FileMenuCommand = "new" | "open" | "save" | "export" | "demo" | "start";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTypeCode(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("welcome") || t.includes("opening")) return "WLC";
  if (t.includes("worship") || t.includes("song") || t.includes("hymn") || t.includes("setlist")) return "SNG";
  if (t.includes("scripture") || t.includes("reading") || t.includes("bible") || t.includes("passage")) return "SCR";
  if (t.includes("sermon") || t.includes("message") || t.includes("teaching") || t.includes("talk")) return "SRM";
  if (t.includes("announcement") || t.includes("notice")) return "ANN";
  if (t.includes("closing") || t.includes("benediction") || t.includes("dismiss") || t.includes("send-off")) return "CLG";
  if (t.includes("prayer") || t.includes("invocation")) return "PRA";
  if (t.includes("offering") || t.includes("tithe")) return "OFF";
  return title.slice(0, 3).toUpperCase();
}

function downloadProject(project: PandaSlidesProject) {
  const anchor = document.createElement("a");
  const blob = new Blob([prepareProjectForDownload(project)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  anchor.href = url;
  anchor.download = getProjectDownloadName(project);
  anchor.click();
  URL.revokeObjectURL(url);
}

function createEmptyWorkspace(): WorkspaceState {
  return { project: null, selected: null, live: null, blackout: false, logo: false };
}

function createWorkspaceFromProject(project: PandaSlidesProject): WorkspaceState {
  const firstPointer = getFirstPointer(project);
  return { project, selected: firstPointer, live: firstPointer, blackout: false, logo: false };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ControlBtn({
  label,
  shortcut,
  active = false,
  disabled = false,
  danger = false,
  onClick,
}: {
  label: string;
  shortcut: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center justify-between px-3 py-[7px] text-[12px] font-semibold transition-colors ${
        disabled
          ? "cursor-not-allowed text-[#2e3d50]"
          : active && danger
            ? "bg-red-900/20 text-red-300 hover:bg-red-900/30"
            : active
              ? "bg-amber-400/10 text-amber-200 hover:bg-amber-400/14"
              : "text-[#8d9db0] hover:bg-white/4 hover:text-[#c8d4e0]"
      }`}
    >
      <span>{label}</span>
      <span
        className={`border px-[5px] py-[2px] font-mono text-[9px] tracking-wider ${
          disabled
            ? "border-white/4 text-[#2e3d50]"
            : active
              ? "border-amber-400/25 text-amber-300/70"
              : "border-white/8 text-[#4a5a6e]"
        }`}
      >
        {shortcut}
      </span>
    </button>
  );
}

function OutputRow({ route, ready }: { route: string; ready: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <div className={`h-[6px] w-[6px] rounded-full flex-none ${ready ? "status-dot-live" : "status-dot-idle"}`} />
      <span className="flex-1 text-[11px] text-[#6a7a8e] font-mono">{route}</span>
      <span
        className={`text-[9px] font-bold tracking-[0.18em] uppercase ${ready ? "text-emerald-400/75" : "text-[#2e3d50]"}`}
      >
        {ready ? "Ready" : "Idle"}
      </span>
    </div>
  );
}

function EmptyMonitor({ label, action, onAction }: { label: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center border border-dashed border-white/6">
      <span className="panel-label">{label}</span>
      {action && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-2.5 text-[11px] text-amber-400/60 transition-colors hover:text-amber-300"
        >
          {action}
        </button>
      ) : null}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OperatorPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileMenuRef = useRef<HTMLDivElement | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => createEmptyWorkspace());
  const [recentProjects, setRecentProjects] = useState<RecentProjectRecord[]>(() => loadRecentProjects());
  const [startPanelOpen, setStartPanelOpen] = useState(() => !readHideStartPanelPreference());
  const [hideStartPanelOnStartup, setHideStartPanelOnStartup] = useState(() => readHideStartPanelPreference());
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const project = workspace.project;
  const flatSlides = useMemo(() => (project ? flattenSlides(project) : []), [project]);
  const hasSlides = flatSlides.length > 0;

  const liveEntry = useMemo(() => {
    const p = workspace.live;
    if (!project || !p || !isValidPointer(project, p)) return null;
    return resolveSlide(project, p);
  }, [project, workspace.live]);

  const selectedEntry = useMemo(() => {
    const p = workspace.selected;
    if (!project || !p || !isValidPointer(project, p)) return null;
    return resolveSlide(project, p);
  }, [project, workspace.selected]);

  const nextEntry = useMemo(() => {
    const p = workspace.live;
    if (!project || !p || !isValidPointer(project, p)) return null;
    return resolveSlide(project, getNextPointer(project, p));
  }, [project, workspace.live]);

  const liveFlatIndex = useMemo(() => {
    if (!liveEntry) return -1;
    return flatSlides.findIndex((e) => e.slide.id === liveEntry.slide.id);
  }, [flatSlides, liveEntry]);

  // Auto-dismiss notice
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(t);
  }, [notice]);

  // Sync live state to display/stage
  useEffect(() => {
    saveLocalWorkspaceState({
      service: workspace.project,
      selected: workspace.selected,
      live: workspace.live,
      blackout: workspace.blackout,
      logo: workspace.logo,
    });
  }, [workspace]);

  // Global keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) return;
      if (!project || !hasSlides || startPanelOpen) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        setWorkspace((cur) => {
          if (!cur.project || !cur.live || !isValidPointer(cur.project, cur.live)) return cur;
          const next = getNextPointer(cur.project, cur.live);
          return { ...cur, live: next, selected: next };
        });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setWorkspace((cur) => {
          if (!cur.project || !cur.live || !isValidPointer(cur.project, cur.live)) return cur;
          const prev = getPreviousPointer(cur.project, cur.live);
          return { ...cur, live: prev, selected: prev };
        });
      } else if (e.key === " ") {
        e.preventDefault();
        setWorkspace((cur) => {
          if (!cur.project || !cur.selected || !isValidPointer(cur.project, cur.selected)) return cur;
          return { ...cur, live: cur.selected };
        });
      } else if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        setWorkspace((cur) => ({ ...cur, blackout: !cur.blackout, logo: !cur.blackout ? false : cur.logo }));
      } else if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        setWorkspace((cur) => ({ ...cur, logo: !cur.logo, blackout: !cur.logo ? false : cur.blackout }));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasSlides, project, startPanelOpen]);

  // Close file menu on outside click
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!fileMenuRef.current || !menuOpen) return;
      if (!fileMenuRef.current.contains(e.target as Node)) setMenuOpen(null);
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function loadProject(projectInput: PandaSlidesProject, successMessage: string) {
    const next = normalizeProject({ ...projectInput, updatedAt: new Date().toISOString() }, projectInput.title);
    setWorkspace(createWorkspaceFromProject(next));
    setRecentProjects(saveRecentProject(next));
    setStartPanelOpen(false);
    setMenuOpen(null);
    setNotice(successMessage);
  }

  function handleOpenProjectFile() {
    fileInputRef.current?.click();
  }

  async function handleProjectFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const contents = await file.text();
      const p = parseProjectFileContents(contents, file.name);
      loadProject(p, `${p.title} loaded.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to open project file.");
      setStartPanelOpen(true);
    } finally {
      e.target.value = "";
    }
  }

  function handleFileMenuAction(action: FileMenuCommand) {
    switch (action) {
      case "new":
        setStartPanelOpen(true);
        break;
      case "open":
        handleOpenProjectFile();
        break;
      case "save":
      case "export":
        if (!project) { setNotice("Load a project first."); break; }
        downloadProject(project);
        setNotice(`${project.title} exported.`);
        break;
      case "demo": {
        const demo = createDemoProject();
        loadProject(demo, `${demo.title} demo loaded.`);
        break;
      }
      case "start":
        setStartPanelOpen(true);
        break;
    }
    setMenuOpen(null);
  }

  function handleSelectSlide(pointer: SlidePointer) {
    if (!project || !isValidPointer(project, pointer)) return;
    setWorkspace((cur) => ({ ...cur, selected: pointer }));
  }

  function handleGoLive(pointer?: SlidePointer) {
    setWorkspace((cur) => {
      if (!cur.project) return cur;
      const next = pointer ?? cur.selected;
      if (!next || !isValidPointer(cur.project, next)) return cur;
      return { ...cur, live: next, selected: next };
    });
  }

  function handleMove(dir: "next" | "previous") {
    setWorkspace((cur) => {
      if (!cur.project || !cur.live || !isValidPointer(cur.project, cur.live)) return cur;
      const next = dir === "next" ? getNextPointer(cur.project, cur.live) : getPreviousPointer(cur.project, cur.live);
      return { ...cur, live: next, selected: next };
    });
  }

  function handleToggleBlackout() {
    if (!project) return;
    setWorkspace((cur) => ({ ...cur, blackout: !cur.blackout, logo: !cur.blackout ? false : cur.logo }));
  }

  function handleToggleLogo() {
    if (!project) return;
    setWorkspace((cur) => ({ ...cur, logo: !cur.logo, blackout: !cur.logo ? false : cur.blackout }));
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const dimWorkspace = startPanelOpen;

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#080b10] text-[#eef1f5]">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pandaslides,.json,application/json"
        className="hidden"
        onChange={handleProjectFileChange}
      />

      {/* ── TOP MENU BAR ─────────────────────────────────────────────────── */}
      <header className="app-menubar flex h-[34px] flex-none items-stretch border-b border-[#1e2835]">

        {/* Logo / brand */}
        <button
          type="button"
          onClick={() => setStartPanelOpen(true)}
          className="flex items-center gap-2 border-r border-[#1e2835] px-3 transition-colors hover:bg-white/4"
        >
          <span className="text-[8px] font-bold tracking-[0.3em] text-amber-300/70 uppercase">PS</span>
          <span className="text-[13px] font-semibold leading-none text-white">
            Panda<span className="text-amber-400">Slides</span>
          </span>
        </button>

        {/* File menu */}
        <nav className="flex items-stretch">
          <div ref={fileMenuRef} className="relative flex items-stretch">
            <button
              type="button"
              onClick={() => setMenuOpen((m) => (m === "file" ? null : "file"))}
              className={`flex items-center px-3 text-[13px] transition-colors ${
                menuOpen === "file" ? "bg-white/6 text-white" : "text-[#8d9db0] hover:bg-white/4 hover:text-white"
              }`}
            >
              File
            </button>
            {menuOpen === "file" ? (
              <div className="absolute left-0 top-full z-40 min-w-[192px] border border-[#253040] bg-[#0d1320] py-1 shadow-[0_12px_36px_rgba(0,0,0,0.55)]">
                {(
                  [
                    ["New Project", "new"],
                    ["Open Project…", "open"],
                    ["Save / Export", "save"],
                    ["Load Demo", "demo"],
                    ["Show Start Panel", "start"],
                  ] as [string, FileMenuCommand][]
                ).map(([label, cmd]) => (
                  <button
                    key={cmd}
                    type="button"
                    onClick={() => handleFileMenuAction(cmd)}
                    className="flex w-full items-center px-4 py-[6px] text-left text-[13px] text-[#c0ccd8] transition-colors hover:bg-white/7 hover:text-white"
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {(["Edit", "View", "Output", "Help"] as const).map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                const msgs: Record<string, string> = {
                  Edit: "Slide editing tools are coming in the next update.",
                  View: "Workspace layout options are coming soon.",
                  Output: "Open /display or /stage to preview outputs.",
                  Help: "Use the Start Panel for templates and keyboard shortcuts.",
                };
                setNotice(msgs[label]);
              }}
              className="flex items-center px-3 text-[13px] text-[#8d9db0] transition-colors hover:bg-white/4 hover:text-white"
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Project status */}
        <div className="flex items-center gap-3 border-l border-[#1e2835] px-3">
          {project ? (
            <>
              <span className="max-w-[200px] truncate text-[12px] text-[#8d9db0]">{project.title}</span>
              <span className="text-[#2e3d50]">·</span>
              <span className="text-[11px] text-[#4a5a6e]">{getProjectKindLabel(project.kind)}</span>
              {liveEntry ? (
                <span className="bg-emerald-500/12 px-[7px] py-[2px] text-[9px] font-bold tracking-[0.22em] text-emerald-300 uppercase">
                  LIVE
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-[12px] text-[#3a4a5e]">No project loaded</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setStartPanelOpen(true)}
          className="flex items-center border-l border-[#1e2835] px-3 text-[12px] font-semibold text-amber-300/80 transition-colors hover:bg-amber-500/8 hover:text-amber-200"
        >
          Start
        </button>
      </header>

      {/* ── MAIN WORKSPACE ───────────────────────────────────────────────── */}
      <div
        className={`flex flex-1 overflow-hidden transition-opacity duration-150 ${dimWorkspace ? "opacity-40 pointer-events-none" : ""}`}
      >

        {/* ── LEFT: RUNDOWN ─────────────────────────────────────────────── */}
        <aside className="flex w-[264px] flex-none flex-col overflow-hidden border-r border-[#1e2835]">
          {/* Panel header */}
          <div className="flex h-[30px] flex-none items-center justify-between border-b border-[#1e2835] bg-[#090d15] px-3">
            <span className="panel-label">Service Rundown</span>
            <div className="flex items-center gap-2.5">
              {hasSlides ? (
                <span className="font-mono text-[10px] text-[#2e3d50]">{flatSlides.length}</span>
              ) : null}
              <button
                type="button"
                onClick={() => setStartPanelOpen(true)}
                className="text-[10px] text-amber-400/50 transition-colors hover:text-amber-300"
              >
                + New
              </button>
            </div>
          </div>

          {/* Cue list */}
          <div className="flex-1 overflow-y-auto">
            {project && project.items.length > 0 ? (
              project.items.map((item, itemIndex) => {
                const typeCode = getTypeCode(item.title);
                const isItemActive = workspace.live?.itemIndex === itemIndex;

                return (
                  <div key={item.id} className="border-b border-[#161e2a]">
                    {/* Item header row */}
                    <div
                      className={`flex items-center gap-2 px-2.5 py-[6px] ${isItemActive ? "bg-emerald-500/5" : "cue-header"} border-b border-[#161e2a]`}
                    >
                      <span className="min-w-[26px] text-center text-[8px] font-bold tracking-wider text-[#3a4d60] uppercase">
                        {typeCode}
                      </span>
                      <span className="flex-1 truncate text-[11px] font-semibold text-[#8d9db0]">{item.title}</span>
                      <span className="font-mono text-[10px] text-[#2e3d50]">{item.slides.length}</span>
                    </div>

                    {/* Slide rows */}
                    {item.slides.map((slide, slideIndex) => {
                      const isSelected =
                        workspace.selected?.itemIndex === itemIndex &&
                        workspace.selected.slideIndex === slideIndex;
                      const isLive =
                        workspace.live?.itemIndex === itemIndex &&
                        workspace.live.slideIndex === slideIndex;

                      return (
                        <button
                          key={slide.id}
                          type="button"
                          onClick={() => handleSelectSlide({ itemIndex, slideIndex })}
                          onDoubleClick={() => handleGoLive({ itemIndex, slideIndex })}
                          className={`flex w-full items-center border-b border-[#0f1620] py-[5px] pl-[46px] pr-2.5 text-left transition-colors ${
                            isSelected
                              ? "border-l-2 border-l-amber-400/60 bg-amber-400/6 pl-[44px]"
                              : "border-l-2 border-l-transparent hover:bg-white/3"
                          }`}
                        >
                          <span
                            className={`flex-1 truncate text-[11px] ${isLive ? "font-semibold text-white" : isSelected ? "text-[#c8d4e0]" : "text-[#5a6a7e]"}`}
                          >
                            {slide.label}
                          </span>
                          {isLive ? (
                            <span className="ml-1.5 flex-none bg-emerald-500/15 px-[5px] py-[1px] text-[8px] font-bold tracking-[0.2em] text-emerald-300 uppercase">
                              LIVE
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-5">
                <p className="text-[11px] text-[#3a4a5e]">
                  {project ? "No slides in this project." : "No project loaded."}
                </p>
                <button
                  type="button"
                  onClick={() => setStartPanelOpen(true)}
                  className="mt-2 text-[11px] text-amber-400/60 transition-colors hover:text-amber-300"
                >
                  {project ? "Start from a template →" : "Open a project →"}
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ── CENTER: PREVIEW WORKSPACE ──────────────────────────────────── */}
        <main className="flex flex-1 flex-col overflow-hidden">

          {/* LIVE / CURRENT SLIDE — dominant */}
          <section className="flex flex-[3] min-h-0 flex-col">
            <div className="flex h-[30px] flex-none items-center justify-between border-b border-[#1e2835] bg-[#090d15] px-3">
              <div className="flex items-center gap-3">
                <span className="panel-label">Current Slide</span>
                {liveEntry ? (
                  <span className="truncate text-[11px] text-[#5a6a7e]">
                    {liveEntry.item.title}&thinsp;·&thinsp;{liveEntry.slide.label}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2.5">
                {hasSlides && liveFlatIndex >= 0 ? (
                  <span className="font-mono text-[10px] text-[#2e3d50]">
                    {liveFlatIndex + 1}&thinsp;/&thinsp;{flatSlides.length}
                  </span>
                ) : null}
                <span
                  className={`px-[7px] py-[2px] text-[9px] font-bold tracking-[0.2em] uppercase ${
                    liveEntry
                      ? "bg-emerald-500/12 text-emerald-300"
                      : "bg-white/4 text-[#2e3d50]"
                  }`}
                >
                  {liveEntry ? "LIVE" : "STANDBY"}
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-0 p-2">
              {liveEntry ? (
                <SlideCanvas slide={liveEntry.slide} className="h-full" />
              ) : (
                <EmptyMonitor
                  label={project ? "No live slide" : "No project loaded"}
                  action={project ? undefined : "Open Start Panel"}
                  onAction={() => setStartPanelOpen(true)}
                />
              )}
            </div>
          </section>

          {/* QUEUED / GO LIVE — secondary */}
          <section className="flex flex-[2] min-h-0 flex-col border-t border-[#1e2835]">
            <div className="flex h-[30px] flex-none items-center justify-between border-b border-[#1e2835] bg-[#090d15] px-3">
              <div className="flex items-center gap-3">
                <span className="panel-label">Queued</span>
                {selectedEntry ? (
                  <span className="max-w-[260px] truncate text-[11px] text-[#5a6a7e]">
                    {selectedEntry.item.title}&thinsp;·&thinsp;{selectedEntry.slide.label}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                disabled={!selectedEntry}
                onClick={() => handleGoLive()}
                className={`flex items-center gap-2 px-3 py-[5px] text-[11px] font-bold tracking-wide uppercase transition-colors ${
                  selectedEntry
                    ? "bg-amber-500 text-black hover:bg-amber-400"
                    : "cursor-not-allowed bg-white/4 text-[#2e3d50]"
                }`}
              >
                Go Live
                <span
                  className={`border px-[5px] py-[2px] text-[8px] tracking-wider ${
                    selectedEntry ? "border-black/20 bg-black/15 text-black/60" : "border-white/5 text-[#2e3d50]"
                  }`}
                >
                  Space
                </span>
              </button>
            </div>

            <div className="flex-1 min-h-0 p-2">
              {selectedEntry ? (
                <SlideCanvas slide={selectedEntry.slide} compact className="h-full" />
              ) : (
                <EmptyMonitor label="Select a slide to queue" />
              )}
            </div>
          </section>
        </main>

        {/* ── RIGHT: SYSTEM PANEL ────────────────────────────────────────── */}
        <aside className="flex w-[248px] flex-none flex-col overflow-hidden border-l border-[#1e2835]">

          {/* NEXT SLIDE */}
          <section className="flex flex-[4] min-h-0 flex-col">
            <div className="flex h-[30px] flex-none items-center justify-between border-b border-[#1e2835] bg-[#090d15] px-3">
              <span className="panel-label">Next Slide</span>
              {nextEntry ? (
                <span className="truncate text-[11px] text-[#3a4a5e]">{nextEntry.slide.label}</span>
              ) : null}
            </div>
            <div className="flex-1 min-h-0 p-2">
              {nextEntry ? (
                <SlideCanvas slide={nextEntry.slide} compact className="h-full" />
              ) : (
                <EmptyMonitor label="Queue empty" />
              )}
            </div>
          </section>

          {/* TRANSPORT CONTROLS */}
          <section className="flex-none border-t border-[#1e2835]">
            <div className="flex h-[30px] items-center border-b border-[#1e2835] bg-[#090d15] px-3">
              <span className="panel-label">Transport</span>
            </div>
            <div className="divide-y divide-[#161e2a]">
              <ControlBtn label="Previous" shortcut="←" disabled={!hasSlides} onClick={() => handleMove("previous")} />
              <ControlBtn label="Next" shortcut="→" disabled={!hasSlides} onClick={() => handleMove("next")} />
              <ControlBtn
                label="Blackout"
                shortcut="B"
                disabled={!project}
                active={workspace.blackout}
                danger
                onClick={handleToggleBlackout}
              />
              <ControlBtn label="Logo" shortcut="L" disabled={!project} active={workspace.logo} onClick={handleToggleLogo} />
            </div>
          </section>

          {/* OUTPUTS */}
          <section className="flex-none border-t border-[#1e2835]">
            <div className="flex h-[30px] items-center border-b border-[#1e2835] bg-[#090d15] px-3">
              <span className="panel-label">Outputs</span>
            </div>
            <div className="divide-y divide-[#161e2a]">
              <OutputRow route="/display" ready={!!project} />
              <OutputRow route="/stage" ready={!!project} />
            </div>
          </section>

          {/* SHORTCUTS */}
          <section className="flex-1 overflow-y-auto border-t border-[#1e2835]">
            <div className="flex h-[30px] items-center border-b border-[#1e2835] bg-[#090d15] px-3">
              <span className="panel-label">Shortcuts</span>
            </div>
            <div className="divide-y divide-[#161e2a]">
              {(
                [
                  ["Next slide", "→"],
                  ["Prev slide", "←"],
                  ["Go Live", "Space"],
                  ["Blackout", "B"],
                  ["Logo", "L"],
                ] as [string, string][]
              ).map(([action, key]) => (
                <div key={action} className="flex items-center justify-between px-3 py-[7px]">
                  <span className="text-[11px] text-[#4a5a6e]">{action}</span>
                  <span className="border border-white/7 bg-black/20 px-[6px] py-[2px] font-mono text-[9px] text-[#3a4a5e]">
                    {key}
                  </span>
                </div>
              ))}
            </div>

            {/* Project info */}
            {project ? (
              <div className="border-t border-[#161e2a] px-3 py-3">
                <p className="text-[10px] leading-5 text-[#2e3d50]">
                  {getProjectKindLabel(project.kind)} · Updated {formatUpdatedAt(project.updatedAt)}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    downloadProject(project);
                    setNotice(`${project.title} exported.`);
                  }}
                  className="mt-1.5 text-[10px] text-amber-400/50 transition-colors hover:text-amber-300"
                >
                  Export project →
                </button>
              </div>
            ) : null}
          </section>
        </aside>
      </div>

      {/* ── NOTICE TOAST ─────────────────────────────────────────────────── */}
      {notice ? (
        <div className="pointer-events-none absolute bottom-4 right-4 z-20 max-w-[320px] border border-[#253040] bg-[#0d1420] px-4 py-2.5 text-[12px] text-[#c0ccd8] shadow-[0_10px_32px_rgba(0,0,0,0.55)]">
          {notice}
        </div>
      ) : null}

      {/* ── START PANEL ──────────────────────────────────────────────────── */}
      <StartPanel
        open={startPanelOpen}
        recentProjects={recentProjects}
        hideOnStartup={hideStartPanelOnStartup}
        onClose={() => setStartPanelOpen(false)}
        onToggleHideOnStartup={(hidden) => {
          setHideStartPanelOnStartup(hidden);
          writeHideStartPanelPreference(hidden);
        }}
        onOpenProjectFile={handleOpenProjectFile}
        onLoadDemo={() => {
          const demo = createDemoProject();
          loadProject(demo, `${demo.title} demo loaded.`);
        }}
        onCreateBlank={() => {
          const blank = createBlankProject();
          loadProject(blank, `${blank.title} created.`);
        }}
        onCreateSundayService={() => {
          const p = createSundayServiceTemplate();
          loadProject(p, `${p.title} template created.`);
        }}
        onCreateEventDeck={() => {
          const p = createEventDeckTemplate();
          loadProject(p, `${p.title} template created.`);
        }}
        onCreateSongSet={() => {
          const p = createSongSetTemplate();
          loadProject(p, `${p.title} template created.`);
        }}
        onOpenRecentProject={(r) => loadProject(r.project, `${r.name} reopened.`)}
        onLearnAction={(topic) => setNotice(topic)}
      />
    </div>
  );
}
