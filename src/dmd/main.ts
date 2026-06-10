import "../styles/global.css";
import { DmdApp } from "@modules/dmd";

const host = document.querySelector<HTMLDivElement>("#app");
if (host) {
  const app = new DmdApp(host);
  app.start();
}
