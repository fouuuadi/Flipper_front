import "../styles/global.css";
import { BackglassApp } from "@modules/backglass";

const host = document.querySelector<HTMLDivElement>("#app");
if (host) {
  const app = new BackglassApp(host);
  app.start();
}
