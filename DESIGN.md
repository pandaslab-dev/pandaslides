# PandaSlides — Design Specification

> **Purpose:** This document defines the visual design system, layout rules, and component patterns for PandaSlides. It exists to prevent design regression — specifically the "AI vibe-coded SaaS dashboard" pattern (oversized rounded cards, glassmorphism, random floating panels, generic web-app aesthetics). Every UI contribution must conform to this spec.

---

## 1. Design Philosophy

PandaSlides is **live production software**, not a web app or marketing page. The UI should feel like:

- ProPresenter (live presentation control)
- OBS Studio (broadcast recording)
- Ableton Live (production surface)
- Blender (dense, docked panels)
- Adobe Flash CS / Dreamweaver start screens (classic creative software launcher)

The operator is running a live event. The interface must be:

- **Dense and readable** — maximise information visible at a glance
- **Fast to scan** — operators look away and back in seconds
- **Visually hierarchical** — live output is the focus; everything else is secondary
- **Unambiguous** — states (live, selected, idle, blackout) must be immediately obvious
- **Compact** — no wasted space; every pixel earns its place

---

## 2. What To Never Do

These patterns are explicitly banned. Do not introduce them:

| Anti-pattern | Why |
|---|---|
| Oversized rounded corners (`rounded-2xl`, `rounded-3xl`, pill shapes) | Makes it look like a SaaS marketing page |
| Glassmorphism (`backdrop-blur`, frosted glass) | Decorative, not functional |
| Large drop shadows on panels | Creates a "floating cards" look |
| Cards nested inside cards inside panels | Excessive nesting hides hierarchy |
| Giant hero sections with large h1 page titles | This is an app, not a landing page |
| Section descriptions / marketing sub-text | Operators don't need explanations |
| Randomly floating panels with no dock relationship | Incoherent layout |
| Gradient mesh backgrounds or decorative blurs | Noise, not signal |
| `min-h-screen` as a container pattern | Breaks h-screen layout containment |
| Page-level vertical scroll in the operator view | The app shell is fixed; panels scroll internally |
| `space-y-6` or larger gaps between UI sections | Too much air; use `divide-y` or 1px borders |
| Padding greater than `p-4` on panel content | Wastes space |
| Font sizes above `text-sm` for UI chrome | UI chrome is small; only slide content is large |
| `text-center` on rundown / list items | Lists read left-to-right |
| Generic `<Card>` components from shadcn or similar | Not our component model |
| Tailwind utility classes that produce rounded SaaS aesthetics | Specifically: `rounded-xl`, `shadow-xl`, `ring-*`, `backdrop-blur-*` |

---

## 3. Colour System

All colours are defined as CSS custom properties in `src/index.css`.

### App palette

| Token | Hex | Usage |
|---|---|---|
| `--color-surface-950` | `#080b10` | App background, outermost shell |
| `--color-surface-900` | `#0d1119` | Panel bodies |
| `--color-surface-850` | `#111722` | Secondary panel areas |
| `--color-surface-800` | `#181f2e` | Hover states, subtle fills |
| `--color-surface-700` | `#1e2835` | Panel borders (primary) |
| `--color-border-700` | `#252f3e` | Inner borders, list separators |
| `--color-accent-500` | `#d4a43e` | Primary brand amber |
| `--color-accent-400` | `#e1b95d` | Hover states for accent |
| `--color-copy-100` | `#eef1f5` | Primary text |
| `--color-copy-300` | `#8d9db0` | Secondary text, labels |

### Semantic colours (use these, not raw Tailwind colours)

| State | Colour | Example usage |
|---|---|---|
| **Live / active output** | `#34d399` (emerald-400) | LIVE badge, output dot, live row |
| **Selected / queued** | `--color-accent-500` amber | Selected row bar, Go Live button, selection highlight |
| **Blackout active** | `rgb(239 68 68 / 0.15)` red tint | Blackout control button active state |
| **Logo active** | amber tint (same as selected) | Logo control button active state |
| **Idle / standby** | `#2e3d50` — muted blue-grey | Disabled controls, idle outputs |
| **Panel header bg** | `#090d15` | Consistent header bar behind every panel label |
| **Inner separator** | `#161e2a` | `divide-y` colour, list row borders |

