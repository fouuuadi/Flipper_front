import "./style.css";
import { env } from "@config/env";

function bootstrap(): void {
  if (env.isDev) {
    console.log(`[Flipper] ${env.mode} mode — API: ${env.apiBaseUrl}`);
  }

  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("#app element not found");

  app.innerHTML = `<h1>${env.appTitle}</h1>`;
}

bootstrap();
