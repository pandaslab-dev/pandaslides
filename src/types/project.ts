export type Slide = {
  id: string;
  label: string;
  lines: string[];
  footer?: string;
};

export type ProjectItemType = "intro" | "song" | "scripture" | "sermon" | "announcements" | "closing" | "general";

export type ProjectItem = {
  id: string;
  title: string;
  type: ProjectItemType;
  subtitle?: string;
  slides: Slide[];
};

export type ProjectKind = "blank" | "service" | "event" | "song-set" | "demo" | "custom";

export type PandaSlidesProject = {
  id: string;
  title: string;
  kind: ProjectKind;
  updatedAt: string;
  items: ProjectItem[];
};
