export const PROJECT_SCHEMA_VERSION = 2;

export const PROJECT_KINDS = ["blank", "service", "event", "song-set", "demo", "custom"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

export const SERVICE_ITEM_TYPES = [
  "welcome",
  "song",
  "scripture",
  "message",
  "announcement",
  "closing",
  "custom",
] as const;
export type ServiceItemType = (typeof SERVICE_ITEM_TYPES)[number];

export const SLIDE_ALIGNMENTS = ["left", "center", "right"] as const;
export type SlideAlignment = (typeof SLIDE_ALIGNMENTS)[number];

export const SLIDE_FONT_SIZES = ["sm", "md", "lg", "xl"] as const;
export type SlideFontSize = (typeof SLIDE_FONT_SIZES)[number];

export type Slide = {
  id: string;
  title: string;
  body: string;
  orderIndex: number;
  align?: SlideAlignment;
  fontSize?: SlideFontSize;
  footer?: string;
};

export type ServiceItem = {
  id: string;
  title: string;
  type: ServiceItemType;
  orderIndex: number;
  subtitle?: string;
  slides: Slide[];
};

export type PandaSlidesProject = {
  id: string;
  name: string;
  schemaVersion: number;
  kind: ProjectKind;
  updatedAt: string;
  serviceItems: ServiceItem[];
};
