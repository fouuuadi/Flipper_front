import "../styles/global.css";
import { matchSync } from "@services/matchSync";
import { DmdApp } from "@modules/dmd";

const host = document.querySelector<HTMLDivElement>("#app");
if (host) {
  const app = new DmdApp(host);
  // Bus borne partagé, connecté au boot — le DMD ne fait que consommer les events.
  matchSync.connectBorne();
  app.start(matchSync);
}
