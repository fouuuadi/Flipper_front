const SPLASH_TRACK = "/audio/Menu/HeticGalaxy.mp3";
const MENU_TRACK = "/audio/Menu/SMG_Menu.mp3";
const CLICK_TRACK = "/audio/Menu/Click.wav";
const MUSIC_VOLUME_KEY = "flipper.menu.musicVolume";
const SFX_VOLUME_KEY = "flipper.menu.sfxVolume";
const MUSIC_MUTED_KEY = "flipper.menu.musicMuted";

type TrackKind = "splash" | "menu";

class MenuAudioController {
  private enabled = false;
  private audio: HTMLAudioElement | null = null;
  private current: TrackKind | null = null;
  private pending: { kind: TrackKind; src: string } | null = null;
  private unlockBound = false;
  private clickFeedbackBound = false;

  enable(): void {
    this.enabled = true;
  }

  playSplash(): void {
    if (!this.enabled) return;
    this.play("splash", SPLASH_TRACK);
  }

  playMenu(): void {
    if (!this.enabled) return;
    this.play("menu", MENU_TRACK);
  }

  playClick(): void {
    if (!this.enabled) return;
    const audio = new Audio(CLICK_TRACK);
    audio.volume = this.getSfxVolume() / 100;
    void audio.play().catch(() => {});
  }

  startClickFeedback(): void {
    if (!this.enabled || this.clickFeedbackBound || typeof document === "undefined") return;
    this.clickFeedbackBound = true;

    document.addEventListener(
      "click",
      (event) => {
        if (!(event.target instanceof Element)) return;
        if (!event.target.closest("button")) return;
        this.playClick();
      },
      true,
    );
  }

  stop(): void {
    this.audio?.pause();
    this.audio = null;
    this.current = null;
    this.pending = null;
  }

  getMusicVolume(): number {
    return readPercent(MUSIC_VOLUME_KEY, 65);
  }

  setMusicVolume(value: number): void {
    const volume = clampPercent(value);
    localStorage.setItem(MUSIC_VOLUME_KEY, String(volume));
    if (this.audio) this.audio.volume = this.effectiveVolume();
  }

  getSfxVolume(): number {
    return readPercent(SFX_VOLUME_KEY, 78);
  }

  setSfxVolume(value: number): void {
    localStorage.setItem(SFX_VOLUME_KEY, String(clampPercent(value)));
  }

  isMuted(): boolean {
    return localStorage.getItem(MUSIC_MUTED_KEY) === "true";
  }

  setMuted(muted: boolean): void {
    localStorage.setItem(MUSIC_MUTED_KEY, String(muted));
    if (this.audio) this.audio.muted = muted;
  }

  private play(kind: TrackKind, src: string): void {
    if (this.current === kind && this.audio) {
      this.applyPreferences(this.audio);
      if (this.audio.paused) this.tryPlay(this.audio, kind, src);
      return;
    }

    this.audio?.pause();
    const audio = new Audio(src);
    audio.loop = kind === "menu";
    this.applyPreferences(audio);
    this.audio = audio;
    this.current = kind;
    this.pending = null;
    this.tryPlay(audio, kind, src);
  }

  private tryPlay(audio: HTMLAudioElement, kind: TrackKind, src: string): void {
    void audio.play().catch(() => {
      this.pending = { kind, src };
      this.bindUnlock();
    });
  }

  private bindUnlock(): void {
    if (this.unlockBound) return;
    this.unlockBound = true;
    const unlock = () => {
      this.unlockBound = false;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      const pending = this.pending;
      if (!pending) return;
      this.pending = null;
      this.play(pending.kind, pending.src);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }

  private applyPreferences(audio: HTMLAudioElement): void {
    audio.volume = this.effectiveVolume();
    audio.muted = this.isMuted();
  }

  private effectiveVolume(): number {
    return this.getMusicVolume() / 100;
  }
}

function readPercent(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? clampPercent(parsed) : fallback;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export const menuAudio = new MenuAudioController();
