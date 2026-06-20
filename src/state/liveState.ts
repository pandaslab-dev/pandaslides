import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { PandaSlidesProject, ServiceItem, Slide } from "../types/project";
import { normalizeProject } from "../utils/projectStorage";

export type SlideRef = {
  serviceItemId: string;
  slideId: string;
};

export type OutputMode = "live" | "blackout" | "logo";

export type WorkspaceState = {
  project: PandaSlidesProject | null;
  selected: SlideRef | null;
  live: SlideRef | null;
  mode: OutputMode;
  updatedAt: string;
};

export type ResolvedSlide = {
  item: ServiceItem;
  slide: Slide;
  ref: SlideRef;
  itemIndex: number;
  slideIndex: number;
  flatIndex: number;
  totalSlides: number;
};

export type LiveStateSnapshot = {
  project: PandaSlidesProject | null;
  selected: ResolvedSlide | null;
  live: ResolvedSlide | null;
  next: ResolvedSlide | null;
  currentServiceItem: ServiceItem | null;
  mode: OutputMode;
  slidePosition: { current: number; total: number } | null;
  updatedAt: string;
};

export type ProjectMutationPayload = {
  project: PandaSlidesProject;
  selected?: SlideRef | null;
  live?: SlideRef | null;
  mode?: OutputMode;
};

const socketUrl = import.meta.env.VITE_SOCKET_URL;
const localWorkspaceKey = "pandaslides.operator-workspace-state";
const localWorkspaceEvent = "pandaslides:workspace-state";

let socketSingleton: Socket | null = null;

function nowIsoString() {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isOutputMode(value: unknown): value is OutputMode {
  return value === "live" || value === "blackout" || value === "logo";
}

export function getSocket() {
  if (!socketSingleton) {
    socketSingleton = socketUrl
      ? io(socketUrl, {
          transports: ["websocket"],
        })
      : io({
          transports: ["websocket"],
        });
  }

  return socketSingleton;
}

export function createEmptyWorkspaceState(): WorkspaceState {
  return {
    project: null,
    selected: null,
    live: null,
    mode: "live",
    updatedAt: nowIsoString(),
  };
}

export function flattenSlides(project: PandaSlidesProject) {
  return project.serviceItems.flatMap((item, itemIndex) =>
    item.slides.map((slide, slideIndex) => ({
      item,
      slide,
      ref: { serviceItemId: item.id, slideId: slide.id },
      itemIndex,
      slideIndex,
    })),
  );
}

export function isValidSlideRef(project: PandaSlidesProject, slideRef: SlideRef | null) {
  if (!slideRef) {
    return false;
  }

  return project.serviceItems.some(
    (item) => item.id === slideRef.serviceItemId && item.slides.some((slide) => slide.id === slideRef.slideId),
  );
}

export function getFirstSlideRef(project: PandaSlidesProject) {
  const firstItem = project.serviceItems.find((item) => item.slides.length > 0);
  const firstSlide = firstItem?.slides[0];

  if (!firstItem || !firstSlide) {
    return null as SlideRef | null;
  }

  return {
    serviceItemId: firstItem.id,
    slideId: firstSlide.id,
  };
}

export function resolveSlide(project: PandaSlidesProject, slideRef: SlideRef | null) {
  if (!slideRef) {
    return null as ResolvedSlide | null;
  }

  const flatSlides = flattenSlides(project);
  const flatIndex = flatSlides.findIndex(
    (entry) => entry.ref.serviceItemId === slideRef.serviceItemId && entry.ref.slideId === slideRef.slideId,
  );

  if (flatIndex === -1) {
    return null as ResolvedSlide | null;
  }

  const entry = flatSlides[flatIndex];

  return {
    ...entry,
    flatIndex,
    totalSlides: flatSlides.length,
  };
}

export function getNextSlideRef(project: PandaSlidesProject, slideRef: SlideRef | null) {
  const resolved = resolveSlide(project, slideRef);
  if (!resolved) {
    return null as SlideRef | null;
  }

  const flatSlides = flattenSlides(project);
  return flatSlides[resolved.flatIndex + 1]?.ref ?? null;
}

export function getPreviousSlideRef(project: PandaSlidesProject, slideRef: SlideRef | null) {
  const resolved = resolveSlide(project, slideRef);
  if (!resolved) {
    return null as SlideRef | null;
  }

  const flatSlides = flattenSlides(project);
  return flatSlides[resolved.flatIndex - 1]?.ref ?? null;
}

export function coerceWorkspaceState(state: WorkspaceState): WorkspaceState {
  if (!state.project) {
    return {
      ...createEmptyWorkspaceState(),
      updatedAt: state.updatedAt || nowIsoString(),
    };
  }

  const firstRef = getFirstSlideRef(state.project);
  const selected = isValidSlideRef(state.project, state.selected) ? state.selected : firstRef;
  const live = isValidSlideRef(state.project, state.live) ? state.live : selected;

  return {
    project: state.project,
    selected,
    live,
    mode: isOutputMode(state.mode) ? state.mode : "live",
    updatedAt: state.updatedAt || nowIsoString(),
  };
}

export function createWorkspaceStateFromProject(
  project: PandaSlidesProject,
  options?: Partial<Pick<WorkspaceState, "selected" | "live" | "mode">>,
) {
  const firstRef = getFirstSlideRef(project);
  return coerceWorkspaceState({
    project,
    selected: options?.selected ?? firstRef,
    live: options?.live ?? options?.selected ?? firstRef,
    mode: options?.mode ?? "live",
    updatedAt: nowIsoString(),
  });
}

export function selectSlide(state: WorkspaceState, slideRef: SlideRef) {
  if (!state.project || !isValidSlideRef(state.project, slideRef)) {
    return state;
  }

  return {
    ...state,
    selected: slideRef,
    updatedAt: nowIsoString(),
  };
}

export function goLive(state: WorkspaceState, slideRef?: SlideRef | null) {
  if (!state.project) {
    return state;
  }

  const nextRef = slideRef ?? state.selected;
  if (!nextRef || !isValidSlideRef(state.project, nextRef)) {
    return state;
  }

  return {
    ...state,
    selected: nextRef,
    live: nextRef,
    updatedAt: nowIsoString(),
  };
}

export function moveLive(state: WorkspaceState, direction: "next" | "previous") {
  if (!state.project) {
    return state;
  }

  const currentRef = state.live ?? state.selected ?? getFirstSlideRef(state.project);
  const adjacentRef =
    direction === "next" ? getNextSlideRef(state.project, currentRef) : getPreviousSlideRef(state.project, currentRef);

  if (!adjacentRef) {
    return state;
  }

  return {
    ...state,
    selected: adjacentRef,
    live: adjacentRef,
    updatedAt: nowIsoString(),
  };
}

export function setOutputMode(state: WorkspaceState, mode: OutputMode) {
  return {
    ...state,
    mode,
    updatedAt: nowIsoString(),
  };
}

export function applyProjectToWorkspace(state: WorkspaceState, payload: ProjectMutationPayload) {
  return createWorkspaceStateFromProject(payload.project, {
    selected: payload.selected ?? state.selected,
    live: payload.live ?? state.live,
    mode: payload.mode ?? state.mode,
  });
}

export function buildLiveStateSnapshot(state: WorkspaceState | null): LiveStateSnapshot {
  const workspace = state ? coerceWorkspaceState(state) : createEmptyWorkspaceState();
  const project = workspace.project;

  if (!project) {
    return {
      project: null,
      selected: null,
      live: null,
      next: null,
      currentServiceItem: null,
      mode: workspace.mode,
      slidePosition: null,
      updatedAt: workspace.updatedAt,
    };
  }

  const selected = resolveSlide(project, workspace.selected);
  const live = resolveSlide(project, workspace.live);
  const next = resolveSlide(project, getNextSlideRef(project, workspace.live));
  const currentServiceItem = live?.item ?? selected?.item ?? null;

  return {
    project,
    selected,
    live,
    next,
    currentServiceItem,
    mode: workspace.mode,
    slidePosition: live ? { current: live.flatIndex + 1, total: live.totalSlides } : null,
    updatedAt: workspace.updatedAt,
  };
}

export function normalizeWorkspaceState(input: unknown) {
  if (!isRecord(input)) {
    return createEmptyWorkspaceState();
  }

  const project = input.project ? normalizeProject(input.project) : null;
  const selected =
    isRecord(input.selected) && typeof input.selected.serviceItemId === "string" && typeof input.selected.slideId === "string"
      ? {
          serviceItemId: input.selected.serviceItemId,
          slideId: input.selected.slideId,
        }
      : null;
  const live =
    isRecord(input.live) && typeof input.live.serviceItemId === "string" && typeof input.live.slideId === "string"
      ? {
          serviceItemId: input.live.serviceItemId,
          slideId: input.live.slideId,
        }
      : null;

  return coerceWorkspaceState({
    project,
    selected,
    live,
    mode: isOutputMode(input.mode) ? input.mode : "live",
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : nowIsoString(),
  });
}

export function loadLocalWorkspaceState() {
  if (typeof window === "undefined") {
    return null as WorkspaceState | null;
  }

  try {
    const raw = window.localStorage.getItem(localWorkspaceKey);
    if (!raw) {
      return null as WorkspaceState | null;
    }

    return normalizeWorkspaceState(JSON.parse(raw));
  } catch {
    return null as WorkspaceState | null;
  }
}

export function saveLocalWorkspaceState(state: WorkspaceState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(localWorkspaceKey, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(localWorkspaceEvent));
  } catch {
    // Embedded media may exceed localStorage, but remains available from the live server and project export.
  }
}

