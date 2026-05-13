import {
  PROJECT_KINDS,
  PROJECT_SCHEMA_VERSION,
  SERVICE_ITEM_TYPES,
  SLIDE_ALIGNMENTS,
  SLIDE_FONT_SIZES,
  type PandaSlidesProject,
  type ProjectKind,
  type ServiceItem,
  type ServiceItemType,
  type Slide,
  type SlideAlignment,
  type SlideFontSize,
} from "../types/project";

const RECENT_PROJECTS_KEY = "pandaslides.recent-projects";
const LAST_OPENED_PROJECT_KEY = "pandaslides.last-opened-project";
const HIDE_START_PANEL_KEY = "pandaslides.hide-start-panel";
const MAX_RECENT_PROJECTS = 6;

const LEGACY_ITEM_TYPE_MAP: Record<string, ServiceItemType> = {
  intro: "welcome",
  song: "song",
  scripture: "scripture",
  sermon: "message",
  announcements: "announcement",
  closing: "closing",
  general: "custom",
};

type LegacySlide = {
  id?: unknown;
  label?: unknown;
  lines?: unknown;
  footer?: unknown;
  align?: unknown;
  fontSize?: unknown;
};

type LegacyServiceItem = {
  id?: unknown;
  title?: unknown;
  type?: unknown;
  subtitle?: unknown;
  slides?: unknown;
};