### Do not use

- Raw Tailwind colour names like `bg-blue-500`, `text-green-400` — use the semantic colours above
- Any colour above `50%` lightness in panel chrome
- White backgrounds anywhere in the operator view

---

## 4. Typography

### Font stack

```css
--font-sans: "IBM Plex Sans", "Segoe UI", sans-serif;   /* UI chrome */
--font-display: "Oswald", "Arial Narrow", sans-serif;   /* Slide content only */
```

### Type scale rules

| Context | Size | Weight | Notes |
|---|---|---|---|
| Panel section labels | `text-[10px]` | 600 | `tracking-[0.2em]` uppercase — use `.panel-label` class |
| Rundown item titles | `text-[11px]` or `text-[12px]` | 500–600 | Truncate with `truncate` |
| Rundown slide rows | `text-[11px]` | 400 | Muted colour |
| Control button labels | `text-[12px]` | 600 | |
| Status / badges | `text-[9px]` or `text-[10px]` | 700 | `tracking-[0.2em]` uppercase |
| Shortcut keys | `text-[9px]` | 400 | Monospace, border box |
| Menu bar items | `text-[13px]` | 400 | |
| Toast notices | `text-[12px]` | 400 | |
| Slide canvas text | `text-2xl` – `text-5xl` | 400–500 | `font-display`, uppercase |
| App logo | `text-[13px]` | 600 | "PandaSlides" brand treatment only |

**Never use** `text-xl`, `text-2xl`, or larger for any UI chrome (labels, buttons, sidebar text). Large type is reserved for slide content inside the canvas.

---

## 5. Spacing & Layout

### Global shell

```
┌──────────────────────────────────────────────────────────┐
│  TOP MENU BAR (h-[34px], flex-none)                       │
├──────────────┬──────────────────────────┬────────────────┤
│              │                          │                │
│  RUNDOWN     │   PREVIEW WORKSPACE      │  SYSTEM PANEL  │
│  w-[264px]   │   flex-1                 │  w-[248px]     │
│  flex-none   │                          │  flex-none     │
│              │  ┌──────────────────┐    │                │
│  overflow-y  │  │  CURRENT SLIDE   │    │  NEXT SLIDE    │
│  -auto       │  │  flex-[3]        │    │  flex-[4]      │
│              │  ├──────────────────┤    │                │
│              │  │  QUEUED          │    ├────────────────┤
│              │  │  flex-[2]        │    │  TRANSPORT     │
│              │  └──────────────────┘    ├────────────────┤
│              │                          │  OUTPUTS       │
│              │                          ├────────────────┤
│              │                          │  SHORTCUTS     │
└──────────────┴──────────────────────────┴────────────────┘
```

### Key layout rules

1. **Root operator div:** `relative flex h-screen flex-col overflow-hidden` — never `min-h-screen`
2. **Column widths are fixed** except the center which is `flex-1`
3. **Panels do not scroll at the page level** — only `overflow-y-auto` on the rundown list and the shortcuts section
4. **Panel headers are exactly `h-[30px]`** — a compact strip with `.panel-label` on the left and a secondary element right-aligned
5. **Panel content padding:** `p-2` or `p-2.5` for preview areas; `px-3 py-[5px]` or `px-3 py-[7px]` for row items
6. **Border colour between columns:** `border-[#1e2835]` — use this consistently, never `border-white/10`
7. **Row separators inside lists:** `divide-y divide-[#161e2a]` or `border-b border-[#161e2a]`

---

## 6. Component Patterns

### 6.1 Panel Header

Every panel section starts with a compact header bar:

```tsx
<div className="flex h-[30px] flex-none items-center justify-between border-b border-[#1e2835] bg-[#090d15] px-3">
  <span className="panel-label">Section Name</span>
  {/* optional: right-aligned secondary element */}
  <span className="text-[10px] text-[#2e3d50]">metadata</span>
</div>
```

Rules:
- Always `h-[30px]`
- Always `bg-[#090d15]` (one step darker than the panel body)
- Always `border-b border-[#1e2835]`
- Label always uses `.panel-label` class
- Never put action buttons in a panel header — use the section content area