export function useLiveStateConnection() {
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();

    function requestState() {
      socket.emit("live:getState");
    }

    function handleWorkspaceUpdate(nextState: unknown) {
      try {
        const normalized = normalizeWorkspaceState(nextState);
        setWorkspace(normalized);
        setError(null);
      } catch (stateError) {
        setError(stateError instanceof Error ? stateError.message : "Unable to read PandaSlides state.");
      } finally {
        setLoading(false);
      }
    }

    function handleConnectionError(connectionError: Error) {
      setError(connectionError.message || "Unable to connect to the PandaSlides server.");
      setLoading(false);
    }

    function handleDisconnect() {
      setError("Disconnected from the PandaSlides server.");
    }

    socket.on("connect", requestState);
    socket.on("connect_error", handleConnectionError);
    socket.on("disconnect", handleDisconnect);
    socket.on("live:state", handleWorkspaceUpdate);
    socket.on("project:loaded", handleWorkspaceUpdate);
    socket.on("project:updated", handleWorkspaceUpdate);
    socket.on("live:slideChanged", handleWorkspaceUpdate);
    socket.on("live:modeChanged", handleWorkspaceUpdate);

    requestState();

    return () => {
      socket.off("connect", requestState);
      socket.off("connect_error", handleConnectionError);
      socket.off("disconnect", handleDisconnect);
      socket.off("live:state", handleWorkspaceUpdate);
      socket.off("project:loaded", handleWorkspaceUpdate);
      socket.off("project:updated", handleWorkspaceUpdate);
      socket.off("live:slideChanged", handleWorkspaceUpdate);
      socket.off("live:modeChanged", handleWorkspaceUpdate);
    };
  }, []);

  return {
    workspace,
    snapshot: buildLiveStateSnapshot(workspace),
    loading,
    error,
  };
}