type LegacyProject = {
  id?: unknown;
  title?: unknown;
  kind?: unknown;
  updatedAt?: unknown;
  items?: unknown;
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isProjectKind(value: unknown): value is ProjectKind {
  return typeof value === "string" && PROJECT_KINDS.includes(value as ProjectKind);
}

function isServiceItemType(value: unknown): value is ServiceItemType {
  return typeof value === "string" && SERVICE_ITEM_TYPES.includes(value as ServiceItemType);
}

function isSlideAlignment(value: unknown): value is SlideAlignment {
  return typeof value === "string" && SLIDE_ALIGNMENTS.includes(value as SlideAlignment);
}

function isSlideFontSize(value: unknown): value is SlideFontSize {
  return typeof value === "string" && SLIDE_FONT_SIZES.includes(value as SlideFontSize);
}

function toMultilineBody(lines: string[]) {
  return lines.join("\n").replace(/\r\n/g, "\n");
}

function sanitizeBody(body: string) {
  return body.replace(/\r\n/g, "\n");
}

function sanitizeName(value: string, fallbackName?: string) {
  const fallback = fallbackName?.replace(/\.pandaslides$/i, "").replace(/\.json$/i, "").trim();
  return value.trim() || fallback || "";
}

function sortByOrderIndex<T extends { orderIndex: number }>(values: T[]) {
  return [...values].sort((left, right) => left.orderIndex - right.orderIndex);
}

export function createEntityId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeNewSlide(rawSlide: Record<string, unknown>, slideIndex: number): Slide {
  if (!isNonEmptyString(rawSlide.id)) {
    throw new Error(`Slide ${slideIndex + 1} is missing a valid id.`);
  }

  if (!isNonEmptyString(rawSlide.title)) {
    throw new Error(`Slide ${slideIndex + 1} is missing a title.`);
  }

  if (typeof rawSlide.body !== "string") {
    throw new Error(`Slide ${slideIndex + 1} is missing body text.`);
  }

  if (typeof rawSlide.orderIndex !== "number" || Number.isNaN(rawSlide.orderIndex)) {
    throw new Error(`Slide ${slideIndex + 1} is missing a valid orderIndex.`);
  }

  return {
    id: rawSlide.id.trim(),
    title: rawSlide.title.trim(),
    body: sanitizeBody(rawSlide.body),
    orderIndex: rawSlide.orderIndex,
    align: isSlideAlignment(rawSlide.align) ? rawSlide.align : "center",
    fontSize: isSlideFontSize(rawSlide.fontSize) ? rawSlide.fontSize : "lg",
    footer: isNonEmptyString(rawSlide.footer) ? rawSlide.footer.trim() : undefined,
  };
}

function normalizeLegacySlide(rawSlide: LegacySlide, slideIndex: number): Slide {
  if (!isNonEmptyString(rawSlide.id)) {
    throw new Error(`Legacy slide ${slideIndex + 1} is missing a valid id.`);
  }

  if (!isNonEmptyString(rawSlide.label)) {
    throw new Error(`Legacy slide ${slideIndex + 1} is missing a label.`);
  }

  if (!Array.isArray(rawSlide.lines) || !rawSlide.lines.every((line) => typeof line === "string")) {
    throw new Error(`Legacy slide ${slideIndex + 1} has invalid lines.`);
  }

  return {
    id: rawSlide.id.trim(),
    title: rawSlide.label.trim(),
    body: toMultilineBody(rawSlide.lines),
    orderIndex: slideIndex,
    align: isSlideAlignment(rawSlide.align) ? rawSlide.align : "center",
    fontSize: isSlideFontSize(rawSlide.fontSize) ? rawSlide.fontSize : "lg",
    footer: isNonEmptyString(rawSlide.footer) ? rawSlide.footer.trim() : undefined,
  };
}

function normalizeSlide(slide: unknown, slideIndex: number) {
  if (!isRecord(slide)) {
    throw new Error(`Slide ${slideIndex + 1} is not a valid object.`);
  }

  if ("body" in slide || "title" in slide || "orderIndex" in slide) {
    return normalizeNewSlide(slide, slideIndex);
  }

  return normalizeLegacySlide(slide as LegacySlide, slideIndex);
}

function normalizeNewServiceItem(rawItem: Record<string, unknown>, itemIndex: number): ServiceItem {
  if (!isNonEmptyString(rawItem.id)) {
    throw new Error(`Service item ${itemIndex + 1} is missing a valid id.`);
  }

  if (!isNonEmptyString(rawItem.title)) {
    throw new Error(`Service item ${itemIndex + 1} is missing a title.`);
  }

  if (!isServiceItemType(rawItem.type)) {
    throw new Error(`Service item ${itemIndex + 1} has an invalid type.`);
  }

  if (typeof rawItem.orderIndex !== "number" || Number.isNaN(rawItem.orderIndex)) {
    throw new Error(`Service item ${itemIndex + 1} is missing a valid orderIndex.`);
  }

  if (!Array.isArray(rawItem.slides)) {
    throw new Error(`Service item ${itemIndex + 1} is missing slides.`);
  }

  return {
    id: rawItem.id.trim(),
    title: rawItem.title.trim(),
    type: rawItem.type,
    orderIndex: rawItem.orderIndex,
    subtitle: isNonEmptyString(rawItem.subtitle) ? rawItem.subtitle.trim() : undefined,
    slides: sortByOrderIndex(rawItem.slides.map((slide, slideIndex) => normalizeSlide(slide, slideIndex))),
  };
}

function normalizeLegacyServiceItem(rawItem: LegacyServiceItem, itemIndex: number): ServiceItem {
  if (!isNonEmptyString(rawItem.id)) {
    throw new Error(`Legacy service item ${itemIndex + 1} is missing a valid id.`);
  }

  if (!isNonEmptyString(rawItem.title)) {
    throw new Error(`Legacy service item ${itemIndex + 1} is missing a title.`);
  }

  if (!Array.isArray(rawItem.slides)) {
    throw new Error(`Legacy service item ${itemIndex + 1} is missing slides.`);
  }

  const legacyType = isNonEmptyString(rawItem.type) ? rawItem.type.toLowerCase() : "general";

  return {
    id: rawItem.id.trim(),
    title: rawItem.title.trim(),
    type: LEGACY_ITEM_TYPE_MAP[legacyType] ?? "custom",
    orderIndex: itemIndex,
    subtitle: isNonEmptyString(rawItem.subtitle) ? rawItem.subtitle.trim() : undefined,
    slides: rawItem.slides.map((slide, slideIndex) => normalizeLegacySlide(slide as LegacySlide, slideIndex)),
  };
}

function normalizeServiceItem(item: unknown, itemIndex: number) {
  if (!isRecord(item)) {
    throw new Error(`Service item ${itemIndex + 1} is not a valid object.`);
  }

  if ("orderIndex" in item || "type" in item && isServiceItemType(item.type)) {
    return normalizeNewServiceItem(item, itemIndex);
  }

  return normalizeLegacyServiceItem(item as LegacyServiceItem, itemIndex);
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

export function cloneProject(project: PandaSlidesProject): PandaSlidesProject {
  return {
    ...project,
    serviceItems: project.serviceItems.map((serviceItem) => ({
      ...serviceItem,
      slides: serviceItem.slides.map((slide) => ({ ...slide })),
    })),
  };
}

export function normalizeProject(input: unknown, fallbackName?: string): PandaSlidesProject {
  if (!isRecord(input)) {
    throw new Error("Project file is not a valid PandaSlides project.");
  }

  const raw = input as Record<string, unknown>;

  const looksLikeNewSchema = "serviceItems" in raw || "name" in raw || "schemaVersion" in raw;
  if (looksLikeNewSchema) {
    if (!isNonEmptyString(raw.id)) {
      throw new Error("Project is missing a valid id.");
    }

    const name = sanitizeName(typeof raw.name === "string" ? raw.name : "", fallbackName);
    if (!name) {
      throw new Error("Project is missing a valid name.");
    }

    if (typeof raw.schemaVersion !== "number" || Number.isNaN(raw.schemaVersion)) {
      throw new Error("Project is missing a valid schemaVersion.");
    }

    if (!Array.isArray(raw.serviceItems)) {
      throw new Error("Project is missing serviceItems.");
    }

    const kind = isProjectKind(raw.kind) ? raw.kind : "custom";

    return {
      id: raw.id.trim(),
      name,
      schemaVersion: raw.schemaVersion,
      kind,
      updatedAt: isNonEmptyString(raw.updatedAt) ? raw.updatedAt : nowIsoString(),
      serviceItems: sortByOrderIndex(raw.serviceItems.map((item, itemIndex) => normalizeServiceItem(item, itemIndex))),
    };
  }

  const legacyProject = raw as LegacyProject;
  if (!isNonEmptyString(legacyProject.id)) {
    throw new Error("Project is missing a valid id.");
  }

  const name = sanitizeName(typeof legacyProject.title === "string" ? legacyProject.title : "", fallbackName);
  if (!name) {
    throw new Error("Project title is missing.");
  }

  if (!Array.isArray(legacyProject.items)) {
    throw new Error("Project items are missing or invalid.");
  }

  const kind = isProjectKind(legacyProject.kind) ? legacyProject.kind : "custom";

  return {
    id: legacyProject.id.trim(),
    name,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    kind,
    updatedAt: isNonEmptyString(legacyProject.updatedAt) ? legacyProject.updatedAt : nowIsoString(),
    serviceItems: legacyProject.items.map((item, itemIndex) => normalizeLegacyServiceItem(item as LegacyServiceItem, itemIndex)),
  };
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

function normalizeRecentProjectRecord(entry: unknown) {
  if (!isRecord(entry)) {
    return null;
  }

  const project = normalizeProject(entry.project, typeof entry.name === "string" ? entry.name : undefined);
  return {
    id: project.id,
    name: project.name,
    kind: project.kind,
    updatedAt: project.updatedAt,
    typeLabel: getProjectKindLabel(project.kind),
    project,
  } satisfies RecentProjectRecord;
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

    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) {
      return [] as RecentProjectRecord[];
    }

    return parsed
      .map((entry) => {
        try {
          return normalizeRecentProjectRecord(entry);
        } catch {
          return null;
        }
      })
      .filter((entry): entry is RecentProjectRecord => Boolean(entry))
      .slice(0, MAX_RECENT_PROJECTS);
  } catch {
    return [] as RecentProjectRecord[];
  }
}

export function loadLastOpenedProject() {
  if (typeof window === "undefined") {
    return null as PandaSlidesProject | null;
  }

  try {
    const raw = window.localStorage.getItem(LAST_OPENED_PROJECT_KEY);
    if (!raw) {
      return null as PandaSlidesProject | null;
    }

    return normalizeProject(JSON.parse(raw));
  } catch {
    return null as PandaSlidesProject | null;
  }
}

export function saveLastOpenedProject(project: PandaSlidesProject) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LAST_OPENED_PROJECT_KEY, JSON.stringify(project));
}

export function saveRecentProject(project: PandaSlidesProject) {
  if (typeof window === "undefined") {
    return [] as RecentProjectRecord[];
  }

  const nextEntry: RecentProjectRecord = {
    id: project.id,
    name: project.name,
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
  return `${project.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "pandaslides-project"}.pandaslides`;
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
      ...cloneProject(project),
      updatedAt: nowIsoString(),
    },
    null,
    2,
  );
}
