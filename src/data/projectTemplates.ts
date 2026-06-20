import { demoService } from "./demoService";
import { createEntityId, cloneProject } from "../utils/projectStorage";
import { PROJECT_SCHEMA_VERSION, type PandaSlidesProject, type ProjectKind, type ServiceItem, type ServiceItemType, type Slide, type SlideFontSize } from "../types/project";

export type SongTemplateKey = "basic-song" | "worship-song" | "hymn-style";

export const SONG_TEMPLATE_OPTIONS: { key: SongTemplateKey; label: string }[] = [
  { key: "basic-song", label: "Basic Song" },
  { key: "worship-song", label: "Worship Song" },
  { key: "hymn-style", label: "Hymn Style" },
];

const SONG_TEMPLATE_SECTIONS: Record<SongTemplateKey, string[]> = {
  "basic-song": ["Verse 1", "Chorus", "Verse 2", "Chorus"],
  "worship-song": ["Verse 1", "Verse 2", "Chorus", "Bridge", "Chorus"],
  "hymn-style": ["Verse 1", "Verse 2", "Verse 3", "Verse 4"],
};

type SlideSeed = {
  title: string;
  body: string;
  footer?: string;
  fontSize?: SlideFontSize;
};

function nowIsoString() {
  return new Date().toISOString();
}

function stampProject(project: Omit<PandaSlidesProject, "id" | "updatedAt">, prefix: string): PandaSlidesProject {
  return {
    ...project,
    id: createEntityId(prefix),
    updatedAt: nowIsoString(),
  };
}

function cloneServiceItem(serviceItem: ServiceItem): ServiceItem {
  return {
    ...serviceItem,
    id: createEntityId(serviceItem.type),
    slides: serviceItem.slides.map((slide) => ({
      ...slide,
      id: createEntityId("slide"),
    })),
  };
}

function createSlide(seed: SlideSeed, orderIndex: number): Slide {
  return {
    id: createEntityId("slide"),
    title: seed.title,
    body: seed.body,
    orderIndex,
    align: "center",
    fontSize: seed.fontSize ?? "lg",
    footer: seed.footer,
  };
}

function createCustomBody(label: string) {
  const lowerLabel = label.toLowerCase();

  if (lowerLabel.includes("chorus")) {
    return "Line one of the chorus\nLine two of the chorus";
  }

  if (lowerLabel.includes("bridge")) {
    return "Line one of the bridge\nLine two of the bridge";
  }

  if (lowerLabel.includes("tag")) {
    return "Line one of the tag\nLine two of the tag";
  }

  if (lowerLabel.includes("ending")) {
    return "Line one of the ending\nLine two of the ending";
  }

  return "Line one of the verse\nLine two of the verse\nLine three of the verse";
}

function createDefaultSlidesForType(type: Exclude<ServiceItemType, "song">): SlideSeed[] {
  switch (type) {
    case "welcome":
      return [
        {
          title: "Welcome",
          body: "Welcome to Panda Community Church\nService begins shortly",
          footer: "WELCOME",
          fontSize: "xl",
        },
      ];
    case "scripture":
      return [
        {
          title: "Reading",
          body: "Scripture reference\nAdd the passage text here",
          footer: "SCRIPTURE",
        },
      ];
    case "message":
      return [
        {
          title: "Title Slide",
          body: "Message title\nSpeaker name",
          footer: "MESSAGE",
          fontSize: "xl",
        },
      ];
    case "announcement":
      return [
        {
          title: "Announcement",
          body: "Main announcement line\nSupporting detail",
          footer: "ANNOUNCEMENT",
        },
      ];
    case "closing":
      return [
        {
          title: "Closing",
          body: "Thank you for joining us\nSee you next time",
          footer: "CLOSING",
        },
      ];
    case "custom":
    default:
      return [
        {
          title: "New Slide",
          body: "",
          footer: "",
        },
      ];
  }
}

export function createSongSectionSlide(sectionTitle: string, orderIndex: number): Slide {
  return createSlide(
    {
      title: sectionTitle,
      body: createCustomBody(sectionTitle),
      footer: "SONG",
      fontSize: sectionTitle.toLowerCase().includes("chorus") ? "xl" : "lg",
    },
    orderIndex,
  );
}

export function createSongServiceItem(title = "New Song", template: SongTemplateKey = "basic-song"): ServiceItem {
  return {
    id: createEntityId("song"),
    title,
    type: "song",
    orderIndex: 0,
    subtitle: SONG_TEMPLATE_OPTIONS.find((option) => option.key === template)?.label,
    slides: SONG_TEMPLATE_SECTIONS[template].map((sectionTitle, orderIndex) => createSongSectionSlide(sectionTitle, orderIndex)),
  } satisfies ServiceItem;
}

