# PandaSlides

PandaSlides is a lightweight browser-based live presentation control demo with three synchronized views:

- `/operator` for slide control
- `/display` for the audience output
- `/stage` for the confidence monitor

The app uses Socket.IO to keep all three views in sync in realtime while the operator edits a project locally.

## Stack

- React + Vite frontend
- Tailwind CSS for styling
- Express + Socket.IO backend

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Start the frontend and backend together:

```bash
npm run dev
```

3. Open the routes in separate browser tabs or windows:

- [http://localhost:5173/operator](http://localhost:5173/operator)
- [http://localhost:5173/display](http://localhost:5173/display)
- [http://localhost:5173/stage](http://localhost:5173/stage)

## Production-Style Run

This app is set up to run as a single Node service in production, which is the recommended setup for Render.

1. Build the frontend:

```bash
npm run build
```

2. Start the production server:

```bash
npm start
```

3. Open the routes on the same origin:

- `http://localhost:3001/operator`
- `http://localhost:3001/display`
- `http://localhost:3001/stage`

## Current Features

- Create new blank, service, event, and song-set projects
- Add service items and song items
- Add, duplicate, move, delete, and format slides
- Paste song sections from text and rebuild song slides automatically
- Run synchronized operator, display, and stage views
- Use keyboard shortcuts for queueing, going live, blackout, logo, open, and export
- Export projects as `.pandaslides`
- Optional Web MIDI control input for previous, next, go-live, blackout, and logo

## Demo Workflow

1. Open `/operator` on your control machine.
2. Open `/display` on the audience screen.
3. Open `/stage` on a confidence monitor.
4. Create or open a project from the start panel.
5. Click any slide in the rundown to queue it and use `Go Live` to push it to the other views.
6. Use the transport controls, shortcuts, or MIDI bindings to control the live output in realtime.

## Keyboard Shortcuts

- `Right Arrow`: next slide live
- `Left Arrow`: previous slide live
- `Down Arrow`: queue next slide
- `Up Arrow`: queue previous slide
- `Space` or `Enter`: send the queued slide live
- `B`: toggle blackout
- `L`: toggle logo
- `Ctrl/Cmd + S`: export `.pandaslides`
- `Ctrl/Cmd + O`: open project file
- `Ctrl/Cmd + N`: open the start panel

## Render Deployment

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Runtime: Node
- The Express server serves both the API/Socket.IO backend and the built frontend from `dist`.

## Notes

- The server runs on `http://localhost:3001`.
- The frontend runs on `http://localhost:5173`.
- Live state is stored in memory on the server and mirrored to local storage on the operator.
- Web MIDI depends on browser support and user permission.
