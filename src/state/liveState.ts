import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { PandaSlidesProject, ProjectItem, Slide } from "../types/project";
import { normalizeProject } from "../utils/projectStorage";

export type SlidePointer = {
  itemIndex: number;
  slideIndex: number;
};

export type LiveState = {
  service: PandaSlidesProject;
  selected: SlidePointer;
  live: SlidePointer;
  blackout: boolean;
  logo: boolean;
};

export type LocalWorkspaceState = {
  service: PandaSlidesProject | null;
  selected: SlidePointer | null;
  live: SlidePointer | null;
  blackout: boolean;
  logo: boolean;
};

export type ResolvedSlide = {
  item: ProjectItem;
  slide: Slide;
  pointer: SlidePointer;
};

export type OperatorAction =
  | { type: "select"; payload: SlidePointer }
  | { type: "goLive"; payload?: SlidePointer }
  | { type: "next" }
  | { type: "previous" }
  | { type: "toggleBlackout" }
  | { type: "toggleLogo" };

const socketUrl = import.meta.env.VITE_SOCKET_URL;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
const localWorkspaceKey = "pandaslides.local-workspace-state";
const localWorkspaceEvent = "pandaslides:workspace-state";

let socketSingleton: Socket | null = null;

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

export function resolveSlide(service: PandaSlidesProject, pointer: SlidePointer): ResolvedSlide {
  const item = service.items[pointer.itemIndex];
  const slide = item.slides[pointer.slideIndex];

  return {
    item,
    slide,
    pointer,
  };
}

export function flattenSlides(service: PandaSlidesProject) {
  return service.items.flatMap((item, itemIndex) =>
    item.slides.map((slide, slideIndex) => ({
      item,
      slide,
      pointer: { itemIndex, slideIndex },
    })),
  );
}

export function getNextPointer(service: PandaSlidesProject, pointer: SlidePointer) {
  const flatSlides = flattenSlides(service);
  const currentIndex = flatSlides.findIndex(
    (entry) => entry.pointer.itemIndex === pointer.itemIndex && entry.pointer.slideIndex === pointer.slideIndex,
  );

  if (currentIndex === -1) {
    return pointer;
  }

  return flatSlides[Math.min(currentIndex + 1, flatSlides.length - 1)].pointer;
}

export function getPreviousPointer(service: PandaSlidesProject, pointer: SlidePointer) {
  const flatSlides = flattenSlides(service);
  const currentIndex = flatSlides.findIndex(
    (entry) => entry.pointer.itemIndex === pointer.itemIndex && entry.pointer.slideIndex === pointer.slideIndex,
  );

  if (currentIndex === -1) {
    return pointer;
  }

  return flatSlides[Math.max(currentIndex - 1, 0)].pointer;
}

export function getFirstPointer(service: PandaSlidesProject) {
  const firstItem = service.items.find((item) => item.slides.length > 0);

  if (!firstItem) {
    return null;
  }

  const itemIndex = service.items.findIndex((item) => item.id === firstItem.id);
  return {
    itemIndex,
    slideIndex: 0,
  };
}

export function isValidPointer(service: PandaSlidesProject, pointer: SlidePointer | null) {
  if (!pointer) {
    return false;
  }

  return Boolean(service.items[pointer.itemIndex]?.slides[pointer.slideIndex]);
}

export function loadLocalWorkspaceState() {
  if (typeof window === "undefined") {
    return null as LocalWorkspaceState | null;
  }

  try {
    const raw = window.localStorage.getItem(localWorkspaceKey);
    if (!raw) {
      return null as LocalWorkspaceState | null;
    }

    const parsed = JSON.parse(raw) as LocalWorkspaceState & { service: unknown };
    const service = parsed.service ? normalizeProject(parsed.service) : null;
    const selected = service && isValidPointer(service, parsed.selected) ? parsed.selected : null;
    const live = service && isValidPointer(service, parsed.live) ? parsed.live : null;

    return {
      service,
      selected,
      live,
      blackout: Boolean(parsed.blackout),
      logo: Boolean(parsed.logo),
    };
  } catch {
    return null as LocalWorkspaceState | null;
  }
}

export function saveLocalWorkspaceState(state: LocalWorkspaceState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(localWorkspaceKey, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(localWorkspaceEvent));
}

export function useLocalWorkspaceState() {
  const [state, setState] = useState<LocalWorkspaceState | null>(() => loadLocalWorkspaceState());

  useEffect(() => {
    function syncState() {
      setState(loadLocalWorkspaceState());
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === localWorkspaceKey) {
        syncState();
      }
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener(localWorkspaceEvent, syncState);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(localWorkspaceEvent, syncState);
    };
  }, []);

  return state;
}

export function useLiveStateConnection() {
  const [state, setState] = useState<LiveState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const socket = getSocket();

    async function loadState() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/state`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load live state (${response.status})`);
        }

        const nextState = (await response.json()) as LiveState;
        setState(nextState);
      } catch (loadError) {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(loadError instanceof Error ? loadError.message : "Unable to connect to the PandaSlides server");
        }
      } finally {
        setLoading(false);
      }
    }

    function handleStateUpdate(nextState: LiveState) {
      setState(nextState);
      setError(null);
      setLoading(false);
    }

    loadState();
    socket.on("live-state:update", handleStateUpdate);

    return () => {
      controller.abort();
      socket.off("live-state:update", handleStateUpdate);
    };
  }, []);

  return { state, setState, loading, error };
}
