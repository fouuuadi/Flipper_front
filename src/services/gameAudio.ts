// [Music] ici on gere la music : chemin vers le fichier son du bumper
const BUMPER_TRACK = "/audio/Mario/Bumper.wav";

class GameAudioController {
  private enabled = false;
  private unlocked = false;

  // [Music] ici on gere la music : active le service audio au démarrage du jeu
  enable(): void {
    this.enabled = true;
    this.bindUnlock();
  }

  // [Music] ici on gere la music : joue le son du bumper
  playBumper(): void {
    console.log("[gameAudio] playBumper appelé, enabled:", this.enabled, "unlocked:", this.unlocked);
    this.playOneShot(BUMPER_TRACK);
  }

  // [Music] ici on gere la music : joue un son une seule fois (one-shot)
  private playOneShot(src: string): void {
    if (!this.enabled) return;
    const audio = new Audio(src);
    void audio.play().catch((err) => {
      console.warn("[gameAudio] play() bloqué par le navigateur :", err);
    });
  }

  // [Music] ici on gere la music : attend la première interaction utilisateur
  // pour débloquer l'audio (politique autoplay des navigateurs)
  private bindUnlock(): void {
    if (this.unlocked) return;
    const unlock = () => {
      this.unlocked = true;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }
}

// [Music] ici on gere la music : instance unique partagée dans toute l'app
export const gameAudio = new GameAudioController();
