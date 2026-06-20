import type { ReactNode } from "react";

export type SlideEditorTool = "select" | "text" | "image" | "audio" | "emoji";

type SlideEditorToolbarProps = {
  activeTool: SlideEditorTool;
  canUndo: boolean;
  canRedo: boolean;
  hasImage: boolean;
  hasAudio: boolean;
  hasEmoji: boolean;
  emojiPickerOpen: boolean;
  onToolChange: (tool: SlideEditorTool) => void;
  onChooseEmoji: (emoji: string) => void;
  onUndo: () => void;
  onRedo: () => void;
};

const EMOJI_OPTIONS = ["🙂", "❤️", "🙌", "✨", "🎉", "🙏", "🔥", "🎵", "📖", "✝️", "⭐", "💡"];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8">
      {children}
    </svg>
  );
}

const TOOL_ICONS: Record<SlideEditorTool, ReactNode> = {
  select: (
    <Icon>
      <path d="m5 3 13 9-6 1.5L9.5 19 5 3Z" />
    </Icon>
  ),
  text: (
    <Icon>
      <path d="M5 5h14M12 5v14M8.5 19h7" />
    </Icon>
  ),
  image: (
    <Icon>
      <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m5 18 5-5 3 3 2-2 4 4" />
    </Icon>
  ),
  audio: (
    <Icon>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </Icon>
  ),
  emoji: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 10h.01M15.5 10h.01M8 14.5c1.1 1.3 2.4 2 4 2s2.9-.7 4-2" />
    </Icon>
  ),
};

function ToolButton({
  label,
  active = false,
  marked = false,
  disabled = false,
  children,
  onClick,
}: {
  label: string;
  active?: boolean;
  marked?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative flex h-9 w-9 items-center justify-center border transition-colors ${
        disabled
          ? "cursor-not-allowed border-transparent text-[#263242]"
          : active
            ? "border-amber-400/35 bg-amber-400/14 text-amber-200"
            : "border-transparent text-[#7f8da0] hover:border-white/10 hover:bg-white/6 hover:text-white"
      }`}
    >
      {children}
      {marked ? <span className="absolute right-[3px] top-[3px] h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
    </button>
  );
}

export function SlideEditorToolbar({
  activeTool,
  canUndo,
  canRedo,
  hasImage,
  hasAudio,
  hasEmoji,
  emojiPickerOpen,
  onToolChange,
  onChooseEmoji,
  onUndo,
  onRedo,
}: SlideEditorToolbarProps) {
  return (
    <div className="absolute left-3 top-3 z-10 flex flex-col border border-[#303b4b] bg-[#0a1019]/95 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur">
      {(["select", "text", "image", "audio", "emoji"] as SlideEditorTool[]).map((tool) => (
        <div key={tool} className="relative">
          <ToolButton
            label={tool === "emoji" ? "Emoji" : `${tool[0].toUpperCase()}${tool.slice(1)} tool`}
            active={activeTool === tool}
            marked={(tool === "image" && hasImage) || (tool === "audio" && hasAudio) || (tool === "emoji" && hasEmoji)}
            onClick={() => onToolChange(tool)}
          >
            {TOOL_ICONS[tool]}
          </ToolButton>

          {tool === "emoji" && emojiPickerOpen ? (
            <div className="absolute left-[44px] top-0 grid w-[156px] grid-cols-4 gap-1 border border-[#303b4b] bg-[#0a1019] p-2 shadow-[0_14px_34px_rgba(0,0,0,0.55)]">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onChooseEmoji(emoji)}
                  className="flex h-8 items-center justify-center border border-transparent text-lg transition-colors hover:border-amber-400/30 hover:bg-amber-400/10"
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ))}

      <div className="my-1 border-t border-white/8" />

      <ToolButton label="Undo (Ctrl/Cmd+Z)" disabled={!canUndo} onClick={onUndo}>
        <Icon>
          <path d="m9 7-4 4 4 4" />
          <path d="M5 11h8a6 6 0 0 1 6 6" />
        </Icon>
      </ToolButton>
      <ToolButton label="Redo (Ctrl/Cmd+Shift+Z)" disabled={!canRedo} onClick={onRedo}>
        <Icon>
          <path d="m15 7 4 4-4 4" />
          <path d="M19 11h-8a6 6 0 0 0-6 6" />
        </Icon>
      </ToolButton>
    </div>
  );
}
