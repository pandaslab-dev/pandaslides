import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { SlideCanvas } from "../components/SlideCanvas";
import { StartPanel } from "../components/StartPanel";
import {
  SONG_TEMPLATE_OPTIONS,
  createBlankProject,
  createDemoProject,
  createEventDeckTemplate,
  createSongSetTemplate,
  createSundayServiceTemplate,
  type SongTemplateKey,
} from "../data/projectTemplates";
import {
  appendServiceItem,
  appendSlide,
  appendSongSection,
  appendSongServiceItem,
  deleteSlide,
  moveSlide,
  updateServiceItem,
  updateSlide,
  duplicateSlide,
} from "../utils/projectEditing";
import {
  applyProjectToWorkspace,
  buildLiveStateSnapshot,
  createEmptyWorkspaceState,
  createWorkspaceStateFromProject,
  getNextSlideRef,
  getPreviousSlideRef,
  getSocket,
  goLive,
  loadLocalWorkspaceState,
  moveLive,
  saveLocalWorkspaceState,
  selectSlide,
  setOutputMode,
  useLiveStateConnection,
  type OutputMode,
  type SlideRef,
  type WorkspaceState,
} from "../state/liveState";
import type { PandaSlidesProject, ServiceItemType } from "../types/project";
import {
  formatUpdatedAt,
  getProjectDownloadName,
  getProjectKindLabel,
  loadLastOpenedProject,
  loadRecentProjects,
  normalizeProject,
  parseProjectFileContents,
  prepareProjectForDownload,
  readHideStartPanelPreference,
  saveLastOpenedProject,
  saveRecentProject,
  writeHideStartPanelPreference,
  type RecentProjectRecord,
} from "../utils/projectStorage";

type FileMenuCommand = "new" | "open" | "save" | "export" | "demo" | "start";

const ITEM_TYPE_OPTIONS: { value: ServiceItemType; label: string }[] = [
  { value: "welcome", label: "Welcome" },
  { value: "scripture", label: "Scripture" },
  { value: "message", label: "Message" },
  { value: "announcement", label: "Announcement" },
  { value: "closing", label: "Closing" },
  { value: "custom", label: "Custom" },
];

const SONG_SECTION_OPTIONS = ["Verse 1", "Verse 2", "Chorus", "Bridge", "Tag", "Ending"];

function getTypeCode(type: ServiceItemType, title: string): string {
  switch (type) {
    case "welcome":
      return "WLC";
    case "song":
      return "SNG";
    case "scripture":
      return "SCR";
    case "message":
      return "MSG";
    case "announcement":
      return "ANN";
    case "closing":
      return "CLG";
    default:
      return title.slice(0, 3).toUpperCase() || "CST";
  }
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
      <div className={`h-[6px] w-[6px] flex-none rounded-full ${ready ? "status-dot-live" : "status-dot-idle"}`} />
      <span className="flex-1 font-mono text-[11px] text-[#6a7a8e]">{route}</span>
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

function ModeMonitor({ mode }: { mode: OutputMode }) {
  if (mode === "blackout") {
    return <div className="slide-frame flex h-full items-center justify-center border border-white/6 bg-black text-[10px] tracking-[0.24em] text-[#4a5a6e] uppercase">Blackout Active</div>;
  }

  if (mode === "logo") {
    return (
      <div className="slide-frame flex h-full flex-col items-center justify-center border border-white/6 bg-[radial-gradient(circle_at_top,rgba(212,164,62,0.18),transparent_36%),linear-gradient(180deg,#090c12_0%,#0d131b_100%)]">
        <div className="text-[10px] font-bold tracking-[0.28em] text-amber-300/70 uppercase">Logo</div>
        <div className="mt-2 text-4xl font-semibold tracking-tight text-white">
          Panda<span className="text-[color:var(--color-accent-400)]">Slides</span>
        </div>
        <div className="mt-2 text-[11px] text-[#8d9db0]">Holding screen ready</div>
      </div>
    );
  }

  return null;
}

function FieldLabel({ children }: { children: string }) {
  return <div className="text-[10px] font-semibold tracking-[0.18em] text-[#5a6a7e] uppercase">{children}</div>;
}

function ChromeInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-8 w-full border border-[#1e2835] bg-[#0c111a] px-2.5 text-[12px] text-[#d5dde6] outline-none transition-colors placeholder:text-[#3a4a5e] focus:border-[#3a4a5e] ${props.className ?? ""}`}
    />
  );
}

function ChromeTextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-[120px] w-full resize-y border border-[#1e2835] bg-[#0c111a] px-2.5 py-2 text-[12px] leading-5 text-[#d5dde6] outline-none transition-colors placeholder:text-[#3a4a5e] focus:border-[#3a4a5e] ${props.className ?? ""}`}
    />
  );
}

function ChromeSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-8 w-full border border-[#1e2835] bg-[#0c111a] px-2.5 text-[12px] text-[#d5dde6] outline-none transition-colors focus:border-[#3a4a5e] ${props.className ?? ""}`}
    />
  );
}

function CompactAction({
  label,
  onClick,
  disabled = false,
  accent = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-8 border px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
        disabled
          ? "cursor-not-allowed border-[#151b25] bg-[#0a0f17] text-[#2e3d50]"
          : accent
            ? "border-amber-400/20 bg-amber-400/10 text-amber-200 hover:bg-amber-400/14"
            : "border-[#1e2835] bg-[#0b1119] text-[#8d9db0] hover:bg-white/4 hover:text-[#d5dde6]"
      }`}
    >
      {label}
    </button>
  );
}

export function OperatorPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileMenuRef = useRef<HTMLDivElement | null>(null);
  const bootstrapAttemptedRef = useRef(false);
  const socket = getSocket();
  const { workspace: remoteWorkspace, loading: syncLoading, error: syncError } = useLiveStateConnection();

  const localSnapshot = useMemo(() => loadLocalWorkspaceState(), []);
  const lastOpenedProject = useMemo(() => loadLastOpenedProject(), []);

  const [workspace, setWorkspace] = useState<WorkspaceState>(() => localSnapshot ?? createEmptyWorkspaceState());
  const [recentProjects, setRecentProjects] = useState<RecentProjectRecord[]>(() => loadRecentProjects());
  const [startPanelOpen, setStartPanelOpen] = useState(() => !readHideStartPanelPreference());
  const [hideStartPanelOnStartup, setHideStartPanelOnStartup] = useState(() => readHideStartPanelPreference());
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newItemType, setNewItemType] = useState<ServiceItemType>("welcome");
  const [newSongTitle, setNewSongTitle] = useState("New Song");
  const [newSongTemplate, setNewSongTemplate] = useState<SongTemplateKey>("basic-song");
  const [newSongSection, setNewSongSection] = useState("Verse 1");

  const snapshot = useMemo(() => buildLiveStateSnapshot(workspace), [workspace]);
  const project = snapshot.project;
  const liveEntry = snapshot.live;
  const selectedEntry = snapshot.selected;
  const nextEntry = snapshot.next;
  const currentItem = snapshot.currentServiceItem;
  const flatSlides = useMemo(() => (project ? project.serviceItems.flatMap((item) => item.slides) : []), [project]);
  const hasSlides = flatSlides.length > 0;

  const selectedItem = selectedEntry?.item ?? currentItem ?? null;
  const selectedSlideRef = selectedEntry?.ref ?? null;

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!syncError) {
      return;
    }

    setNotice(syncError);
  }, [syncError]);

  useEffect(() => {
    if (!remoteWorkspace) {
      return;
    }

    setWorkspace(remoteWorkspace);
    bootstrapAttemptedRef.current = true;
  }, [remoteWorkspace]);

  useEffect(() => {
    if (bootstrapAttemptedRef.current || syncLoading) {
      return;
    }

    bootstrapAttemptedRef.current = true;

    if (remoteWorkspace?.project) {
      return;
    }

    const fallbackProject = localSnapshot?.project ?? lastOpenedProject;
    if (!fallbackProject) {
      return;
    }

    const nextWorkspace = localSnapshot?.project
      ? localSnapshot
      : createWorkspaceStateFromProject(fallbackProject, {
          mode: "live",
        });

    setWorkspace(nextWorkspace);
    socket.emit("project:load", {
      project: nextWorkspace.project,
      selected: nextWorkspace.selected,
      live: nextWorkspace.live,
      mode: nextWorkspace.mode,
    });
  }, [lastOpenedProject, localSnapshot, remoteWorkspace, socket, syncLoading]);

  useEffect(() => {
    saveLocalWorkspaceState(workspace);

    if (workspace.project) {
      saveLastOpenedProject(workspace.project);
      setRecentProjects(saveRecentProject(workspace.project));
    }
  }, [workspace]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) {
        return;
      }

      if (!project || !hasSlides || startPanelOpen) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleMove("next");
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        handleMove("previous");
      } else if (event.key === " ") {
        event.preventDefault();
        handleGoLive();
      } else if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        handleToggleMode("blackout");
      } else if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        handleToggleMode("logo");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasSlides, project, startPanelOpen, workspace]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!fileMenuRef.current || !menuOpen) {
        return;
      }

      if (!fileMenuRef.current.contains(event.target as Node)) {
        setMenuOpen(null);
      }
    }

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  function pushProjectState(nextState: WorkspaceState, eventName: "project:load" | "project:update", successMessage?: string) {
    setWorkspace(nextState);
    socket.emit(eventName, {
      project: nextState.project,
      selected: nextState.selected,
      live: nextState.live,
      mode: nextState.mode,
    });

    if (successMessage) {
      setNotice(successMessage);
    }
  }

  function pushProject(nextProject: PandaSlidesProject, eventName: "project:load" | "project:update", successMessage?: string, overrides?: Partial<Pick<WorkspaceState, "selected" | "live" | "mode">>) {
    const nextState =
      eventName === "project:load"
        ? createWorkspaceStateFromProject(nextProject, overrides)
        : applyProjectToWorkspace(workspace, {
            project: nextProject,
            selected: overrides?.selected,
            live: overrides?.live,
            mode: overrides?.mode,
          });

    pushProjectState(nextState, eventName, successMessage);
    setStartPanelOpen(false);
    setMenuOpen(null);
  }

  function pushLiveState(nextState: WorkspaceState, eventName: "live:select" | "live:goToSlide" | "live:next" | "live:previous" | "live:setMode", payload?: unknown) {
    setWorkspace(nextState);
    socket.emit(eventName, payload);
  }

  function loadProject(projectInput: PandaSlidesProject, successMessage: string) {
    const nextProject = normalizeProject({ ...projectInput, updatedAt: new Date().toISOString() }, projectInput.name);
    pushProject(nextProject, "project:load", successMessage);
  }

  function updateCurrentProject(
    updater: (project: PandaSlidesProject) => PandaSlidesProject,
    successMessage?: string,
    overrides?: Partial<Pick<WorkspaceState, "selected" | "live" | "mode">>,
  ) {
    if (!workspace.project) {
      return;
    }

    const nextProject = updater(workspace.project);
    pushProject(nextProject, "project:update", successMessage, overrides);
  }

  function handleOpenProjectFile() {
    fileInputRef.current?.click();
  }

  async function handleProjectFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const contents = await file.text();
      const parsedProject = parseProjectFileContents(contents, file.name);
      loadProject(parsedProject, `${parsedProject.name} loaded.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to open project file.");
      setStartPanelOpen(true);
    } finally {
      event.target.value = "";
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
        if (!project) {
          setNotice("Load a project first.");
          break;
        }
        downloadProject(project);
        setNotice(`${project.name} exported.`);
        break;
      case "demo": {
        const demo = createDemoProject();
        loadProject(demo, `${demo.name} demo loaded.`);
        break;
      }
      case "start":
        setStartPanelOpen(true);
        break;
    }

    setMenuOpen(null);
  }

  function handleSelectSlide(slideRef: SlideRef) {
    const nextState = selectSlide(workspace, slideRef);
    pushLiveState(nextState, "live:select", slideRef);
  }

  function handleGoLive(slideRef?: SlideRef) {
    const nextState = goLive(workspace, slideRef);
    pushLiveState(nextState, "live:goToSlide", slideRef ?? nextState.live);
  }

  function handleMove(direction: "next" | "previous") {
    const nextState = moveLive(workspace, direction);
    pushLiveState(nextState, direction === "next" ? "live:next" : "live:previous");
  }

  function handleToggleMode(mode: Exclude<OutputMode, "live">) {
    const nextMode = workspace.mode === mode ? "live" : mode;
    const nextState = setOutputMode(workspace, nextMode);
    pushLiveState(nextState, "live:setMode", { mode: nextMode });
  }

  function handleAddServiceItem() {
    if (!workspace.project) {
      return;
    }

    const nextProject = appendServiceItem(workspace.project, newItemType);
    const nextItem = nextProject.serviceItems.at(-1);
    const nextRef = nextItem?.slides[0] ? { serviceItemId: nextItem.id, slideId: nextItem.slides[0].id } : null;
    pushProject(nextProject, "project:update", `${nextItem?.title ?? "Service item"} added.`, {
      selected: nextRef,
      live: workspace.live,
    });
  }

  function handleAddSongItem() {
    if (!workspace.project) {
      return;
    }

    const nextProject = appendSongServiceItem(workspace.project, newSongTitle.trim() || "New Song", newSongTemplate);
    const nextItem = nextProject.serviceItems.at(-1);
    const nextRef = nextItem?.slides[0] ? { serviceItemId: nextItem.id, slideId: nextItem.slides[0].id } : null;
    pushProject(nextProject, "project:update", `${nextItem?.title ?? "Song"} added.`, {
      selected: nextRef,
      live: workspace.live,
    });
  }

  function handleAddSlide() {
    if (!workspace.project || !selectedItem) {
      return;
    }

    const nextProject = appendSlide(workspace.project, selectedItem.id);
    const updatedItem = nextProject.serviceItems.find((serviceItem) => serviceItem.id === selectedItem.id);
    const nextSlide = updatedItem?.slides.at(-1);
    const nextRef = nextSlide ? { serviceItemId: selectedItem.id, slideId: nextSlide.id } : workspace.selected;
    pushProject(nextProject, "project:update", "Slide added.", {
      selected: nextRef,
      live: workspace.live,
    });
  }

  function handleAddSongSection() {
    if (!workspace.project || !selectedItem || selectedItem.type !== "song") {
      return;
    }

    const nextProject = appendSongSection(workspace.project, selectedItem.id, newSongSection);
    const updatedItem = nextProject.serviceItems.find((serviceItem) => serviceItem.id === selectedItem.id);
    const nextSlide = updatedItem?.slides.at(-1);
    const nextRef = nextSlide ? { serviceItemId: selectedItem.id, slideId: nextSlide.id } : workspace.selected;
    pushProject(nextProject, "project:update", `${newSongSection} added.`, {
      selected: nextRef,
      live: workspace.live,
    });
  }

  function handleDuplicateSlide() {
    if (!workspace.project || !selectedEntry) {
      return;
    }

    updateCurrentProject(
      (currentProject) => duplicateSlide(currentProject, selectedEntry.item.id, selectedEntry.slide.id),
      "Slide duplicated.",
    );
  }

  function handleDeleteSlide() {
    if (!workspace.project || !selectedEntry) {
      return;
    }

    const selectedFallback =
      selectedSlideRef &&
      selectedSlideRef.serviceItemId === selectedEntry.item.id &&
      selectedSlideRef.slideId === selectedEntry.slide.id
        ? getNextSlideRef(workspace.project, selectedSlideRef) ?? getPreviousSlideRef(workspace.project, selectedSlideRef)
        : workspace.selected;
    const liveFallback =
      workspace.live &&
      workspace.live.serviceItemId === selectedEntry.item.id &&
      workspace.live.slideId === selectedEntry.slide.id
        ? getNextSlideRef(workspace.project, workspace.live) ?? getPreviousSlideRef(workspace.project, workspace.live)
        : workspace.live;

    updateCurrentProject(
      (currentProject) => deleteSlide(currentProject, selectedEntry.item.id, selectedEntry.slide.id),
      "Slide deleted.",
      {
        selected: selectedFallback,
        live: liveFallback,
      },
    );
  }

  function handleMoveSelectedSlide(direction: "up" | "down") {
    if (!selectedEntry) {
      return;
    }

    updateCurrentProject(
      (currentProject) => moveSlide(currentProject, selectedEntry.item.id, selectedEntry.slide.id, direction),
      direction === "up" ? "Slide moved up." : "Slide moved down.",
    );
  }

  function renderCurrentOutput() {
    if (workspace.mode !== "live") {
      return <ModeMonitor mode={workspace.mode} />;
    }

    if (liveEntry) {
      return <SlideCanvas slide={liveEntry.slide} className="h-full" emptyStateLabel="No slide text" />;
    }

    return (
      <EmptyMonitor
        label={project ? "Waiting for live output" : "No project loaded"}
        action={project ? undefined : "Open Start Panel"}
        onAction={() => setStartPanelOpen(true)}
      />
    );
  }

  const dimWorkspace = startPanelOpen;

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#080b10] text-[#eef1f5]">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pandaslides,.json,application/json"
        className="hidden"
        onChange={handleProjectFileChange}
      />

      <header className="app-menubar flex h-[34px] flex-none items-stretch border-b border-[#1e2835]">
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

        <nav className="flex items-stretch">
          <div ref={fileMenuRef} className="relative flex items-stretch">
            <button
              type="button"
              onClick={() => setMenuOpen((menu) => (menu === "file" ? null : "file"))}
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
                ).map(([label, command]) => (
                  <button
                    key={command}
                    type="button"
                    onClick={() => handleFileMenuAction(command)}
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
                const messages: Record<string, string> = {
                  Edit: "Use the inspector panel to update service items and slides.",
                  View: "Open /display or /stage in separate tabs for live output routing.",
                  Output: "Display and stage reconnect automatically to the latest live state.",
                  Help: "Shortcuts: → next · ← previous · Space go live · B blackout · L logo.",
                };
                setNotice(messages[label]);
              }}
              className="flex items-center px-3 text-[13px] text-[#8d9db0] transition-colors hover:bg-white/4 hover:text-white"
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-3 border-l border-[#1e2835] px-3">
          {project ? (
            <>
              <span className="max-w-[220px] truncate text-[12px] text-[#8d9db0]">{project.name}</span>
              <span className="text-[#2e3d50]">·</span>
              <span className="text-[11px] text-[#4a5a6e]">{getProjectKindLabel(project.kind)}</span>
              <span
                className={`px-[7px] py-[2px] text-[9px] font-bold tracking-[0.22em] uppercase ${
                  workspace.mode === "blackout"
                    ? "bg-red-900/20 text-red-300"
                    : workspace.mode === "logo"
                      ? "bg-amber-400/10 text-amber-200"
                      : "bg-emerald-500/12 text-emerald-300"
                }`}
              >
                {workspace.mode === "blackout" ? "BLACKOUT" : workspace.mode === "logo" ? "LOGO" : "LIVE"}
              </span>
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

      <div className={`flex flex-1 overflow-hidden transition-opacity duration-150 ${dimWorkspace ? "pointer-events-none opacity-40" : ""}`}>
        <aside className="flex w-[264px] flex-none flex-col overflow-hidden border-r border-[#1e2835]">
          <div className="flex h-[30px] flex-none items-center justify-between border-b border-[#1e2835] bg-[#090d15] px-3">
            <span className="panel-label">Service Rundown</span>
            <div className="flex items-center gap-2.5">
              {hasSlides ? <span className="font-mono text-[10px] text-[#2e3d50]">{flatSlides.length}</span> : null}
              <button
                type="button"
                onClick={() => setStartPanelOpen(true)}
                className="text-[10px] text-amber-400/50 transition-colors hover:text-amber-300"
              >
                + New
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {project && project.serviceItems.length > 0 ? (
              project.serviceItems.map((item) => {
                const typeCode = getTypeCode(item.type, item.title);
                const isItemActive = liveEntry?.item.id === item.id;

                return (
                  <div key={item.id} className="border-b border-[#161e2a]">
                    <div
                      className={`flex items-center gap-2 border-b border-[#161e2a] px-2.5 py-[6px] ${
                        isItemActive ? "bg-emerald-500/5" : "cue-header"
                      }`}
                    >
                      <span className="min-w-[26px] text-center text-[8px] font-bold tracking-wider text-[#3a4d60] uppercase">
                        {typeCode}
                      </span>
                      <span className="flex-1 truncate text-[11px] font-semibold text-[#8d9db0]">{item.title}</span>
                      <span className="font-mono text-[10px] text-[#2e3d50]">{item.slides.length}</span>
                    </div>

                    {item.slides.map((slide) => {
                      const isSelected = selectedEntry?.slide.id === slide.id && selectedEntry.item.id === item.id;
                      const isLive = liveEntry?.slide.id === slide.id && liveEntry.item.id === item.id;

                      return (
                        <button
                          key={slide.id}
                          type="button"
                          onClick={() => handleSelectSlide({ serviceItemId: item.id, slideId: slide.id })}
                          onDoubleClick={() => handleGoLive({ serviceItemId: item.id, slideId: slide.id })}
                          className={`flex w-full items-center border-b border-[#0f1620] py-[5px] pl-[46px] pr-2.5 text-left transition-colors ${
                            isSelected
                              ? "border-l-2 border-l-amber-400/60 bg-amber-400/6 pl-[44px]"
                              : "border-l-2 border-l-transparent hover:bg-white/3"
                          }`}
                        >
                          <span
                            className={`flex-1 truncate text-[11px] ${
                              isLive ? "font-semibold text-white" : isSelected ? "text-[#c8d4e0]" : "text-[#5a6a7e]"
                            }`}
                          >
                            {slide.title}
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
                  {project ? "No slides in this project." : syncLoading ? "Connecting to the server…" : "No project loaded."}
                </p>
                <button
                  type="button"
                  onClick={() => setStartPanelOpen(true)}
                  className="mt-2 text-[11px] text-amber-400/60 transition-colors hover:text-amber-300"
                >
                  {project ? "Add a service item →" : "Open a project →"}
                </button>
              </div>
            )}
          </div>
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden">
          <section className="flex min-h-0 flex-[3] flex-col">
            <div className="flex h-[30px] flex-none items-center justify-between border-b border-[#1e2835] bg-[#090d15] px-3">
              <div className="flex items-center gap-3">
                <span className="panel-label">Current Slide</span>
                {liveEntry ? (
                  <span className="truncate text-[11px] text-[#5a6a7e]">
                    {liveEntry.item.title}&thinsp;·&thinsp;{liveEntry.slide.title}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2.5">
                {snapshot.slidePosition ? (
                  <span className="font-mono text-[10px] text-[#2e3d50]">
                    {snapshot.slidePosition.current}&thinsp;/&thinsp;{snapshot.slidePosition.total}
                  </span>
                ) : null}
                <span
                  className={`px-[7px] py-[2px] text-[9px] font-bold tracking-[0.2em] uppercase ${
                    workspace.mode === "blackout"
                      ? "bg-red-900/20 text-red-300"
                      : workspace.mode === "logo"
                        ? "bg-amber-400/10 text-amber-200"
                        : liveEntry
                          ? "bg-emerald-500/12 text-emerald-300"
                          : "bg-white/4 text-[#2e3d50]"
                  }`}
                >
                  {workspace.mode === "blackout" ? "BLACKOUT" : workspace.mode === "logo" ? "LOGO" : liveEntry ? "LIVE" : "STANDBY"}
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 p-2">{renderCurrentOutput()}</div>
          </section>

          <section className="flex min-h-0 flex-[2] flex-col border-t border-[#1e2835]">
            <div className="flex h-[30px] flex-none items-center justify-between border-b border-[#1e2835] bg-[#090d15] px-3">
              <div className="flex items-center gap-3">
                <span className="panel-label">Queued</span>
                {selectedEntry ? (
                  <span className="max-w-[260px] truncate text-[11px] text-[#5a6a7e]">
                    {selectedEntry.item.title}&thinsp;·&thinsp;{selectedEntry.slide.title}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                disabled={!selectedEntry}
                onClick={() => handleGoLive()}
                className={`flex items-center gap-2 px-3 py-[5px] text-[11px] font-bold tracking-wide uppercase transition-colors ${
                  selectedEntry ? "bg-amber-500 text-black hover:bg-amber-400" : "cursor-not-allowed bg-white/4 text-[#2e3d50]"
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

            <div className="min-h-0 flex-1 p-2">
              {selectedEntry ? (
                <SlideCanvas slide={selectedEntry.slide} compact className="h-full" emptyStateLabel="No slide text" />
              ) : (
                <EmptyMonitor label="Select a slide to queue" />
              )}
            </div>
          </section>
        </main>

        <aside className="flex w-[248px] flex-none flex-col overflow-hidden border-l border-[#1e2835]">
          <section className="flex min-h-0 flex-[3] flex-col">
            <div className="flex h-[30px] flex-none items-center justify-between border-b border-[#1e2835] bg-[#090d15] px-3">
              <span className="panel-label">Next Slide</span>
              {nextEntry ? <span className="truncate text-[11px] text-[#3a4a5e]">{nextEntry.slide.title}</span> : null}
            </div>
            <div className="min-h-0 flex-1 p-2">
              {nextEntry ? (
                <SlideCanvas slide={nextEntry.slide} compact className="h-full" emptyStateLabel="No slide text" />
              ) : (
                <EmptyMonitor label="No next slide" />
              )}
            </div>
          </section>

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
                active={workspace.mode === "blackout"}
                danger
                onClick={() => handleToggleMode("blackout")}
              />
              <ControlBtn
                label="Logo"
                shortcut="L"
                disabled={!project}
                active={workspace.mode === "logo"}
                onClick={() => handleToggleMode("logo")}
              />
            </div>
          </section>

          <section className="flex-none border-t border-[#1e2835]">
            <div className="flex h-[30px] items-center border-b border-[#1e2835] bg-[#090d15] px-3">
              <span className="panel-label">Outputs</span>
            </div>
            <div className="divide-y divide-[#161e2a]">
              <OutputRow route="/display" ready={!!project && !syncError} />
              <OutputRow route="/stage" ready={!!project && !syncError} />
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[#1e2835]">
            <div className="flex h-[30px] flex-none items-center border-b border-[#1e2835] bg-[#090d15] px-3">
              <span className="panel-label">Inspector</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="divide-y divide-[#161e2a]">
                <div className="px-3 py-2.5">
                  <FieldLabel>New Service Item</FieldLabel>
                  <div className="mt-2 space-y-2">
                    <ChromeSelect value={newItemType} onChange={(event) => setNewItemType(event.target.value as ServiceItemType)}>
                      {ITEM_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </ChromeSelect>
                    <CompactAction label="Add Item" onClick={handleAddServiceItem} disabled={!project} accent />
                  </div>
                </div>

                <div className="px-3 py-2.5">
                  <FieldLabel>New Song</FieldLabel>
                  <div className="mt-2 space-y-2">
                    <ChromeInput value={newSongTitle} onChange={(event) => setNewSongTitle(event.target.value)} placeholder="Song title" />
                    <ChromeSelect value={newSongTemplate} onChange={(event) => setNewSongTemplate(event.target.value as SongTemplateKey)}>
                      {SONG_TEMPLATE_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </ChromeSelect>
                    <CompactAction label="Add Song" onClick={handleAddSongItem} disabled={!project} accent />
                  </div>
                </div>

                {selectedItem ? (
                  <div className="px-3 py-2.5">
                    <FieldLabel>Service Item</FieldLabel>
                    <div className="mt-2 space-y-2">
                      <ChromeInput
                        value={selectedItem.title}
                        onChange={(event) =>
                          updateCurrentProject((currentProject) => updateServiceItem(currentProject, selectedItem.id, { title: event.target.value }))
                        }
                        placeholder="Service item title"
                      />
                      <div className="text-[10px] text-[#4a5a6e]">
                        {selectedItem.type.toUpperCase()} · {selectedItem.slides.length} slide{selectedItem.slides.length === 1 ? "" : "s"}
                      </div>
                      <div className="flex gap-1.5">
                        <CompactAction label="+ Slide" onClick={handleAddSlide} disabled={!project} />
                        {selectedItem.type === "song" ? (
                          <CompactAction label="+ Section" onClick={handleAddSongSection} disabled={!project} />
                        ) : null}
                      </div>
                      {selectedItem.type === "song" ? (
                        <ChromeSelect value={newSongSection} onChange={(event) => setNewSongSection(event.target.value)}>
                          {SONG_SECTION_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </ChromeSelect>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {selectedEntry ? (
                  <div className="px-3 py-2.5">
                    <FieldLabel>Slide Editor</FieldLabel>
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-1.5">
                        <CompactAction label="Duplicate" onClick={handleDuplicateSlide} disabled={!project} />
                        <CompactAction label="Delete" onClick={handleDeleteSlide} disabled={!project} />
                      </div>
                      <div className="flex gap-1.5">
                        <CompactAction label="Move Up" onClick={() => handleMoveSelectedSlide("up")} disabled={!project || selectedEntry.slideIndex === 0} />
                        <CompactAction
                          label="Move Down"
                          onClick={() => handleMoveSelectedSlide("down")}
                          disabled={!project || selectedEntry.slideIndex === selectedEntry.item.slides.length - 1}
                        />
                      </div>
                      <ChromeInput
                        value={selectedEntry.slide.title}
                        onChange={(event) =>
                          updateCurrentProject((currentProject) =>
                            updateSlide(currentProject, selectedEntry.item.id, selectedEntry.slide.id, {
                              title: event.target.value,
                            }),
                          )
                        }
                        placeholder="Slide title"
                      />
                      <ChromeTextArea
                        value={selectedEntry.slide.body}
                        onChange={(event) =>
                          updateCurrentProject((currentProject) =>
                            updateSlide(currentProject, selectedEntry.item.id, selectedEntry.slide.id, {
                              body: event.target.value,
                            }),
                          )
                        }
                        placeholder="Slide text"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="px-3 py-3 text-[11px] text-[#4a5a6e]">Select a slide to edit its title and body.</div>
                )}
              </div>
            </div>
          </section>

          <section className="flex-none border-t border-[#1e2835]">
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

            {project ? (
              <div className="border-t border-[#161e2a] px-3 py-3">
                <p className="text-[10px] leading-5 text-[#2e3d50]">
                  {getProjectKindLabel(project.kind)} · Updated {formatUpdatedAt(project.updatedAt)}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    downloadProject(project);
                    setNotice(`${project.name} exported.`);
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

      {notice ? (
        <div className="pointer-events-none absolute bottom-4 right-4 z-20 max-w-[320px] border border-[#253040] bg-[#0d1420] px-4 py-2.5 text-[12px] text-[#c0ccd8] shadow-[0_10px_32px_rgba(0,0,0,0.55)]">
          {notice}
        </div>
      ) : null}

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
          loadProject(demo, `${demo.name} demo loaded.`);
        }}
        onCreateBlank={() => {
          const blank = createBlankProject();
          loadProject(blank, `${blank.name} created.`);
        }}
        onCreateSundayService={() => {
          const serviceProject = createSundayServiceTemplate();
          loadProject(serviceProject, `${serviceProject.name} template created.`);
        }}
        onCreateEventDeck={() => {
          const eventProject = createEventDeckTemplate();
          loadProject(eventProject, `${eventProject.name} template created.`);
        }}
        onCreateSongSet={() => {
          const songSetProject = createSongSetTemplate();
          loadProject(songSetProject, `${songSetProject.name} template created.`);
        }}
        onOpenRecentProject={(recentProject) => loadProject(recentProject.project, `${recentProject.name} reopened.`)}
        onLearnAction={(topic) => setNotice(topic)}
      />
    </div>
  );
}
