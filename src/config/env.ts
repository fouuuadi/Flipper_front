/*Centralise l'accès typé aux variables d'environnement*/

interface EnvConfig {
  mode: string;
  isDev: boolean;
  isProd: boolean;
  apiBaseUrl: string;
  wsUrl: string;
  appTitle: string;
}

export const env: EnvConfig = {
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string) ?? "http://localhost:8080",
  wsUrl: (import.meta.env.VITE_WS_URL as string) ?? "ws://localhost:8080/ws",
  appTitle: (import.meta.env.VITE_APP_TITLE as string) ?? "Flipper",
};