export function createServiceItemTemplate(type: ServiceItemType, title?: string): ServiceItem {
  if (type === "song") {
    return createSongServiceItem(title ?? "New Song");
  }

  const defaultTitleMap: Record<Exclude<ServiceItemType, "song">, string> = {
    welcome: "Welcome",
    scripture: "Scripture",
    message: "Message",
    announcement: "Announcement",
    closing: "Closing",
    custom: "Custom Item",
  };

  return {
    id: createEntityId(type),
    title: title ?? defaultTitleMap[type],
    type,
    orderIndex: 0,
    slides: createDefaultSlidesForType(type).map((slide, orderIndex) => createSlide(slide, orderIndex)),
  } satisfies ServiceItem;
}

export function createBlankSlide(title = "New Slide", body = "", orderIndex = 0): Slide {
  return createSlide({ title, body, footer: "SLIDE" }, orderIndex);
}

function createEmptyServiceItem(
  type: Exclude<ServiceItemType, "song">,
  title: string,
  slideTitle: string,
  orderIndex: number,
): ServiceItem {
  const serviceItem = createServiceItemTemplate(type, title);

  return {
    ...serviceItem,
    orderIndex,
    slides: [
      {
        ...createBlankSlide(slideTitle, "", 0),
        footer: type === "custom" ? "" : type.toUpperCase(),
      },
    ],
  };
}

export function createBlankProject(): PandaSlidesProject {
  return stampProject(
    {
      name: "Untitled Presentation",
      schemaVersion: PROJECT_SCHEMA_VERSION,
      kind: "blank",
      serviceItems: [createEmptyServiceItem("custom", "Section 1", "Slide 1", 0)],
    },
    "blank",
  );
}

export function createDemoProject(): PandaSlidesProject {
  return {
    ...cloneProject(demoService),
    id: createEntityId("demo"),
    updatedAt: nowIsoString(),
  };
}

export function createSundayServiceTemplate(): PandaSlidesProject {
  return stampProject(
    {
      name: "Sunday Service",
      schemaVersion: PROJECT_SCHEMA_VERSION,
      kind: "service",
      serviceItems: [
        createEmptyServiceItem("welcome", "Welcome", "Welcome", 0),
        createEmptyServiceItem("custom", "Worship", "Song", 1),
        createEmptyServiceItem("scripture", "Scripture", "Reading", 2),
        createEmptyServiceItem("message", "Message", "Title Slide", 3),
        createEmptyServiceItem("closing", "Closing", "Closing", 4),
      ],
    },
    "service",
  );
}

export function createEventDeckTemplate(): PandaSlidesProject {
  return stampProject(
    {
      name: "Event Deck",
      schemaVersion: PROJECT_SCHEMA_VERSION,
      kind: "event",
      serviceItems: [
        {
          ...createServiceItemTemplate("welcome", "House Open"),
          orderIndex: 0,
          subtitle: "Main Room",
        },
        {
          ...createServiceItemTemplate("message", "Featured Session"),
          orderIndex: 1,
          subtitle: "Opening Keynote",
        },
        {
          ...createServiceItemTemplate("announcement", "Intermission"),
          orderIndex: 2,
          subtitle: "Reset the room",
        },
      ],
    },
    "event",
  );
}

export function createSongSetTemplate(): PandaSlidesProject {
  return stampProject(
    {
      name: "Song Set",
      schemaVersion: PROJECT_SCHEMA_VERSION,
      kind: "song-set",
      serviceItems: [
        {
          ...createSongServiceItem("Opening Song", "worship-song"),
          orderIndex: 0,
        },
        {
          ...createSongServiceItem("Response Song", "basic-song"),
          orderIndex: 1,
        },
      ],
    },
    "song-set",
  );
}

export function cloneProjectWithKind(project: PandaSlidesProject, kind: ProjectKind): PandaSlidesProject {
  return {
    ...cloneProject(project),
    id: createEntityId(kind),
    kind,
    updatedAt: nowIsoString(),
  };
}

export function createSundayServicePrefab(): PandaSlidesProject {
  return cloneProjectWithKind(demoService, "service");
}

export function duplicateServiceItemTemplate(serviceItem: ServiceItem): ServiceItem {
  return cloneServiceItem(serviceItem);
}
