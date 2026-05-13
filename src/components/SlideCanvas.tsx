import type { Slide } from "../data/demoService";

type SlideCanvasProps = {
  slide: Slide;
  className?: string;
  align?: "left" | "center";
  compact?: boolean;
};

export function SlideCanvas({ slide, className = "", align = "center", compact = false }: SlideCanvasProps) {
  return (
    <div
      className={`slide-frame flex h-full min-h-[220px] flex-col overflow-hidden rounded-2xl border border-white/8 ${className}`}
    >
      <div className="flex flex-1 items-center justify-center px-6 py-8 sm:px-10">
        <div className={`w-full max-w-5xl ${align === "center" ? "text-center" : "text-left"}`}>
          <div
            className={`slide-text text-white ${compact ? "space-y-2 text-xl sm:text-2xl" : "space-y-4 text-3xl sm:text-5xl lg:text-6xl"}`}
          >
            {slide.lines.map((line) => (
              <p key={line} className="m-0 leading-[1.12]">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
      {slide.footer ? (
        <div className="border-t border-white/6 px-5 py-3 text-center text-[10px] font-medium tracking-[0.45em] text-white/60 uppercase">
          {slide.footer}
        </div>
      ) : null}
    </div>
  );
}
