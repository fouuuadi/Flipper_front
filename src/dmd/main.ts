import "../styles/global.css";
import { matchSync } from "@services/matchSync";
import { DmdApp } from "@modules/dmd";

const host = document.querySelector<HTMLDivElement>("#app");
if (host) {
  const app = new DmdApp(host);
  // Bus borne partagé, connecté au boot — le DMD ne fait que consommer les events.
  matchSync.connectBorne();
  app.start(matchSync);

  // ── Simulateur d'events (dev only) ──
  if (import.meta.env.DEV && !new URLSearchParams(location.search).get("session_id")) {
    // accessible depuis la console : tape `dmd.simulate({...})`
    (window as unknown as { dmd: DmdApp }).dmd = app;

    let score = 0;
    const fire = (e: Parameters<typeof app.simulate>[0]) => {
      try {
        app.simulate(e);
      } catch (err) {
        console.error("simulate() a échoué :", err);
        alert("Erreur simulate() — voir console.\n" + err);
      }
    };

    const actions: Array<[string, () => void]> = [
      ["Ready", () => fire({ type: "match:state", status: "ready", sessionId: "dev" })],
      [
        "Countdown",
        () => {
          [3, 2, 1, 0].forEach((v, i) =>
            setTimeout(() => fire({ type: "countdown:tick", value: v as 3 | 2 | 1 | 0 }), i * 1000),
          );
          setTimeout(() => fire({ type: "match:state", status: "playing", sessionId: "dev" }), 4200);
        },
      ],
      ["Score", () => { score += 1500; fire({ type: "score:update", score, combo: 1 }); }],
      ["Combo x4", () => { score += 2400; fire({ type: "score:update", score, combo: 4 }); }],
      ["Ball Lost", () => fire({ type: "ball:lost", livesRemaining: 2 })],
      ["Pause", () => fire({ type: "match:state", status: "paused", sessionId: "dev" })],
      [
        "Game Over",
        () => {
          fire({ type: "game:over", finalScore: score });
          fire({ type: "match:state", status: "over", sessionId: "dev" });
        },
      ],
    ];

    const bar = document.createElement("div");
    bar.style.cssText =
      "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:8px;flex-wrap:wrap;justify-content:center;z-index:9999;font-family:sans-serif";
    for (const [label, fn] of actions) {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText =
        "padding:10px 14px;border:none;border-radius:8px;background:#ffa502;color:#14081f;font-weight:700;cursor:pointer";
      b.onclick = fn;
      bar.appendChild(b);
    }
    document.body.appendChild(bar);

    console.log("%cDMD sim prêt", "color:#ffa502", "→ boutons en bas, ou tape dmd.simulate({...}) dans la console");
  }
}