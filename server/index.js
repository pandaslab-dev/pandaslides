import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";

const demoService = {
  title: "Sunday Service",
  items: [
    {
      id: "welcome",
      title: "Welcome",
      type: "intro",
      subtitle: "Panda Community Church",
      slides: [
        {
          id: "welcome-1",
          label: "Opening",
          lines: ["Welcome to Panda Community Church", "We are glad you're here", "Service begins in a few moments"],
          footer: "PANDASLIDES",
        },
      ],
    },
    {
      id: "worship-song",
      title: "Worship Song",
      type: "song",
      subtitle: "Great Are You Lord",
      slides: [
        {
          id: "song-1",
          label: "Verse 1",
          lines: [
            "You give life, You are love",
            "You bring light to the darkness",
            "You give hope, You restore",
            "Every heart that is broken",
            "Great are You, Lord",
          ],
          footer: "GREAT ARE YOU LORD",
        },
        {
          id: "song-2",
          label: "Chorus",
          lines: [
            "It's Your breath in our lungs",
            "So we pour out our praise",
            "We pour out our praise",
            "It's Your breath in our lungs",
            "So we pour out our praise to You only",
          ],
          footer: "GREAT ARE YOU LORD",
        },
        {
          id: "song-3",
          label: "Verse 2",
          lines: [
            "You give life, You are love",
            "You bring light to the darkness",
            "You give hope, You restore",
            "Every heart that is broken",
            "Great are You, Lord",
          ],
          footer: "GREAT ARE YOU LORD",
        },
      ],
    },
    {
      id: "scripture",
      title: "Scripture",
      type: "scripture",
      subtitle: "John 3:16",
      slides: [
        {
          id: "scripture-1",
          label: "Reading",
          lines: [
            "For God so loved the world",
            "that He gave His one and only Son,",
            "that whoever believes in Him",
            "shall not perish but have eternal life.",
          ],
          footer: "JOHN 3:16",
        },
      ],
    },
    {
      id: "sermon-title",
      title: "Sermon Title",
      type: "sermon",
      subtitle: "Faithful in the Small Things",
      slides: [
        {
          id: "sermon-1",
          label: "Message Intro",
          lines: ["Faithful in the Small Things", "Pastor Jamie Chen"],
          footer: "SERMON",
        },
      ],
    },
    {
      id: "announcements",
      title: "Announcements",
      type: "announcements",
      subtitle: "This Week",
      slides: [
        {
          id: "announcements-1",
          label: "Community Night",
          lines: ["Wednesday Community Night", "Dinner at 6:00 PM", "Groups begin at 7:00 PM"],
          footer: "ANNOUNCEMENTS",
        },
        {
          id: "announcements-2",
          label: "Serve Team",
          lines: ["Serve Team Lunch", "Sunday after second service", "Sign up in the lobby"],
          footer: "ANNOUNCEMENTS",
        },
      ],
    },
    {
      id: "closing",
      title: "Closing",
      type: "closing",
      subtitle: "Benediction",
      slides: [
        {
          id: "closing-1",
          label: "Closing Blessing",
          lines: ["Thank you for being with us", "Go in peace and be a blessing this week"],
          footer: "SEE YOU NEXT SUNDAY",
        },
      ],
    },
  ],
};

function flattenSlides(service) {
  return service.items.flatMap((item, itemIndex) =>
    item.slides.map((slide, slideIndex) => ({
      item,
      slide,
      pointer: { itemIndex, slideIndex },
    })),
  );
}

function getNextPointer(service, pointer) {
  const flatSlides = flattenSlides(service);
  const currentIndex = flatSlides.findIndex(
    (entry) => entry.pointer.itemIndex === pointer.itemIndex && entry.pointer.slideIndex === pointer.slideIndex,
  );

  if (currentIndex === -1) {
    return pointer;
  }

  return flatSlides[Math.min(currentIndex + 1, flatSlides.length - 1)].pointer;
}

function getPreviousPointer(service, pointer) {
  const flatSlides = flattenSlides(service);
  const currentIndex = flatSlides.findIndex(
    (entry) => entry.pointer.itemIndex === pointer.itemIndex && entry.pointer.slideIndex === pointer.slideIndex,
  );

  if (currentIndex === -1) {
    return pointer;
  }

  return flatSlides[Math.max(currentIndex - 1, 0)].pointer;
}

function isValidPointer(service, pointer) {
  return Boolean(service.items[pointer.itemIndex]?.slides[pointer.slideIndex]);
}

const liveState = {
  service: demoService,
  selected: { itemIndex: 0, slideIndex: 0 },
  live: { itemIndex: 0, slideIndex: 0 },
  blackout: false,
  logo: false,
};

function applyAction(action) {
  switch (action?.type) {
    case "select":
      if (action.payload && isValidPointer(liveState.service, action.payload)) {
        liveState.selected = action.payload;
      }
      break;
    case "goLive":
      if (action.payload && isValidPointer(liveState.service, action.payload)) {
        liveState.selected = action.payload;
        liveState.live = action.payload;
      } else {
        liveState.live = liveState.selected;
      }
      break;
    case "next": {
      const nextPointer = getNextPointer(liveState.service, liveState.live);
      liveState.live = nextPointer;
      liveState.selected = nextPointer;
      break;
    }
    case "previous": {
      const previousPointer = getPreviousPointer(liveState.service, liveState.live);
      liveState.live = previousPointer;
      liveState.selected = previousPointer;
      break;
    }
    case "toggleBlackout":
      liveState.blackout = !liveState.blackout;
      if (liveState.blackout) {
        liveState.logo = false;
      }
      break;
    case "toggleLogo":
      liveState.logo = !liveState.logo;
      if (liveState.logo) {
        liveState.blackout = false;
      }
      break;
    default:
      break;
  }
}

const app = express();
const httpServer = createServer(app);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../dist");
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? true : ["http://localhost:5173"],
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

app.get("/api/service", (_request, response) => {
  response.json(demoService);
});

app.get("/api/state", (_request, response) => {
  response.json(liveState);
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(distDir));

  app.get("/{*path}", (_request, response) => {
    response.sendFile(path.join(distDir, "index.html"));
  });
}

io.on("connection", (socket) => {
  socket.emit("live-state:update", liveState);

  socket.on("operator:action", (action) => {
    applyAction(action);
    io.emit("live-state:update", liveState);
  });
});

const port = Number(process.env.PORT ?? 3001);

httpServer.listen(port, () => {
  console.log(`PandaSlides server listening on http://localhost:${port}`);
});
