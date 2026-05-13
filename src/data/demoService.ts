import type { PandaSlidesProject } from "../types/project";

export const demoService: PandaSlidesProject = {
  id: "demo-sunday-service",
  title: "Sunday Service",
  kind: "demo",
  updatedAt: "2026-05-13T12:00:00.000Z",
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
