import type { Slide } from "../types/project";

type SlideCanvasProps = {
  slide: Slide;
  className?: string;
  align?: "left" | "center";
  compact?: boolean;
};

export function SlideCanvas({ slide, className = "", align = "center", compact = false }: SlideCanvasProps) {
  return (
    <div className={`slide-frame flex flex-col overflow-hidden border border-white/6 ${className}`}>
      <div className="flex flex-1 items-center justify-center px-5 py-5">
        <div className={`w-full max-w-5xl ${align === "center" ? "text-center" : "text-left"}`}>
          <div
            className={`slide-text text-white ${
              compact ? "space-y-1.5 text-lg sm:text-xl" : "space-y-3 text-2xl sm:text-3xl lg:text-4xl xl:text-5xl"
            }`}
          >
            {slide.lines.map((line) => (
              <p key={line} className="m-0 leading-[1.1]">
                {line}
              </p>
            ))}
          </div>
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
