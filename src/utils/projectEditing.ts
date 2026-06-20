import {
  createBlankSlide,
  createServiceItemTemplate,
  createSongSectionSlide,
  createSongServiceItem,
  duplicateServiceItemTemplate,
  type SongTemplateKey,
} from "../data/projectTemplates";
import { cloneProject } from "./projectStorage";
import type { PandaSlidesProject, ServiceItem, ServiceItemType, Slide } from "../types/project";

function nowIsoString() {
  return new Date().toISOString();
}

function reindexSlides(slides: Slide[]) {
  return slides.map((slide, orderIndex) => ({
    ...slide,
    orderIndex,
  }));
}

function reindexServiceItems(serviceItems: ServiceItem[]) {
  return serviceItems.map((serviceItem, orderIndex) => ({
    ...serviceItem,
    orderIndex,
    slides: reindexSlides(serviceItem.slides),
  }));
}

function touchProject(project: PandaSlidesProject, serviceItems: ServiceItem[]) {
  return {
    ...project,
    updatedAt: nowIsoString(),
    serviceItems: reindexServiceItems(serviceItems),
  };
}

function updateServiceItemById(
  project: PandaSlidesProject,
  serviceItemId: string,
  updater: (serviceItem: ServiceItem) => ServiceItem,
) {
  return touchProject(
    project,
    project.serviceItems.map((serviceItem) => (serviceItem.id === serviceItemId ? updater(serviceItem) : serviceItem)),
  );
}

function moveArrayItem<T>(values: T[], fromIndex: number, toIndex: number) {
  const nextValues = [...values];
  const [movedValue] = nextValues.splice(fromIndex, 1);
  nextValues.splice(toIndex, 0, movedValue);
  return nextValues;
}

function inferSongSectionTitle(title: string, sectionIndex: number) {
  const trimmedTitle = title.trim();
  if (trimmedTitle.length > 0) {
    return trimmedTitle;
  }

  return `Section ${sectionIndex + 1}`;
}

function createSongImportSlide(title: string, body: string, orderIndex: number): Slide {
  const normalizedTitle = inferSongSectionTitle(title, orderIndex);
  const normalizedBody = body.trim();
  const baseSlide = createBlankSlide(normalizedTitle, normalizedBody, orderIndex);
  const lowerTitle = normalizedTitle.toLowerCase();

  return {
    ...baseSlide,
    footer: "SONG",
    fontSize: lowerTitle.includes("chorus") || lowerTitle.includes("tag") ? "xl" : "lg",
  };
}

type ParsedSongSection = {
  title: string;
  body: string;
};

