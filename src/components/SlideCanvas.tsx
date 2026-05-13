import type { Slide, SlideAlignment, SlideFontSize } from "../types/project";

type SlideCanvasProps = {
  slide: Slide;
  className?: string;
  align?: SlideAlignment;
  compact?: boolean;
  emptyStateLabel?: string;
};

const FULL_SIZE_MAP: Record<SlideFontSize, string> = {
  sm: "text-2xl sm:text-3xl lg:text-4xl",
  md: "text-3xl sm:text-4xl lg:text-5xl",
  lg: "text-4xl sm:text-5xl lg:text-6xl",
  xl: "text-5xl sm:text-6xl lg:text-7xl",
};

const COMPACT_SIZE_MAP: Record<SlideFontSize, string> = {
  sm: "text-lg sm:text-xl",
  md: "text-xl sm:text-2xl",
  lg: "text-2xl sm:text-3xl",
  xl: "text-3xl sm:text-4xl",
};

function getAlignmentClass(align: SlideAlignment) {
  switch (align) {
    case "left":
      return "text-left items-start";
    case "right":
      return "text-right items-end";
    default:
      return "text-center items-center";
  }
}

export function SlideCanvas({
  slide,
  className = "",
  align,
  compact = false,
  emptyStateLabel = "",
}: SlideCanvasProps) {
  const textAlign = align ?? slide.align ?? "center";
  const size = slide.fontSize ?? "lg";
  const body = slide.body ?? "";

  return (
    <div className={`slide-frame flex flex-col overflow-hidden border border-white/6 ${className}`}>
      <div className={`flex flex-1 px-5 py-5 ${textAlign === "center" ? "items-center" : "items-stretch"} justify-center`}>
        <div className={`flex w-full max-w-[20ch] flex-col justify-center ${getAlignmentClass(textAlign)}`}>
          {body.trim().length > 0 ? (
            <div
              className={`slide-text whitespace-pre-wrap break-words leading-[1.08] text-white ${
                compact ? COMPACT_SIZE_MAP[size] : FULL_SIZE_MAP[size]
              }`}
            >
              {body}
            </div>
          ) : emptyStateLabel ? (
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#4a5a6e]">{emptyStateLabel}</div>
          ) : null}
        </div>
      </div>
      {slide.footer ? (
        <div className="flex-none border-t border-white/5 px-4 py-2 text-center text-[9px] font-medium tracking-[0.4em] text-white/40 uppercase">
          {slide.footer}
        </div>
      ) : null}
    </div>
  );
}
