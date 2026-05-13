# PandaSlides — Claude Code Project Instructions

Read `DESIGN.md` before touching any UI file. The full design spec is there.

## What This App Is

PandaSlides is **live presentation control software** — think ProPresenter, OBS, or a broadcast console. It is not a SaaS dashboard, a web app, or a marketing page. The operator runs it during a live church service, event, or performance.

## The Golden Rule

> Do not make it look like an AI-generated SaaS dashboard.

If a component could appear in a Tailwind UI kit, shadcn showcase, or a generic "admin dashboard" template — it does not belong here.

## Banned Patterns (do not introduce these)

- `rounded-xl` / `rounded-2xl` / `rounded-3xl` / pill shapes on panels or buttons
- `backdrop-blur` / glassmorphism
- `shadow-lg` / `shadow-xl` on panels (production consoles use thin borders, not shadows)
- `min-h-screen` as a layout container in the operator page
- Page-level scroll in the operator view — use `h-screen overflow-hidden` + internal panel scroll
- Cards nested inside cards inside panels
- Large `h1` / `h2` page title bars — project info goes in the compact top menu bar
- Section descriptions or "helpful" explanatory sub-text in the operator UI
- Generic shadcn/ui `<Card>`, `<Badge>`, `<Dialog>` patterns
- Arbitrary amber/green/blue colours — use only the tokens from `src/index.css @theme`

## Required Patterns

- **App shell:** `relative flex h-screen flex-col overflow-hidden` on the root operator div
- **3-column layout:** `w-[264px]` rundown | `flex-1` preview center | `w-[248px]` system panel
- **Panel headers:** exactly `h-[30px]`, `bg-[#090d15]`, `border-b border-[#1e2835]`, `.panel-label` class
- **Row separators:** `divide-y divide-[#161e2a]` or `border-b border-[#161e2a]`
- **Column dividers:** `border-l border-[#1e2835]` / `border-r border-[#1e2835]`
- **SlideCanvas height:** always controlled by the parent via flexbox — never set inside the component
- **Live state colour:** emerald green (`bg-emerald-500/12`, `text-emerald-300`) — nothing else
- **Selected/accent colour:** amber (`--color-accent-500` / amber-400/500) — nothing else
- **Control buttons:** full-width, label left + mono shortcut badge right, no rounded corners
- **Empty states:** one small `.panel-label` + optional amber text link — no illustrations or big copy

## File Map

```
src/
  index.css              ← design tokens, global classes — edit this for visual changes
  types/project.ts       ← PandaSlidesProject data model
  state/liveState.ts     ← Socket.io sync + localStorage workspace state
  data/demoService.ts    ← built-in demo service data
  data/projectTemplates.ts ← template factories
  utils/projectStorage.ts  ← localStorage persistence, recent projects, import/export
  components/
    SlideCanvas.tsx      ← slide preview monitor (h-full, parent controls size)
    StartPanel.tsx       ← draggable welcome launcher (Adobe CS style)
  pages/
    Operator.tsx         ← main operator console (the big one — read DESIGN.md first)
    Display.tsx          ← full-screen audience output (/display route)
    Stage.tsx            ← stage/confidence monitor (/stage route)
```

## Keyboard Shortcuts

`→` next · `←` prev · `Space` go live · `B` blackout · `L` logo

Shortcuts skip when focus is on INPUT/TEXTAREA/SELECT/BUTTON or when the Start Panel is open.

## Routes

- `/` — Operator console (main control surface)
- `/display` — Full-screen audience output (open on the projector screen)
- `/stage` — Stage/confidence monitor (open on the operator's second screen)

Socket.IO syncs state from the operator to display and stage in real time.

## Project System

Projects use `PandaSlidesProject` type. Actions that load a project go through `loadProject()` in Operator.tsx which: normalises the project, updates workspace state, saves to recent projects, closes the start panel.

Import/export: `.pandaslides` file extension (JSON). Do not change the format without updating `parseProjectFileContents` and `prepareProjectForDownload` in `projectStorage.ts`.

## Before You Change Any UI

1. Read `DESIGN.md` — especially sections 2 (banned patterns) and 6 (component patterns)
2. Run `npm run build` before and after to confirm TypeScript is clean
3. Test at 1440×900 viewport — this is the target laptop resolution
4. Load the demo (`File → Load Demo`) and exercise the rundown, Go Live, and keyboard shortcuts
