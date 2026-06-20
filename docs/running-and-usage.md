# Running and Using PandaSlides

## Overview

PandaSlides is a small full-stack app with:

- a React + Vite client
- an Express + Socket.IO server
- three browser routes that stay synchronized in realtime

The three main views are:

- `/operator` for editing, queueing, and sending slides live
- `/display` for the audience-facing output
- `/stage` for a confidence monitor that shows the live and upcoming slide

## Local development

Install dependencies:

```bash
npm install
```

Start the client and server together:

```bash
npm run dev
```

This launches:

- the Vite client at `http://localhost:5173`
- the Node/Express server at `http://localhost:3001`

During development, open these routes from the Vite app:

- `http://localhost:5173/operator`
- `http://localhost:5173/display`
- `http://localhost:5173/stage`

The client connects to the local Socket.IO server automatically through the Vite dev proxy for `/api` and `/socket.io`.

## Production-style run

Build the frontend:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

In production mode, the Express server serves both the API/socket layer and the built frontend from the same origin. Open:

- `http://localhost:3001/operator`
- `http://localhost:3001/display`
- `http://localhost:3001/stage`

## Environment variables

No API keys are required.

The app works locally without any `.env` file. The only optional runtime settings currently used are:

- `PORT` for the Node server in production, defaulting to `3001`
- `VITE_SOCKET_URL` if you want the client to connect to a different Socket.IO server instead of the default same-origin/local target

## Typical workflow

1. Open `/operator`.
2. Create a blank presentation or start from the Sunday service template.
3. Add service items and slides, or open an exported `.pandaslides` file.
4. Open `/display` on the audience screen.
5. Open `/stage` on a confidence monitor if needed.
6. Queue a slide in the operator view.
7. Send it live with the Go Live control, keyboard shortcuts, or MIDI bindings.

## Project editing model

A PandaSlides project is organized like this:

- `project`
- `serviceItems[]`
- `slides[]`

Each service item is an ordered group such as a welcome, song, scripture reading, message, announcement, closing section, or custom block. Each slide stores its own text and optional media.

## File handling

Projects export as `.pandaslides` files, which are JSON documents.

Important behavior:

- Images are embedded directly in the file as data URLs
- Audio cues are embedded directly in the file as data URLs
- Imported legacy JSON project shapes are still normalized into the current schema
- Large projects may exceed browser `localStorage`, but export and the live server state remain the main source of truth

Current media limits in the operator UI:

- images: up to 5 MB before optimization
- audio: up to 10 MB

## Keyboard shortcuts

- `Right Arrow`: next live slide
- `Left Arrow`: previous live slide
- `Down Arrow`: queue next slide
- `Up Arrow`: queue previous slide
- `Space` or `Enter`: send queued slide live
- `B`: toggle blackout
- `L`: toggle logo
- `Ctrl/Cmd + S`: export project
- `Ctrl/Cmd + O`: open project file
- `Ctrl/Cmd + N`: open the start panel
- `Ctrl/Cmd + Z`: undo
- `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y`: redo

## MIDI support

The operator view can optionally use Web MIDI for:

- previous
- next
- go live
- blackout
- logo

This depends on browser support and user permission.

## Deployment notes

The repo includes [render.yaml](/Users/panda/Projects/2026/pandaslides/render.yaml) for a simple Node web service deployment.

Build command:

```bash
npm install && npm run build
```

Start command:

```bash
npm start
```
