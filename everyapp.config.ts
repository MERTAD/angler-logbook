import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "angler-logbook",
  name: "Angler Logbook",
  description:
    "Keep your own angling spots, trotlines and catches on a map, and plan trips with sun, moon and fish activity forecasts.",
  icon: "/icon.svg",
  resources: {
    d1: ["DB"],
    r2: ["photos"],
  },
});
