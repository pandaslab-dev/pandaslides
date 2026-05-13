import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";

const PROJECT_KINDS = new Set(["blank", "service", "event", "song-set", "demo", "custom"]);
const SERVICE_ITEM_TYPES = new Set(["welcome", "song", "scripture", "message", "announcement", "closing", "custom"]);
const SLIDE_ALIGNMENTS = new Set(["left", "center", "right"]);
const SLIDE_FONT_SIZES = new Set(["sm", "md", "lg", "xl"]);

function nowIsoString() {
  return new Date().toISOString();
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object";
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidMode(value) {
  return value === "live" || value === "blackout" || value === "logo";
}

function normalizeSlide(slide, slideIndex) {
  if (!isRecord(slide)) {
    throw new Error(`Slide ${slideIndex + 1} is not a valid object.`);
  }

  if (!isNonEmptyString(slide.id)) {
    throw new Error(`Slide ${slideIndex + 1} is missing a valid id.`);
  }

  if (!isNonEmptyString(slide.title)) {
    throw new Error(`Slide ${slideIndex + 1} is missing a title.`);
  }

  if (typeof slide.body !== "string") {
    throw new Error(`Slide ${slideIndex + 1} is missing body text.`);
  }

  if (typeof slide.orderIndex !== "number" || Number.isNaN(slide.orderIndex)) {
    throw new Error(`Slide ${slideIndex + 1} is missing a valid orderIndex.`);
  }

  return {
    id: slide.id.trim(),
    title: slide.title.trim(),
    body: slide.body.replace(/\r\n/g, "\n"),
    orderIndex: slide.orderIndex,
    align: SLIDE_ALIGNMENTS.has(slide.align) ? slide.align : "center",
    fontSize: SLIDE_FONT_SIZES.has(slide.fontSize) ? slide.fontSize : "lg",
    footer: isNonEmptyString(slide.footer) ? slide.footer.trim() : undefined,
  };
}

function normalizeServiceItem(item, itemIndex) {
  if (!isRecord(item)) {
    throw new Error(`Service item ${itemIndex + 1} is not a valid object.`);
  }

  if (!isNonEmptyString(item.id)) {
    throw new Error(`Service item ${itemIndex + 1} is missing a valid id.`);
  }

  if (!isNonEmptyString(item.title)) {
    throw new Error(`Service item ${itemIndex + 1} is missing a title.`);
  }

  if (!SERVICE_ITEM_TYPES.has(item.type)) {
    throw new Error(`Service item ${itemIndex + 1} has an invalid type.`);
  }

  if (typeof item.orderIndex !== "number" || Number.isNaN(item.orderIndex)) {
    throw new Error(`Service item ${itemIndex + 1} is missing a valid orderIndex.`);
  }

  if (!Array.isArray(item.slides)) {
    throw new Error(`Service item ${itemIndex + 1} is missing slides.`);
  }

  return {
    id: item.id.trim(),
    title: item.title.trim(),
    type: item.type,
    orderIndex: item.orderIndex,
    subtitle: isNonEmptyString(item.subtitle) ? item.subtitle.trim() : undefined,
    slides: item.slides.map((slide, slideIndex) => normalizeSlide(slide, slideIndex)).sort((left, right) => left.orderIndex - right.orderIndex),
  };
}

function normalizeProject(project) {
  if (!isRecord(project)) {
    throw new Error("Project payload is invalid.");
  }

  if (!isNonEmptyString(project.id)) {
    throw new Error("Project is missing a valid id.");
  }

  if (!isNonEmptyString(project.name)) {
    throw new Error("Project is missing a valid name.");
  }

  if (typeof project.schemaVersion !== "number" || Number.isNaN(project.schemaVersion)) {
    throw new Error("Project is missing a valid schemaVersion.");
  }

  if (!Array.isArray(project.serviceItems)) {
    throw new Error("Project is missing serviceItems.");
  }

  return {
    id: project.id.trim(),
    name: project.name.trim(),
    schemaVersion: project.schemaVersion,
    kind: PROJECT_KINDS.has(project.kind) ? project.kind : "custom",
    updatedAt: isNonEmptyString(project.updatedAt) ? project.updatedAt : nowIsoString(),
    serviceItems: project.serviceItems
      .map((item, itemIndex) => normalizeServiceItem(item, itemIndex))
      .sort((left, right) => left.orderIndex - right.orderIndex),
  };
}

function flattenSlides(project) {
  return project.serviceItems.flatMap((item) =>
    item.slides.map((slide) => ({
      item,
      slide,
      ref: { serviceItemId: item.id, slideId: slide.id },
    })),
  );
}

function isValidSlideRef(project, slideRef) {
  if (!project || !isRecord(slideRef)) {
    return false;
  }

  return project.serviceItems.some(
    (item) => item.id === slideRef.serviceItemId && item.slides.some((slide) => slide.id === slideRef.slideId),
  );
}

function getFirstSlideRef(project) {
  const firstItem = project?.serviceItems.find((item) => item.slides.length > 0);
  const firstSlide = firstItem?.slides[0];

  if (!firstItem || !firstSlide) {
    return null;
  }

  return {
    serviceItemId: firstItem.id,
    slideId: firstSlide.id,
  };
}

function resolveSlideIndex(project, slideRef) {
  if (!project || !slideRef) {
    return -1;
  }

  return flattenSlides(project).findIndex(
    (entry) => entry.ref.serviceItemId === slideRef.serviceItemId && entry.ref.slideId === slideRef.slideId,
  );
}

function getAdjacentSlideRef(project, slideRef, direction) {
  const flatSlides = flattenSlides(project);
  const currentIndex = resolveSlideIndex(project, slideRef);

  if (currentIndex === -1) {
    return null;
  }

  const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
  return flatSlides[nextIndex]?.ref ?? null;
}

function coerceWorkspaceState(nextState) {
  if (!nextState.project) {
    return {
      project: null,
      selected: null,
      live: null,
      mode: isValidMode(nextState.mode) ? nextState.mode : "live",
      updatedAt: nextState.updatedAt || nowIsoString(),
    };
  }

  const firstRef = getFirstSlideRef(nextState.project);
  const selected = isValidSlideRef(nextState.project, nextState.selected) ? nextState.selected : firstRef;
  const live = isValidSlideRef(nextState.project, nextState.live) ? nextState.live : selected;

  return {
    project: nextState.project,
    selected,
    live,
    mode: isValidMode(nextState.mode) ? nextState.mode : "live",
    updatedAt: nextState.updatedAt || nowIsoString(),
  };
}

function createWorkspaceStateFromProject(project, options = {}) {
  const firstRef = getFirstSlideRef(project);
  return coerceWorkspaceState({
    project,
    selected: options.selected ?? firstRef,
    live: options.live ?? options.selected ?? firstRef,
    mode: options.mode ?? "live",
    updatedAt: nowIsoString(),
  });
}

function emitError(socket, message) {
  socket.emit("error", { message });
}

let workspaceState = {
  project: null,
  selected: null,
  live: null,
  mode: "live",
  updatedAt: nowIsoString(),
};

function broadcastState(eventName) {
  io.emit(eventName, workspaceState);

  if (eventName !== "live:state") {
    io.emit("live:state", workspaceState);
  }
}

function updateProject(projectPayload, options = {}) {
  const project = normalizeProject(projectPayload);
  workspaceState = createWorkspaceStateFromProject(project, options);
  return workspaceState;
}

function selectSlide(slideRef) {
  if (!workspaceState.project || !isValidSlideRef(workspaceState.project, slideRef)) {
    return false;
  }

  workspaceState = {
    ...workspaceState,
    selected: slideRef,
    updatedAt: nowIsoString(),
  };
  return true;
}

function goLive(slideRef) {
  if (!workspaceState.project) {
    return false;
  }

  const nextRef = slideRef ?? workspaceState.selected;
  if (!nextRef || !isValidSlideRef(workspaceState.project, nextRef)) {
    return false;
  }

  workspaceState = {
    ...workspaceState,
    selected: nextRef,
    live: nextRef,
    updatedAt: nowIsoString(),
  };
  return true;
}

function moveLive(direction) {
  if (!workspaceState.project) {
    return false;
  }

  const currentRef = workspaceState.live ?? workspaceState.selected ?? getFirstSlideRef(workspaceState.project);
  const nextRef = getAdjacentSlideRef(workspaceState.project, currentRef, direction);
  if (!nextRef) {
    return false;
  }

  workspaceState = {
    ...workspaceState,
    selected: nextRef,
    live: nextRef,
    updatedAt: nowIsoString(),
  };
  return true;
}

function setMode(mode) {
  if (!isValidMode(mode)) {
    return false;
  }

  workspaceState = {
    ...workspaceState,
    mode,
    updatedAt: nowIsoString(),
  };
  return true;
}

function updateActiveProject(payload) {
  if (!isRecord(payload) || !payload.project) {
    throw new Error("Project update payload is invalid.");
  }

  const project = normalizeProject(payload.project);
  workspaceState = createWorkspaceStateFromProject(project, {
    selected: isValidSlideRef(project, payload.selected) ? payload.selected : workspaceState.selected,
    live: isValidSlideRef(project, payload.live) ? payload.live : workspaceState.live,
    mode: isValidMode(payload.mode) ? payload.mode : workspaceState.mode,
  });
  return workspaceState;
}

const app = express();
const httpServer = createServer(app);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../dist");
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? true : ["http://localhost:5173"],
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

app.get("/api/service", (_request, response) => {
  response.json(workspaceState.project);
});

app.get("/api/state", (_request, response) => {
  response.json(workspaceState);
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(distDir));

  app.get("/{*path}", (_request, response) => {
    response.sendFile(path.join(distDir, "index.html"));
  });
}

io.on("connection", (socket) => {
  socket.on("live:getState", () => {
    socket.emit("live:state", workspaceState);
  });

  socket.on("project:load", (payload) => {
    try {
      if (!isRecord(payload) || !payload.project) {
        throw new Error("Project load payload is invalid.");
      }

      updateProject(payload.project, {
        selected: payload.selected,
        live: payload.live,
        mode: payload.mode,
      });
      broadcastState("project:loaded");
    } catch (error) {
      emitError(socket, error instanceof Error ? error.message : "Unable to load project.");
    }
  });

  socket.on("project:update", (payload) => {
    try {
      updateActiveProject(payload);
      broadcastState("project:updated");
    } catch (error) {
      emitError(socket, error instanceof Error ? error.message : "Unable to update project.");
    }
  });

  socket.on("live:select", (slideRef) => {
    if (!selectSlide(slideRef)) {
      emitError(socket, "Unable to select that slide.");
      return;
    }

    broadcastState("live:state");
  });

  socket.on("live:goToSlide", (slideRef) => {
    if (!goLive(slideRef)) {
      emitError(socket, "Unable to send that slide live.");
      return;
    }

    broadcastState("live:slideChanged");
  });

  socket.on("live:next", () => {
    if (!moveLive("next")) {
      socket.emit("live:state", workspaceState);
      return;
    }

    broadcastState("live:slideChanged");
  });

  socket.on("live:previous", () => {
    if (!moveLive("previous")) {
      socket.emit("live:state", workspaceState);
      return;
    }

    broadcastState("live:slideChanged");
  });

  socket.on("live:setMode", (payload) => {
    const mode = isRecord(payload) ? payload.mode : payload;
    if (!setMode(mode)) {
      emitError(socket, "Unable to change the output mode.");
      return;
    }

    broadcastState("live:modeChanged");
  });
});

const port = Number(process.env.PORT ?? 3001);

httpServer.listen(port, () => {
  console.log(`PandaSlides server listening on http://localhost:${port}`);
});
