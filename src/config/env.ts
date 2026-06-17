/*Centralise l'accès typé aux variables d'environnement*/

interface EnvConfig {
  mode: string;
  isDev: boolean;
  isProd: boolean;
  apiBaseUrl: string;
  wsUrl: string;
  borneId: string;
  appTitle: string;
}

/**
 * URL WS par défaut, dérivée de l'origine courante (same-origin).
 * En prod la borne sert le front derrière un nginx qui proxy `/ws` vers le
 * backend ; en dev, le proxy Vite (cf. vite.config.ts) fait le même mapping.
 * Garde node-safe : `window` est absent en environnement de test.
 */
function defaultWsUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:8080/ws";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

export const env: EnvConfig = {
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  // URLs relatives same-origin : le reverse-proxy (nginx en prod, Vite en dev)
  // route `/api` et `/ws` vers le backend. Surchargeables via VITE_*.
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string) ?? "/api",
  wsUrl: (import.meta.env.VITE_WS_URL as string) ?? defaultWsUrl(),
  // Identifiant du canal borne partagé par les 3 écrans. DOIT correspondre au
  // `BORNE_ID` du backend (inliné au build par Vite). Défaut aligné sur le
  // `.env` backend de dev.
  borneId: (import.meta.env.VITE_BORNE_ID as string) ?? "flipper-cabinet-1",
  appTitle: (import.meta.env.VITE_APP_TITLE as string) ?? "Flipper",
};