function parseSongSections(rawText: string): ParsedSongSection[] {
  const normalized = rawText.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const blocks = normalized
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, blockIndex) => {
    const lines = block
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.trim().length > 0);
    const headingMatch = lines[0]?.match(/^\[?([A-Za-z][A-Za-z0-9'&/ -]*)\]?:?$/);

    if (headingMatch && lines.length > 1) {
      return {
        title: inferSongSectionTitle(headingMatch[1], blockIndex),
        body: lines.slice(1).join("\n"),
      };
    }

    return {
      title: inferSongSectionTitle("", blockIndex),
      body: lines.join("\n"),
    };
  });
}

export function findServiceItem(project: PandaSlidesProject, serviceItemId: string) {
  return project.serviceItems.find((serviceItem) => serviceItem.id === serviceItemId) ?? null;
}

export function findSlide(project: PandaSlidesProject, serviceItemId: string, slideId: string) {
  const serviceItem = findServiceItem(project, serviceItemId);
  if (!serviceItem) {
    return null;
  }

  return serviceItem.slides.find((slide) => slide.id === slideId) ?? null;
}

export function appendServiceItem(project: PandaSlidesProject, type: ServiceItemType, title?: string) {
  const nextItem = createServiceItemTemplate(type, title);
  return touchProject(project, [...project.serviceItems, { ...nextItem, orderIndex: project.serviceItems.length }]);
}

export function appendSongServiceItem(project: PandaSlidesProject, title?: string, template: SongTemplateKey = "basic-song") {
  const nextItem = createSongServiceItem(title ?? "New Song", template);
  return touchProject(project, [...project.serviceItems, { ...nextItem, orderIndex: project.serviceItems.length }]);
}

export function updateServiceItem(project: PandaSlidesProject, serviceItemId: string, patch: Partial<Pick<ServiceItem, "title" | "subtitle">>) {
  return updateServiceItemById(project, serviceItemId, (serviceItem) => ({
    ...serviceItem,
    title: patch.title ?? serviceItem.title,
    subtitle: patch.subtitle ?? serviceItem.subtitle,
  }));
}

export function appendSlide(project: PandaSlidesProject, serviceItemId: string, title = "New Slide") {
  return updateServiceItemById(project, serviceItemId, (serviceItem) => ({
    ...serviceItem,
    slides: reindexSlides([...serviceItem.slides, createBlankSlide(title, "", serviceItem.slides.length)]),
  }));
}

export function appendSongSection(project: PandaSlidesProject, serviceItemId: string, sectionTitle: string) {
  return updateServiceItemById(project, serviceItemId, (serviceItem) => ({
    ...serviceItem,
    slides: reindexSlides([...serviceItem.slides, createSongSectionSlide(sectionTitle, serviceItem.slides.length)]),
  }));
}

export function replaceSongSlidesFromText(project: PandaSlidesProject, serviceItemId: string, rawText: string) {
  const sections = parseSongSections(rawText);
  if (sections.length === 0) {
    return project;
  }

  return updateServiceItemById(project, serviceItemId, (serviceItem) => ({
    ...serviceItem,
    slides: reindexSlides(
      sections.map((section, orderIndex) => createSongImportSlide(section.title, section.body, orderIndex)),
    ),
  }));
}

export function duplicateSlide(project: PandaSlidesProject, serviceItemId: string, slideId: string) {
  return updateServiceItemById(project, serviceItemId, (serviceItem) => {
    const slideIndex = serviceItem.slides.findIndex((slide) => slide.id === slideId);
    if (slideIndex === -1) {
      return serviceItem;
    }

    const sourceSlide = serviceItem.slides[slideIndex];
    const nextSlides = cloneProject({
      ...project,
      serviceItems: [serviceItem],
    }).serviceItems[0].slides;

    nextSlides.splice(slideIndex + 1, 0, {
      ...sourceSlide,
      id: createBlankSlide(sourceSlide.title, sourceSlide.body).id,
      title: `${sourceSlide.title} Copy`,
    });

    return {
      ...serviceItem,
      slides: reindexSlides(nextSlides),
    };
  });
}

export function deleteSlide(project: PandaSlidesProject, serviceItemId: string, slideId: string) {
  return updateServiceItemById(project, serviceItemId, (serviceItem) => ({
    ...serviceItem,
    slides: reindexSlides(serviceItem.slides.filter((slide) => slide.id !== slideId)),
  }));
}

export function duplicateServiceItem(project: PandaSlidesProject, serviceItemId: string) {
  const serviceItemIndex = project.serviceItems.findIndex((serviceItem) => serviceItem.id === serviceItemId);
  if (serviceItemIndex === -1) {
    return project;
  }

  const duplicatedItem = duplicateServiceItemTemplate(project.serviceItems[serviceItemIndex]);
  const nextServiceItems = [...project.serviceItems];
  nextServiceItems.splice(serviceItemIndex + 1, 0, {
    ...duplicatedItem,
    title: `${project.serviceItems[serviceItemIndex].title} Copy`,
  });

  return touchProject(project, nextServiceItems);
}

export function deleteServiceItem(project: PandaSlidesProject, serviceItemId: string) {
  return touchProject(
    project,
    project.serviceItems.filter((serviceItem) => serviceItem.id !== serviceItemId),
  );
}

export function moveServiceItem(project: PandaSlidesProject, serviceItemId: string, direction: "up" | "down") {
  const serviceItemIndex = project.serviceItems.findIndex((serviceItem) => serviceItem.id === serviceItemId);
  if (serviceItemIndex === -1) {
    return project;
  }

  const targetIndex = direction === "up" ? serviceItemIndex - 1 : serviceItemIndex + 1;
  if (targetIndex < 0 || targetIndex >= project.serviceItems.length) {
    return project;
  }

  return touchProject(project, moveArrayItem(project.serviceItems, serviceItemIndex, targetIndex));
}

export function moveSlide(project: PandaSlidesProject, serviceItemId: string, slideId: string, direction: "up" | "down") {
  return updateServiceItemById(project, serviceItemId, (serviceItem) => {
    const slideIndex = serviceItem.slides.findIndex((slide) => slide.id === slideId);
    if (slideIndex === -1) {
      return serviceItem;
    }

    const targetIndex = direction === "up" ? slideIndex - 1 : slideIndex + 1;
    if (targetIndex < 0 || targetIndex >= serviceItem.slides.length) {
      return serviceItem;
    }

    const nextSlides = [...serviceItem.slides];
    const [movedSlide] = nextSlides.splice(slideIndex, 1);
    nextSlides.splice(targetIndex, 0, movedSlide);

    return {
      ...serviceItem,
      slides: reindexSlides(nextSlides),
    };
  });
}

export function updateSlide(
  project: PandaSlidesProject,
  serviceItemId: string,
  slideId: string,
  patch: Partial<Pick<Slide, "title" | "body" | "align" | "fontSize" | "footer">>,
) {
  return updateServiceItemById(project, serviceItemId, (serviceItem) => ({
    ...serviceItem,
    slides: serviceItem.slides.map((slide) =>
      slide.id === slideId
        ? {
            ...slide,
            title: patch.title ?? slide.title,
            body: patch.body ?? slide.body,
            align: patch.align ?? slide.align,
            fontSize: patch.fontSize ?? slide.fontSize,
            footer: patch.footer ?? slide.footer,
          }
        : slide,
    ),
  }));
}
