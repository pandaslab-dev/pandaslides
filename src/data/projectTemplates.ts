import { demoService } from "./demoService";
import type { PandaSlidesProject, ProjectItem, ProjectKind } from "../types/project";

function createProjectId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function stampProject(project: Omit<PandaSlidesProject, "id" | "updatedAt">, prefix: string) {
  return {
    ...project,
    id: createProjectId(prefix),
    updatedAt: new Date().toISOString(),
  };
}

function cloneItems(items: ProjectItem[]) {
  return items.map((item) => ({
    ...item,
    slides: item.slides.map((slide) => ({ ...slide, lines: [...slide.lines] })),
  }));
}

function cloneProject(project: PandaSlidesProject, kind: ProjectKind = project.kind) {
  return {
    ...project,
    id: createProjectId(kind),
    kind,
    updatedAt: new Date().toISOString(),
    items: cloneItems(project.items),
  };
}

export function createBlankProject() {
  return stampProject(
    {
      title: "Blank Presentation",
      kind: "blank",
      items: [],
    },
    "blank",
  );
}

export function createDemoProject() {
  return cloneProject(demoService, "demo");
}

export function createSundayServiceTemplate() {
  const project = cloneProject(demoService, "service");
  return {
    ...project,
    title: "Sunday Service",
  };
}

export function createEventDeckTemplate() {
  return stampProject(
    {
      title: "Event Deck",
      kind: "event",
      items: [
        {
          id: "event-welcome",
          title: "House Open",
          type: "general",
          subtitle: "Main Room",
          slides: [
            {
              id: "event-welcome-1",
              label: "Doors Open",
              lines: ["Welcome to tonight's event", "The program will begin shortly"],
              footer: "PANDASLIDES EVENT",
            },
          ],
        },
        {
          id: "event-speaker",
          title: "Featured Session",
          type: "general",
          subtitle: "Opening Keynote",
          slides: [
            {
              id: "event-speaker-1",
              label: "Speaker Intro",
              lines: ["Opening Session", "Hosted by Jordan Ellis"],
              footer: "LIVE EVENT",
            },
          ],
        },
        {
          id: "event-break",
          title: "Intermission",
          type: "general",
          subtitle: "Reset the room",
          slides: [
            {
              id: "event-break-1",
              label: "Break",
              lines: ["Intermission", "We will resume in 10 minutes"],
              footer: "THANK YOU",
            },
          ],
        },
      ],
    },
    "event",
  );
}

export function createSongSetTemplate() {
  return stampProject(
    {
      title: "Song Set",
      kind: "song-set",
      items: [
        {
          id: "song-1",
          title: "Opening Song",
          type: "song",
          subtitle: "Set your first arrangement here",
          slides: [
            {
              id: "song-1-verse",
              label: "Verse 1",
              lines: ["First lyric line", "Second lyric line", "Third lyric line", "Fourth lyric line"],
              footer: "SONG SET",
            },
          ],
        },
        {
          id: "song-2",
          title: "Response Song",
          type: "song",
          subtitle: "Ready for a second song",
          slides: [
            {
              id: "song-2-chorus",
              label: "Chorus",
              lines: ["Lift your voice", "Sing together", "Carry the moment"],
              footer: "SONG SET",
            },
          ],
        },
      ],
    },
    "song-set",
  );
}