### 6.2 Rundown Cue List

Item group header:

```tsx
<div className="flex items-center gap-2 px-2.5 py-[6px] cue-header border-b border-[#161e2a]">
  <span className="min-w-[26px] text-center text-[8px] font-bold tracking-wider text-[#3a4d60] uppercase">
    {typeCode}  {/* WLC / SNG / SCR / SRM / ANN / CLG etc */}
  </span>
  <span className="flex-1 truncate text-[11px] font-semibold text-[#8d9db0]">{item.title}</span>
  <span className="font-mono text-[10px] text-[#2e3d50]">{slideCount}</span>
</div>
```

Slide row:

```tsx
<button
  className={`flex w-full items-center border-b border-[#0f1620] py-[5px] pl-[46px] pr-2.5 text-left transition-colors
    ${isSelected
      ? "border-l-2 border-l-amber-400/60 bg-amber-400/6 pl-[44px]"
      : "border-l-2 border-l-transparent hover:bg-white/3"
    }`}
>
  <span className={`flex-1 truncate text-[11px] ${isLive ? "font-semibold text-white" : isSelected ? "text-[#c8d4e0]" : "text-[#5a6a7e]"}`}>
    {slide.label}
  </span>
  {isLive && (
    <span className="bg-emerald-500/15 px-[5px] py-[1px] text-[8px] font-bold tracking-[0.2em] text-emerald-300 uppercase">
      LIVE
    </span>
  )}
</button>
```

Type code mapping (derive from item title):

| Code | Matches |
|---|---|
| `WLC` | welcome, opening |
| `SNG` | worship, song, hymn, setlist |
| `SCR` | scripture, reading, bible, passage |
| `SRM` | sermon, message, teaching, talk |
| `ANN` | announcement, notice |
| `CLG` | closing, benediction, dismiss |
| `PRA` | prayer, invocation |
| `OFF` | offering, tithe |
| `???` | first 3 chars of title, uppercase |

### 6.3 Control Button (Transport)

```tsx
<button
  className={`flex w-full items-center justify-between px-3 py-[7px] text-[12px] font-semibold transition-colors
    ${disabled ? "cursor-not-allowed text-[#2e3d50]"
      : active ? "bg-amber-400/10 text-amber-200 hover:bg-amber-400/14"
      : "text-[#8d9db0] hover:bg-white/4 hover:text-[#c8d4e0]"
    }`}
>
  <span>{label}</span>
  <span className="border border-white/8 px-[5px] py-[2px] font-mono text-[9px] tracking-wider text-[#4a5a6e]">
    {shortcut}
  </span>
</button>
```

Rules:
- Full width, never grid or inline
- Shortcut badge: `border border-white/8`, monospace, never a coloured pill
- Active state: amber tint only (never blue, never green)
- Danger active (Blackout): `bg-red-900/20 text-red-300`

### 6.4 Status / Output Row

```tsx
<div className="flex items-center gap-2.5 px-3 py-2">
  <div className={`h-[6px] w-[6px] flex-none rounded-full ${ready ? "status-dot-live" : "status-dot-idle"}`} />
  <span className="flex-1 font-mono text-[11px] text-[#6a7a8e]">{route}</span>
  <span className={`text-[9px] font-bold tracking-[0.18em] uppercase ${ready ? "text-emerald-400/75" : "text-[#2e3d50]"}`}>
    {ready ? "Ready" : "Idle"}
  </span>
</div>
```

### 6.5 Status Badge (inline)

```tsx
{/* LIVE badge */}
<span className="bg-emerald-500/12 px-[7px] py-[2px] text-[9px] font-bold tracking-[0.22em] text-emerald-300 uppercase">
  LIVE
</span>

{/* STANDBY badge */}
<span className="bg-white/4 px-[7px] py-[2px] text-[9px] font-bold tracking-[0.2em] text-[#2e3d50] uppercase">
  STANDBY
</span>
```

No `rounded-*` on badges. Rectangle only.

### 6.6 Go Live Button

The primary action. Amber fill, black text, no rounded corners.

```tsx
<button
  disabled={!hasTarget}
  className={`flex items-center gap-2 px-3 py-[5px] text-[11px] font-bold tracking-wide uppercase transition-colors
    ${hasTarget
      ? "bg-amber-500 text-black hover:bg-amber-400"
      : "cursor-not-allowed bg-white/4 text-[#2e3d50]"
    }`}
>
  Go Live
  <span className="border border-black/20 bg-black/15 px-[5px] py-[2px] text-[8px] tracking-wider text-black/60">
    Space
  </span>
</button>
```

### 6.7 Empty State (in-panel)

No friendly illustrations, no large text, no action cards.

```tsx
<div className="flex h-full flex-col items-center justify-center border border-dashed border-white/6">
  <span className="panel-label">{label}</span>
  {action && (
    <button className="mt-2.5 text-[11px] text-amber-400/60 hover:text-amber-300">
      {action}
    </button>
  )}
</div>
```

### 6.8 Dropdown Menu

```tsx
<div className="absolute left-0 top-full z-40 min-w-[192px] border border-[#253040] bg-[#0d1320] py-1 shadow-[0_12px_36px_rgba(0,0,0,0.55)]">
  <button className="flex w-full items-center px-4 py-[6px] text-left text-[13px] text-[#c0ccd8] hover:bg-white/7 hover:text-white">
    Item label
  </button>
</div>
```

No `rounded-*`. Thin border. Dark background. Compact row height.

### 6.9 Toast Notice

```tsx
<div className="pointer-events-none absolute bottom-4 right-4 z-20 max-w-[320px] border border-[#253040] bg-[#0d1420] px-4 py-2.5 text-[12px] text-[#c0ccd8] shadow-[0_10px_32px_rgba(0,0,0,0.55)]">
  {message}
</div>
```

No rounded corners, no icons, no close button. Auto-dismisses in ~3s.

### 6.10 SlideCanvas

The slide preview monitor. Height is **always controlled by the parent via flexbox** — never set a fixed height or `min-h-*` inside the component.

```tsx
// Correct usage — parent controls height:
<div className="flex-1 min-h-0 p-2">
  <SlideCanvas slide={slide} className="h-full" />
</div>

// Correct compact usage:
<SlideCanvas slide={slide} compact className="h-full" />
```

The component itself uses `.slide-frame` (dark background gradient) and `border border-white/6`. No `rounded-*` on the outer container.

---

## 7. Start Panel (Workspace Launcher)

The welcome panel is a **draggable floating window** that appears over the workspace. It should feel like an Adobe CS start screen, not a modal dialog or a marketing hero.

### Rules

- No backdrop overlay that blocks interaction (uses `bg-black/30` dimming, not a blocking modal)
- Draggable by the header/banner strip
- Minimize/close controls top-right (small `h-5 w-5` buttons)
- Banner uses `.start-panel-banner` gradient class
- 3-column body: Open | Create New | Learn/Setup
- Recent projects use single-line compact rows, not cards
- Footer bar: checkbox + version text only
- **No rounded corners on the outer panel** — rectangle only
- Width: `min(860px, calc(100vw - 32px))`

### Action Row pattern

```tsx
<button className="flex w-full items-start gap-3 border-b border-[#1a2230] px-3 py-2 text-left hover:bg-white/4">
  <div className="mt-[3px] h-[6px] w-[6px] flex-none rounded-full bg-[#2e3d50]" />
  <div>
    <div className="text-[12px] font-semibold text-[#c0ccd8]">{label}</div>
    <div className="mt-[2px] text-[10px] leading-[1.5] text-[#3a4a5e]">{description}</div>
  </div>
</button>
```

### Recent project row pattern

```tsx
<button className="flex w-full items-center gap-2 border-b border-[#1a2230] px-3 py-[6px] text-left hover:bg-white/4">
  <span className="min-w-[28px] border border-white/7 bg-black/20 px-[4px] py-[1px] text-center text-[8px] font-bold tracking-wider text-[#3a4a5e] uppercase">
    SNG
  </span>
  <span className="flex-1 truncate text-[11px] text-[#8d9db0]">{name}</span>
  <span className="flex-none text-[10px] text-[#2e3d50]">{date}</span>
</button>
```

---

## 8. Display & Stage Routes

`/display` and `/stage` are full-screen output windows. They follow a different rule set:

- Black background (`bg-black`)
- No chrome, no panels, no controls
- Full-screen `SlideCanvas` with generous padding
- Stage route shows: current slide | next slide | clock | elapsed time

Do not apply operator-view layout rules to these routes.

---

## 9. CSS Architecture

All global styles live in `src/index.css`. Key classes:

| Class | Purpose |
|---|---|
| `.panel-label` | 10px uppercase tracking label for panel headers |
| `.slide-frame` | Dark gradient background for slide canvas areas |
| `.slide-text` | Oswald/display font for slide content |
| `.app-menubar` | Gradient background for the top menu bar |
| `.start-panel-banner` | Amber-tinted gradient for the Start Panel header |
| `.cue-header` | Dark semi-transparent bg for rundown item group headers |
| `.status-dot-live` | Green dot with glow for ready/live outputs |
| `.status-dot-idle` | Muted blue-grey dot for idle outputs |

### Tailwind theme extensions (in `@theme` block)

All custom colours and font stacks are declared in the `@theme` block at the top of `index.css`. Do not inline arbitrary hex values that aren't already in the theme — add them to `@theme` first.

---

## 10. Keyboard Shortcuts

These are the live operator shortcuts. Document any new ones here.

| Key | Action |
|---|---|
| `→` Right Arrow | Next slide (advance live pointer) |
| `←` Left Arrow | Previous slide |
| `Space` | Go live with the currently queued (selected) slide |
| `B` | Toggle Blackout |
| `L` | Toggle Logo |

Rules:
- Shortcuts do not fire when focus is on `INPUT`, `TEXTAREA`, `SELECT`, or `BUTTON`
- Shortcuts do not fire when the Start Panel is open
- Shortcuts require an active project with slides

---

## 11. Project System

The project data model lives in `src/types/project.ts`. Key types:

```ts
type Slide = { id, label, lines: string[], footer? }
type ProjectItem = { id, title, type: ProjectItemType, subtitle?, slides }
type ProjectItemType = "intro" | "song" | "scripture" | "sermon" | "announcements" | "closing" | "general"
type ProjectKind = "blank" | "service" | "event" | "song-set" | "demo" | "custom"
type PandaSlidesProject = { id, title, kind, updatedAt, items }
```

Projects are stored and synced via:
- `src/utils/projectStorage.ts` — localStorage persistence, recent projects, import/export
- `src/state/liveState.ts` — Socket.io sync for display/stage routes, local workspace state
- `src/data/projectTemplates.ts` — template factories (blank, Sunday service, event deck, song set)

The file format is `.pandaslides` (JSON). Import/export preserves all project data.

---

## 12. Reviewer Checklist

Before approving any UI change, verify:

- [ ] No `rounded-xl`, `rounded-2xl`, `rounded-3xl`, or `rounded-full` on panels, cards, or buttons
- [ ] No `shadow-lg`, `shadow-xl`, `shadow-2xl` on panels
- [ ] No `backdrop-blur-*` or glassmorphism effects
- [ ] No `min-h-screen` in the operator root (must be `h-screen overflow-hidden`)
- [ ] No page-level scroll introduced in operator view
- [ ] Panel headers are `h-[30px]` with `bg-[#090d15]`
- [ ] Border colours are `#1e2835` (column dividers) or `#161e2a` (row separators)
- [ ] Accent colour (amber) is only used for: selected state, Go Live button, active controls, brand logo
- [ ] Green is only used for: live/ready output states
- [ ] Text sizes in chrome are `text-[9px]` through `text-sm` only
- [ ] Empty states are minimal (no illustrations, no marketing copy)
- [ ] SlideCanvas height is controlled by parent, not hardcoded inside the component
- [ ] No new shadcn/ui Card components or similar generic component library patterns

---

*This spec was established during the production-console UI refactor (May 2026). Update it when design decisions change — do not let it drift from the implementation.*
