import type { PandaSlidesProject, ProjectItem, ProjectKind, ProjectItemType, Slide } from "../types/project";

const RECENT_PROJECTS_KEY = "pandaslides.recent-projects";
const HIDE_START_PANEL_KEY = "pandaslides.hide-start-panel";
const MAX_RECENT_PROJECTS = 6;

export type RecentProjectRecord = {
  id: string;
  name: string;
  kind: ProjectKind;
  updatedAt: string;
  typeLabel: string;
  project: PandaSlidesProject;
};

function nowIsoString() {
  return new Date().toISOString();
}

function createProjectId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function isProjectItemType(value: unknown): value is ProjectItemType {
  return typeof value === "string" && ["intro", "song", "scripture", "sermon", "announcements", "closing", "general"].includes(value);
}

function isSlide(value: unknown): value is Slide {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as Slide).id === "string" &&
      typeof (value as Slide).label === "string" &&
      Array.isArray((value as Slide).lines) &&
      (value as Slide).lines.every((line) => typeof line === "string") &&
      ((value as Slide).footer === undefined || typeof (value as Slide).footer === "string"),
  );
}

function isProjectItem(value: unknown): value is ProjectItem {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as ProjectItem).id === "string" &&
      typeof (value as ProjectItem).title === "string" &&
      isProjectItemType((value as ProjectItem).type) &&
      ((value as ProjectItem).subtitle === undefined || typeof (value as ProjectItem).subtitle === "string") &&
      Array.isArray((value as ProjectItem).slides) &&
      (value as ProjectItem).slides.every((slide) => isSlide(slide)),
  );
}

export function getProjectKindLabel(kind: ProjectKind) {
  switch (kind) {
    case "blank":
      return "Blank";
    case "service":
      return "Service";
    case "event":
      return "Event";
    case "song-set":
      return "Song Set";
    case "demo":
      return "Demo";
    default:
      return "Project";
  }
}

export function normalizeProject(input: unknown, fallbackName?: string) {
  if (!input || typeof input !== "object") {
    throw new Error("Project file is not a valid PandaSlides project.");
  }

  const raw = input as Partial<PandaSlidesProject> & { items?: unknown };
  if (typeof raw.title !== "string" || raw.title.trim().length === 0) {
    throw new Error("Project title is missing.");
  }

  if (!Array.isArray(raw.items) || !raw.items.every((item) => isProjectItem(item))) {
    throw new Error("Project items are missing or invalid.");
  }

  const fallbackTitle = fallbackName?.replace(/\.pandaslides$/i, "").replace(/\.json$/i, "").trim();
  const kind = typeof raw.kind === "string" ? raw.kind : "custom";

  return {
    id: typeof raw.id === "string" && raw.id.length > 0 ? raw.id : createProjectId("project"),
    title: raw.title.trim() || fallbackTitle || "Imported Project",
    kind: ["blank", "service", "event", "song-set", "demo", "custom"].includes(kind) ? (kind as ProjectKind) : "custom",
    updatedAt: typeof raw.updatedAt === "string" && raw.updatedAt.length > 0 ? raw.updatedAt : nowIsoString(),
    items: raw.items.map((item) => ({
      ...item,
      slides: item.slides.map((slide) => ({
        ...slide,
        lines: [...slide.lines],
      })),
    })),
  } satisfies PandaSlidesProject;
}

export function parseProjectFileContents(contents: string, fallbackName?: string) {
  try {
    const parsed = JSON.parse(contents);
    return normalizeProject(parsed, fallbackName);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Project file could not be parsed. Make sure it is valid JSON.");
    }

    throw error;
  }
}

export function loadRecentProjects() {
  if (typeof window === "undefined") {
    return [] as RecentProjectRecord[];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_PROJECTS_KEY);
    if (!raw) {
      return [] as RecentProjectRecord[];
    }

    const parsed = JSON.parse(raw) as RecentProjectRecord[];
    if (!Array.isArray(parsed)) {
      return [] as RecentProjectRecord[];
    }

    return parsed
      .map((entry) => ({
        ...entry,
        project: normalizeProject(entry.project, entry.name),
        typeLabel: entry.typeLabel ?? getProjectKindLabel(normalizeProject(entry.project, entry.name).kind),
      }))
      .slice(0, MAX_RECENT_PROJECTS);
  } catch {
    return [] as RecentProjectRecord[];
  }
}

export function saveRecentProject(project: PandaSlidesProject) {
  if (typeof window === "undefined") {
    return [] as RecentProjectRecord[];
  }

  const nextEntry: RecentProjectRecord = {
    id: project.id,
    name: project.title,
    kind: project.kind,
    updatedAt: project.updatedAt,
    typeLabel: getProjectKindLabel(project.kind),
    project,
  };

  const nextList = [nextEntry, ...loadRecentProjects().filter((entry) => entry.id !== project.id)].slice(0, MAX_RECENT_PROJECTS);
  window.localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(nextList));
  return nextList;
}

export function getProjectDownloadName(project: PandaSlidesProject) {
  return `${project.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "pandaslides-project"}.pandaslides`;
}

export function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function readHideStartPanelPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(HIDE_START_PANEL_KEY) === "true";
}

export function writeHideStartPanelPreference(hidden: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(HIDE_START_PANEL_KEY, String(hidden));
}

export function prepareProjectForDownload(project: PandaSlidesProject) {
  return JSON.stringify(
    {
      ...project,
      updatedAt: nowIsoString(),
    },
    null,
    2,
  );
}
