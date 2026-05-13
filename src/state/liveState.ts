import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ServiceData, ServiceItem, Slide } from "../data/demoService";

export type SlidePointer = {
  itemIndex: number;
  slideIndex: number;
};

export type LiveState = {
  service: ServiceData;
  selected: SlidePointer;
  live: SlidePointer;
  blackout: boolean;
  logo: boolean;
};

export type ResolvedSlide = {
  item: ServiceItem;
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

export function resolveSlide(service: ServiceData, pointer: SlidePointer): ResolvedSlide {
  const item = service.items[pointer.itemIndex];
  const slide = item.slides[pointer.slideIndex];

  return {
    item,
    slide,
    pointer,
  };
}

export function flattenSlides(service: ServiceData) {
  return service.items.flatMap((item, itemIndex) =>
    item.slides.map((slide, slideIndex) => ({
      item,
      slide,
      pointer: { itemIndex, slideIndex },
    })),
  );
}

export function getNextPointer(service: ServiceData, pointer: SlidePointer) {
  const flatSlides = flattenSlides(service);
  const currentIndex = flatSlides.findIndex(
    (entry) => entry.pointer.itemIndex === pointer.itemIndex && entry.pointer.slideIndex === pointer.slideIndex,
  );

  if (currentIndex === -1) {
    return pointer;
  }

  return flatSlides[Math.min(currentIndex + 1, flatSlides.length - 1)].pointer;
}

export function getPreviousPointer(service: ServiceData, pointer: SlidePointer) {
  const flatSlides = flattenSlides(service);
  const currentIndex = flatSlides.findIndex(
    (entry) => entry.pointer.itemIndex === pointer.itemIndex && entry.pointer.slideIndex === pointer.slideIndex,
  );

  if (currentIndex === -1) {
    return pointer;
  }

  return flatSlides[Math.max(currentIndex - 1, 0)].pointer;
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
