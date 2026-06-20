import type { Slide, SlideAlignment, SlideFontSize } from "../types/project";

type SlideCanvasProps = {
  slide: Slide;
  className?: string;
  align?: SlideAlignment;
  compact?: boolean;
  emptyStateLabel?: string;
  editable?: boolean;
  onTextClick?: () => void;
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
  editable = false,
  onTextClick,
}: SlideCanvasProps) {
  const textAlign = align ?? slide.align ?? "center";
  const size = slide.fontSize ?? "lg";
  const body = slide.body ?? "";

  return (
    <div className={`slide-frame relative flex flex-col overflow-hidden border border-white/6 ${className}`}>
      {slide.image ? (
        <>
          <img src={slide.image.dataUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/45" />
        </>
      ) : null}
      {slide.emoji ? (
        <div className={`absolute right-[6%] top-[8%] z-[2] drop-shadow-[0_4px_14px_rgba(0,0,0,0.45)] ${compact ? "text-3xl" : "text-6xl"}`}>
          {slide.emoji}
        </div>
      ) : null}
      <div className={`relative z-[1] flex flex-1 px-5 py-5 ${textAlign === "center" ? "items-center" : "items-stretch"} justify-center`}>
        <button
          type="button"
          disabled={!editable}
          onClick={onTextClick}
          className={`flex w-full max-w-[20ch] flex-col justify-center border border-transparent bg-transparent p-0 text-inherit ${
            editable ? "cursor-text hover:border-white/10" : "cursor-default"
          } ${getAlignmentClass(textAlign)}`}
        >
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
        </button>
      </div>
      {slide.footer ? (
        <div className="relative z-[1] flex-none border-t border-white/5 bg-black/20 px-4 py-2 text-center text-[9px] font-medium tracking-[0.4em] text-white/40 uppercase">
          {slide.footer}
        </div>
      ) : null}
    </div>
  );
}
