import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { SlideCanvas } from "../components/SlideCanvas";
import { SlideEditorToolbar, type SlideEditorTool } from "../components/SlideEditorToolbar";
import { StartPanel } from "../components/StartPanel";
import {
  SONG_TEMPLATE_OPTIONS,
  createBlankProject,
  createSundayServiceTemplate,
  type SongTemplateKey,
} from "../data/projectTemplates";
import {
  appendServiceItem,
  appendSlide,
  appendSongSection,
  appendSongServiceItem,
  deleteServiceItem,
  deleteSlide,
  duplicateServiceItem,
  moveSlide,
  moveServiceItem,
  replaceSongSlidesFromText,
  updateServiceItem,
  updateSlide,
  updateSlideMedia,
  duplicateSlide,
} from "../utils/projectEditing";
import {
  applyProjectToWorkspace,
  buildLiveStateSnapshot,
  createEmptyWorkspaceState,
  createWorkspaceStateFromProject,
  getFirstSlideRef,
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
import { formatMidiBinding, useMidiControls, type MidiAction } from "../utils/midiControl";
import type { PandaSlidesProject, ServiceItem, ServiceItemType, SlideAlignment, SlideFontSize } from "../types/project";
import {
  formatUpdatedAt,
  getProjectDownloadName,
  getProjectKindLabel,
  cloneProject,
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

type FileMenuCommand = "new" | "open" | "save" | "export" | "start";

const ITEM_TYPE_OPTIONS: { value: ServiceItemType; label: string }[] = [
  { value: "welcome", label: "Welcome" },
  { value: "scripture", label: "Scripture" },
  { value: "message", label: "Message" },
  { value: "announcement", label: "Announcement" },
  { value: "closing", label: "Closing" },
  { value: "custom", label: "Custom" },
];

const SONG_SECTION_OPTIONS = ["Verse 1", "Verse 2", "Chorus", "Bridge", "Tag", "Ending"];
const SLIDE_ALIGNMENT_OPTIONS: { value: SlideAlignment; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];
const SLIDE_FONT_SIZE_OPTIONS: { value: SlideFontSize; label: string }[] = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Extra Large" },
];
const MIDI_ACTION_LABELS: Record<MidiAction, string> = {
  previous: "Previous",
  next: "Next",
  goLive: "Go Live",
  blackout: "Blackout",
  logo: "Logo",
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_SLIDE_IMAGE_WIDTH = 1920;
const MAX_SLIDE_IMAGE_HEIGHT = 1080;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read that file."));
      }
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Unable to read that file.")));
    reader.readAsDataURL(file);
  });
}

