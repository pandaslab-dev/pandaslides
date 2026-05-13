# PandaSlides MVP

PandaSlides is a lightweight browser-based live presentation control demo with three synchronized views:

- `/operator` for slide control
- `/display` for the audience output
- `/stage` for the confidence monitor

The first version uses hardcoded demo data and Socket.IO to prove the realtime workflow.

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

## Demo Workflow

1. Open `/operator` on your control machine.
2. Open `/display` on the audience screen.
3. Open `/stage` on a confidence monitor.
4. Click any slide in the playlist and use `Go Live` to push it to the other views.
5. Use `Next`, `Previous`, `Blackout`, and `Logo` to control the live output in realtime.

## Keyboard Shortcuts

- `Right Arrow`: next slide
- `Left Arrow`: previous slide
- `B`: toggle blackout
- `L`: toggle logo

## Render Deployment

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Runtime: Node
- The Express server serves both the API/Socket.IO backend and the built frontend from `dist`.

## Notes

- The server runs on `http://localhost:3001`.
- The frontend runs on `http://localhost:5173`.
- Live state is stored in memory only.
- No authentication, persistence, slide editing, or external APIs are included in this MVP.
