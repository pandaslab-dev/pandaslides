# PandaSlides

Realtime browser-based presentation control for an operator screen, audience display, and stage confidence monitor.

## Why I built it

I built PandaSlides to explore a simpler live presentation workflow for churches, events, and performances while learning how to coordinate multiple synchronized screens in realtime. The project let me design both the editing experience and the live-output system instead of depending on a heavyweight existing presentation tool.

## Tech stack

- TypeScript
- React 19
- Vite
- HTML / CSS
- Tailwind CSS 4
- Node.js
- Express
- Socket.IO

## Current features

- Three synchronized views: operator, display, and stage
- Editable presentation projects with ordered sections and slides
- `.pandaslides` import/export with embedded image and audio assets
- Live queueing, go-live controls, blackout mode, and logo mode
- Song section generation and text-to-song-slide rebuilding
- Local recent-project persistence in the browser
- Optional Web MIDI bindings for live controls

## What I learned

- How to model shared live state across multiple clients with Socket.IO
- How to separate editing state from presentation/output state in a React app
- How to design a portable JSON-based file format that can include media
- How to structure a small full-stack app so development and production runs stay simple

## What I would improve next

- Add automated tests for project parsing, schema validation, and live-state behavior
- Refine the operator UI for faster large-deck editing
- Add persistent server-side storage and multi-operator collaboration
- Improve mobile and tablet ergonomics for control use on smaller screens

## Running locally

For detailed setup, usage, and file-format docs, see [docs/running-and-usage.md](/Users/panda/Projects/2026/pandaslides/docs/running-and-usage.md) and [docs/pandaslides-format.md](/Users/panda/Projects/2026/pandaslides/docs/pandaslides-format.md).

```bash
npm install
npm run dev
```
