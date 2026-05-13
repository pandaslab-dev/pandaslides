import {
  createBlankSlide,
  createServiceItemTemplate,
  createSongSectionSlide,
  createSongServiceItem,
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