async function optimizeSlideImage(file: File) {
  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.addEventListener("load", () => resolve(nextImage), { once: true });
      nextImage.addEventListener("error", () => reject(new Error("Unable to decode that image.")), { once: true });
      nextImage.src = sourceUrl;
    });

    const scale = Math.min(1, MAX_SLIDE_IMAGE_WIDTH / image.naturalWidth, MAX_SLIDE_IMAGE_HEIGHT / image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to prepare that image.");
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      dataUrl: canvas.toDataURL("image/webp", 0.82),
      mimeType: "image/webp",
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function buildSlideRef(serviceItemId: string, slideId: string): SlideRef {
  return { serviceItemId, slideId };
}

function getServiceItemFirstSlideRef(serviceItem: ServiceItem | null) {
  const firstSlide = serviceItem?.slides[0];
  if (!serviceItem || !firstSlide) {
    return null;
  }

  return buildSlideRef(serviceItem.id, firstSlide.id);
}

function formatSongDraft(serviceItem: ServiceItem) {
  return serviceItem.slides
    .map((slide) => `[${slide.title}]\n${slide.body}`.trim())
    .join("\n\n");
}

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

function ChromeTextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
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
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const slideBodyInputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileMenuRef = useRef<HTMLDivElement | null>(null);
  const bootstrapAttemptedRef = useRef(false);
  const undoStackRef = useRef<PandaSlidesProject[]>([]);
  const redoStackRef = useRef<PandaSlidesProject[]>([]);
  const pendingProjectEmitRef = useRef<number | null>(null);
  const lastHistoryMutationRef = useRef<{ key: string; at: number } | null>(null);
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
  const [newItemType, setNewItemType] = useState<ServiceItemType>("custom");
  const [newItemTitle, setNewItemTitle] = useState("New Section");
  const [newSongTitle, setNewSongTitle] = useState("New Song");
  const [newSongTemplate, setNewSongTemplate] = useState<SongTemplateKey>("basic-song");
  const [newSongSection, setNewSongSection] = useState("Verse 1");
  const [songDraftText, setSongDraftText] = useState("");
  const [activeEditorTool, setActiveEditorTool] = useState<SlideEditorTool>("select");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);

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
  const canUndo = historyVersion >= 0 && undoStackRef.current.length > 0;
  const canRedo = historyVersion >= 0 && redoStackRef.current.length > 0;
  const midiControls = useMidiControls({
    onAction(action) {
      switch (action) {
        case "previous":
          handleMove("previous");
          break;
        case "next":
          handleMove("next");
          break;
        case "goLive":
          handleGoLive();
          break;
        case "blackout":
          handleToggleMode("blackout");
          break;
        case "logo":
          handleToggleMode("logo");
          break;
      }
    },
  });

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
    if (!selectedItem || selectedItem.type !== "song") {
      return;
    }

    setSongDraftText(formatSongDraft(selectedItem));
  }, [selectedItem?.id, selectedItem?.type]);

  useEffect(() => {
    setActiveEditorTool("select");
    setEmojiPickerOpen(false);
  }, [selectedEntry?.slide.id]);

  const handleGlobalKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    const modifierPressed = event.metaKey || event.ctrlKey;
    if (modifierPressed && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
      return;
    }

    if (modifierPressed && event.key.toLowerCase() === "y") {
      event.preventDefault();
      handleRedo();
      return;
    }

    if (modifierPressed && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (!project) {
        setNotice("Load a project first.");
        return;
      }

      downloadProject(project);
      setNotice(`${project.name} exported.`);
      return;
    }

    if (modifierPressed && event.key.toLowerCase() === "o") {
      event.preventDefault();
      handleOpenProjectFile();
      return;
    }

    if (modifierPressed && event.key.toLowerCase() === "n") {
      event.preventDefault();
      setStartPanelOpen(true);
      return;
    }

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
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      handleQueueMove("next");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      handleQueueMove("previous");
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      handleGoLive();
    } else if (event.key.toLowerCase() === "b") {
      event.preventDefault();
      handleToggleMode("blackout");
    } else if (event.key.toLowerCase() === "l") {
      event.preventDefault();
      handleToggleMode("logo");
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  useEffect(
    () => () => {
      if (pendingProjectEmitRef.current !== null) {
        window.clearTimeout(pendingProjectEmitRef.current);
      }
    },
    [],
  );

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
    const payload = {
      project: nextState.project,
      selected: nextState.selected,
      live: nextState.live,
      mode: nextState.mode,
    };

    if (pendingProjectEmitRef.current !== null) {
      window.clearTimeout(pendingProjectEmitRef.current);
      pendingProjectEmitRef.current = null;
    }

    if (eventName === "project:update") {
      pendingProjectEmitRef.current = window.setTimeout(() => {
        socket.emit(eventName, payload);
        pendingProjectEmitRef.current = null;
      }, 120);
    } else {
      socket.emit(eventName, payload);
    }

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
    undoStackRef.current = [];
    redoStackRef.current = [];
    lastHistoryMutationRef.current = null;
    setHistoryVersion((version) => version + 1);
    pushProject(nextProject, "project:load", successMessage);
  }

  function updateCurrentProject(
    updater: (project: PandaSlidesProject) => PandaSlidesProject,
    successMessage?: string,
    overrides?: Partial<Pick<WorkspaceState, "selected" | "live" | "mode">>,
    historyKey?: string,
  ) {
    if (!workspace.project) {
      return;
    }

    const nextProject = updater(workspace.project);
    if (nextProject === workspace.project) {
      return;
    }

    const now = Date.now();
    const shouldCoalesce =
      historyKey &&
      lastHistoryMutationRef.current?.key === historyKey &&
      now - lastHistoryMutationRef.current.at < 750;
    if (!shouldCoalesce) {
      undoStackRef.current = [...undoStackRef.current.slice(-49), cloneProject(workspace.project)];
    }
    lastHistoryMutationRef.current = historyKey ? { key: historyKey, at: now } : null;
    redoStackRef.current = [];
    setHistoryVersion((version) => version + 1);
    pushProject(nextProject, "project:update", successMessage, overrides);
  }

  function handleUndo() {
    if (!workspace.project || undoStackRef.current.length === 0) {
      return;
    }

    const previousProject = undoStackRef.current.at(-1);
    if (!previousProject) {
      return;
    }

    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current.slice(-49), cloneProject(workspace.project)];
    lastHistoryMutationRef.current = null;
    setHistoryVersion((version) => version + 1);
    pushProject(previousProject, "project:update", "Undo");
  }

  function handleRedo() {
    if (!workspace.project || redoStackRef.current.length === 0) {
      return;
    }

    const nextProject = redoStackRef.current.at(-1);
    if (!nextProject) {
      return;
    }

    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current.slice(-49), cloneProject(workspace.project)];
    lastHistoryMutationRef.current = null;
    setHistoryVersion((version) => version + 1);
    pushProject(nextProject, "project:update", "Redo");
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

  function handleQueueMove(direction: "next" | "previous") {
    if (!workspace.project) {
      return;
    }

    const baseRef = workspace.selected ?? workspace.live ?? getFirstSlideRef(workspace.project);
    const nextRef =
      direction === "next"
        ? getNextSlideRef(workspace.project, baseRef)
        : getPreviousSlideRef(workspace.project, baseRef);

    if (!nextRef) {
      return;
    }

    handleSelectSlide(nextRef);
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

  function openOutputWindow(route: "/display" | "/stage") {
    window.open(route, "_blank", "noopener,noreferrer");
  }

  function handleAddServiceItem(type = newItemType, title = newItemTitle) {
    if (!workspace.project) {
      return;
    }

    const nextProject = appendServiceItem(workspace.project, type, title.trim() || "New Section");
    const nextItem = nextProject.serviceItems.at(-1);
    const nextRef = nextItem?.slides[0] ? { serviceItemId: nextItem.id, slideId: nextItem.slides[0].id } : null;
    pushProject(nextProject, "project:update", `${nextItem?.title ?? "Section"} added.`, {
      selected: nextRef,
      live: workspace.live,
    });
    setNewItemTitle("New Section");
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

  function handleDuplicateServiceItem() {
    if (!workspace.project || !selectedItem) {
      return;
    }

    const nextProject = duplicateServiceItem(workspace.project, selectedItem.id);
    const sourceIndex = workspace.project.serviceItems.findIndex((serviceItem) => serviceItem.id === selectedItem.id);
    const nextItem = nextProject.serviceItems[sourceIndex + 1] ?? null;
    pushProject(nextProject, "project:update", `${nextItem?.title ?? "Service item"} duplicated.`, {
      selected: getServiceItemFirstSlideRef(nextItem),
      live: workspace.live,
    });
  }

  function handleDeleteServiceItem() {
    if (!workspace.project || !selectedItem) {
      return;
    }

    const selectedFallback =
      workspace.selected?.serviceItemId === selectedItem.id
        ? getNextSlideRef(workspace.project, workspace.selected) ?? getPreviousSlideRef(workspace.project, workspace.selected)
        : workspace.selected;
    const liveFallback =
      workspace.live?.serviceItemId === selectedItem.id
        ? getNextSlideRef(workspace.project, workspace.live) ?? getPreviousSlideRef(workspace.project, workspace.live)
        : workspace.live;

    updateCurrentProject(
      (currentProject) => deleteServiceItem(currentProject, selectedItem.id),
      `${selectedItem.title} removed.`,
      {
        selected: selectedFallback,
        live: liveFallback,
      },
    );
  }

  function handleMoveServiceItem(direction: "up" | "down") {
    if (!selectedItem) {
      return;
    }

    updateCurrentProject(
      (currentProject) => moveServiceItem(currentProject, selectedItem.id, direction),
      direction === "up" ? "Service item moved up." : "Service item moved down.",
    );
  }

  function handleReplaceSongSlides() {
    if (!workspace.project || !selectedItem || selectedItem.type !== "song") {
      return;
    }

    if (!songDraftText.trim()) {
      setNotice("Paste song sections first.");
      return;
    }

    const nextProject = replaceSongSlidesFromText(workspace.project, selectedItem.id, songDraftText);
    const updatedItem = nextProject.serviceItems.find((serviceItem) => serviceItem.id === selectedItem.id) ?? null;
    const nextRef = getServiceItemFirstSlideRef(updatedItem);
    pushProject(nextProject, "project:update", `${selectedItem.title} lyrics imported.`, {
      selected: workspace.selected?.serviceItemId === selectedItem.id ? nextRef : workspace.selected,
      live: workspace.live?.serviceItemId === selectedItem.id ? nextRef : workspace.live,
    });
  }

  async function handleMediaFileChange(event: ChangeEvent<HTMLInputElement>, kind: "image" | "audio") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !workspace.project || !selectedEntry) {
      return;
    }

    const expectedPrefix = kind === "image" ? "image/" : "audio/";
    const maxBytes = kind === "image" ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
    if (!file.type.startsWith(expectedPrefix)) {
      setNotice(`Choose a valid ${kind} file.`);
      return;
    }

    if (file.size > maxBytes) {
      setNotice(`${kind === "image" ? "Images" : "Audio files"} must be smaller than ${maxBytes / 1024 / 1024} MB.`);
      return;
    }

    try {
      const optimizedImage = kind === "image" ? await optimizeSlideImage(file) : null;
      const dataUrl = optimizedImage?.dataUrl ?? (await readFileAsDataUrl(file));
      updateCurrentProject(
        (currentProject) =>
          updateSlideMedia(currentProject, selectedEntry.item.id, selectedEntry.slide.id, kind, {
            dataUrl,
            name: file.name,
            mimeType: optimizedImage?.mimeType ?? file.type,
          }),
        `${kind === "image" ? "Image" : "Audio"} added to ${selectedEntry.slide.title}.`,
      );
      setActiveEditorTool("select");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `Unable to add that ${kind}.`);
    }
  }

  function handleEditorToolChange(tool: SlideEditorTool) {
    if (!selectedEntry) {
      return;
    }

    setActiveEditorTool(tool);
    setEmojiPickerOpen(tool === "emoji" ? !emojiPickerOpen : false);

    if (tool === "text") {
      window.requestAnimationFrame(() => {
        slideBodyInputRef.current?.focus();
        slideBodyInputRef.current?.select();
      });
    } else if (tool === "image") {
      imageInputRef.current?.click();
    } else if (tool === "audio") {
      audioInputRef.current?.click();
    }
  }

  function handleChooseEmoji(emoji: string) {
    if (!selectedEntry) {
      return;
    }

    updateCurrentProject(
      (currentProject) =>
        updateSlide(currentProject, selectedEntry.item.id, selectedEntry.slide.id, {
          emoji,
        }),
      "Emoji added.",
    );
    setEmojiPickerOpen(false);
    setActiveEditorTool("select");
  }

  function handleRemoveSlideMedia(kind: "image" | "audio" | "emoji") {
    if (!selectedEntry) {
      return;
    }

    updateCurrentProject(
      (currentProject) =>
        updateSlide(currentProject, selectedEntry.item.id, selectedEntry.slide.id, {
          [kind]: undefined,
        }),
      `${kind === "emoji" ? "Emoji" : `${kind[0].toUpperCase()}${kind.slice(1)}`} removed.`,
    );
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

    if (selectedEntry.item.slides.length === 1) {
      setNotice("Each section needs at least one slide.");
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
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          void handleMediaFileChange(event, "image");
        }}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(event) => {
          void handleMediaFileChange(event, "audio");
        }}
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
                  Edit: "Use the inspector panel to update sections, slides, and text.",
                  View: "Open /display or /stage in separate tabs for live output routing.",
                  Output: "Display and stage reconnect automatically to the latest live state.",
                  Help: "Shortcuts: → next live · ← previous live · ↓ queue next · ↑ queue previous · Space or Enter go live · B blackout · L logo · Ctrl/Cmd+Z undo · Ctrl/Cmd+Shift+Z redo · Ctrl/Cmd+S export.",
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
                disabled={!project}
                onClick={() => handleAddServiceItem("custom", "New Section")}
                className="text-[10px] text-amber-400/50 transition-colors hover:text-amber-300 disabled:cursor-not-allowed disabled:text-[#2e3d50]"
              >
                + Section
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
                  onClick={() => {
                    if (project) {
                      handleAddServiceItem("custom", "New Section");
                    } else {
                      setStartPanelOpen(true);
                    }
                  }}
                  className="mt-2 text-[11px] text-amber-400/60 transition-colors hover:text-amber-300"
                >
                  {project ? "Add a section →" : "Create or open a project →"}
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

            <div className="relative min-h-0 flex-1 p-2">
              {selectedEntry ? (
                <>
                  <SlideEditorToolbar
                    activeTool={activeEditorTool}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    hasImage={Boolean(selectedEntry.slide.image)}
                    hasAudio={Boolean(selectedEntry.slide.audio)}
                    hasEmoji={Boolean(selectedEntry.slide.emoji)}
                    emojiPickerOpen={emojiPickerOpen}
                    onToolChange={handleEditorToolChange}
                    onChooseEmoji={handleChooseEmoji}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                  />
                  <SlideCanvas
                    slide={selectedEntry.slide}
                    compact
                    editable
                    onTextClick={() => handleEditorToolChange("text")}
                    className="h-full"
                    emptyStateLabel="Select the text tool to add copy"
                  />
                  <div className="pointer-events-none absolute bottom-4 left-4 z-[2] bg-black/45 px-2 py-1 text-[8px] font-bold tracking-[0.18em] text-white/35 uppercase">
                    Editor Preview
                  </div>
                </>
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
                {project ? (
                  <div className="px-3 py-2.5">
                    <FieldLabel>Project</FieldLabel>
                    <div className="mt-2 space-y-2">
                      <ChromeInput
                        value={project.name}
                        onChange={(event) =>
                          updateCurrentProject((currentProject) => ({
                            ...currentProject,
                            name: event.target.value,
                            updatedAt: new Date().toISOString(),
                          }))
                        }
                        placeholder="Project name"
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <CompactAction label="Open Display" onClick={() => openOutputWindow("/display")} />
                        <CompactAction label="Open Stage" onClick={() => openOutputWindow("/stage")} />
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="px-3 py-2.5">
                  <FieldLabel>New Section</FieldLabel>
                  <div className="mt-2 space-y-2">
                    <ChromeInput
                      value={newItemTitle}
                      onChange={(event) => setNewItemTitle(event.target.value)}
                      placeholder="Section name"
                    />
                    <ChromeSelect value={newItemType} onChange={(event) => setNewItemType(event.target.value as ServiceItemType)}>
                      {ITEM_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </ChromeSelect>
                    <CompactAction label="Add Section" onClick={() => handleAddServiceItem()} disabled={!project} accent />
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
                    <FieldLabel>Section</FieldLabel>
                    <div className="mt-2 space-y-2">
                      <ChromeInput
                        value={selectedItem.title}
                        onChange={(event) =>
                          updateCurrentProject((currentProject) => updateServiceItem(currentProject, selectedItem.id, { title: event.target.value }))
                        }
                        placeholder="Section title"
                      />
                      <ChromeInput
                        value={selectedItem.subtitle ?? ""}
                        onChange={(event) =>
                          updateCurrentProject((currentProject) =>
                            updateServiceItem(currentProject, selectedItem.id, { subtitle: event.target.value }),
                          )
                        }
                        placeholder="Subtitle / notes"
                      />
                      <div className="text-[10px] text-[#4a5a6e]">
                        {selectedItem.type.toUpperCase()} · {selectedItem.slides.length} slide{selectedItem.slides.length === 1 ? "" : "s"}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <CompactAction
                          label="Move Up"
                          onClick={() => handleMoveServiceItem("up")}
                          disabled={!project || selectedItem.orderIndex === 0}
                        />
                        <CompactAction
                          label="Move Down"
                          onClick={() => handleMoveServiceItem("down")}
                          disabled={!project || selectedItem.orderIndex === project.serviceItems.length - 1}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <CompactAction label="Duplicate" onClick={handleDuplicateServiceItem} disabled={!project} />
                        <CompactAction label="Delete Section" onClick={handleDeleteServiceItem} disabled={!project} />
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
                      {selectedItem.type === "song" ? (
                        <>
                          <ChromeTextArea
                            value={songDraftText}
                            onChange={(event) => setSongDraftText(event.target.value)}
                            className="min-h-[160px]"
                            placeholder={"[Verse 1]\nFirst lyric line\nSecond lyric line\n\n[Chorus]\nSing the chorus"}
                          />
                          <CompactAction label="Replace From Text" onClick={handleReplaceSongSlides} disabled={!project} accent />
                        </>
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
                        <CompactAction
                          label="Delete"
                          onClick={handleDeleteSlide}
                          disabled={!project || selectedEntry.item.slides.length === 1}
                        />
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
                        ref={slideBodyInputRef}
                        value={selectedEntry.slide.body}
                        onChange={(event) =>
                          updateCurrentProject(
                            (currentProject) =>
                              updateSlide(currentProject, selectedEntry.item.id, selectedEntry.slide.id, {
                                body: event.target.value,
                              }),
                            undefined,
                            undefined,
                            `slide-body:${selectedEntry.slide.id}`,
                          )
                        }
                        placeholder="Slide text"
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <ChromeSelect
                          value={selectedEntry.slide.align ?? "center"}
                          onChange={(event) =>
                            updateCurrentProject((currentProject) =>
                              updateSlide(currentProject, selectedEntry.item.id, selectedEntry.slide.id, {
                                align: event.target.value as SlideAlignment,
                              }),
                            )
                          }
                        >
                          {SLIDE_ALIGNMENT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              Align: {option.label}
                            </option>
                          ))}
                        </ChromeSelect>
                        <ChromeSelect
                          value={selectedEntry.slide.fontSize ?? "lg"}
                          onChange={(event) =>
                            updateCurrentProject((currentProject) =>
                              updateSlide(currentProject, selectedEntry.item.id, selectedEntry.slide.id, {
                                fontSize: event.target.value as SlideFontSize,
                              }),
                            )
                          }
                        >
                          {SLIDE_FONT_SIZE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              Size: {option.label}
                            </option>
                          ))}
                        </ChromeSelect>
                      </div>
                      <ChromeInput
                        value={selectedEntry.slide.footer ?? ""}
                        onChange={(event) =>
                          updateCurrentProject((currentProject) =>
                            updateSlide(currentProject, selectedEntry.item.id, selectedEntry.slide.id, {
                              footer: event.target.value,
                            }),
                          )
                        }
                        placeholder="Footer / lower-third"
                      />
                      <div className="border-t border-[#1e2835] pt-2">
                        <FieldLabel>Slide Media</FieldLabel>
                        <div className="mt-2 space-y-2">
                          {selectedEntry.slide.image ? (
                            <div className="flex items-center gap-2 border border-[#1e2835] bg-[#0b1119] p-2">
                              <img
                                src={selectedEntry.slide.image.dataUrl}
                                alt=""
                                className="h-10 w-14 flex-none object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[11px] text-[#c0ccd8]">{selectedEntry.slide.image.name}</div>
                                <div className="mt-0.5 text-[9px] tracking-wide text-[#4a5a6e] uppercase">Background image</div>
                              </div>
                              <CompactAction label="Remove" onClick={() => handleRemoveSlideMedia("image")} />
                            </div>
                          ) : (
                            <CompactAction label="Add Image" onClick={() => imageInputRef.current?.click()} />
                          )}

                          {selectedEntry.slide.audio ? (
                            <div className="border border-[#1e2835] bg-[#0b1119] p-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-[11px] text-[#c0ccd8]">{selectedEntry.slide.audio.name}</div>
                                  <div className="mt-0.5 text-[9px] tracking-wide text-[#4a5a6e] uppercase">Operator audio cue</div>
                                </div>
                                <CompactAction label="Remove" onClick={() => handleRemoveSlideMedia("audio")} />
                              </div>
                              <audio className="mt-2 h-8 w-full" controls src={selectedEntry.slide.audio.dataUrl} />
                            </div>
                          ) : (
                            <CompactAction label="Add Audio" onClick={() => audioInputRef.current?.click()} />
                          )}

                          {selectedEntry.slide.emoji ? (
                            <div className="flex items-center justify-between border border-[#1e2835] bg-[#0b1119] px-2.5 py-2">
                              <span className="text-2xl">{selectedEntry.slide.emoji}</span>
                              <CompactAction label="Remove Emoji" onClick={() => handleRemoveSlideMedia("emoji")} />
                            </div>
                          ) : null}
                        </div>
                      </div>
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
                  ["Queue next", "↓"],
                  ["Queue prev", "↑"],
                  ["Go Live", "Space / Enter"],
                  ["Blackout", "B"],
                  ["Logo", "L"],
                  ["Undo", "Ctrl/Cmd+Z"],
                  ["Redo", "Ctrl/Cmd+Shift+Z"],
                  ["Export", "Ctrl/Cmd+S"],
                  ["Open", "Ctrl/Cmd+O"],
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

            <div className="border-t border-[#161e2a] px-3 py-3">
              <FieldLabel>MIDI Control</FieldLabel>
              <div className="mt-2 space-y-2">
                <div className="text-[10px] text-[#4a5a6e]">
                  {midiControls.status === "unsupported"
                    ? "Web MIDI is not available in this browser."
                    : midiControls.status === "ready"
                      ? "Device input is active."
                      : midiControls.status === "requesting"
                        ? "Waiting for MIDI permission…"
                        : midiControls.status === "error"
                          ? "MIDI permission was denied."
                          : "Connect a foot pedal or controller for hands-free operation."}
                </div>
                {midiControls.status !== "unsupported" ? (
                  <>
                    <CompactAction
                      label={midiControls.status === "ready" ? "Reconnect MIDI" : "Enable MIDI"}
                      onClick={() => {
                        void midiControls.requestAccess();
                      }}
                      accent
                    />
                    <ChromeSelect
                      value={midiControls.selectedInputId ?? ""}
                      onChange={(event) => midiControls.selectInput(event.target.value)}
                      disabled={midiControls.inputs.length === 0}
                    >
                      {midiControls.inputs.length === 0 ? (
                        <option value="">No MIDI devices detected</option>
                      ) : (
                        midiControls.inputs.map((input) => (
                          <option key={input.id} value={input.id}>
                            {input.name}
                          </option>
                        ))
                      )}
                    </ChromeSelect>
                    <div className="space-y-1">
                      {(Object.keys(MIDI_ACTION_LABELS) as MidiAction[]).map((action) => (
                        <div key={action} className="border border-[#1e2835] bg-[#0b1119] px-2.5 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-[#c0ccd8]">{MIDI_ACTION_LABELS[action]}</span>
                            <div className="flex gap-1.5">
                              <CompactAction
                                label={midiControls.isLearning === action ? "Listening…" : "Learn"}
                                onClick={() => midiControls.setLearningAction(action)}
                                disabled={midiControls.status !== "ready" || !midiControls.selectedInputId}
                                accent={midiControls.isLearning === action}
                              />
                              <CompactAction
                                label="Clear"
                                onClick={() => midiControls.clearBinding(action)}
                                disabled={!midiControls.bindings[action]}
                              />
                            </div>
                          </div>
                          <div className="mt-1 text-[10px] text-[#4a5a6e]">{formatMidiBinding(midiControls.bindings[action])}</div>
                        </div>
                      ))}
                    </div>
                    {midiControls.lastMessage ? (
                      <div className="text-[10px] text-[#2e3d50]">Last MIDI: {midiControls.lastMessage}</div>
                    ) : null}
                  </>
                ) : null}
              </div>
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
        onCreateBlank={() => {
          const blank = createBlankProject();
          loadProject(blank, `${blank.name} created.`);
        }}
        onCreateSundayService={() => {
          const serviceProject = createSundayServiceTemplate();
          loadProject(serviceProject, `${serviceProject.name} template created.`);
        }}
        onOpenRecentProject={(recentProject) => loadProject(recentProject.project, `${recentProject.name} reopened.`)}
        onLearnAction={(topic) => setNotice(topic)}
      />
    </div>
  );
}
