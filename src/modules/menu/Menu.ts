import { Button, NeonText } from "@modules/ui";
import { gameStore } from "@core/gameStore";
import "./menu.css";

/**
 * Menu principal — point d'entrée après le splash.
 *
 * Les actions n'appellent pas le back ; elles transitent juste la state machine.
 * `POST /sessions` arrive plus tard (cf. #75, dans l'écran `identification`).
 */
export class Menu {
  private readonly root: HTMLElement;
  private readonly playButton: Button;
  private readonly leaderboardButton: Button;
  private readonly title: NeonText;
  private readonly subtitle: NeonText;

  constructor() {
    this.root = document.createElement("section");
    this.root.className = "menu-scene";

    const card = document.createElement("div");
    card.className = "menu-card";
    this.root.appendChild(card);

    const titleWrap = document.createElement("div");
    titleWrap.className = "menu-title-wrap";
    card.appendChild(titleWrap);

    this.title = new NeonText({
      text: "Mario Galaxy",
      glow: "cyan",
      size: "xl",
      as: "h1",
    });
    this.title.mount(titleWrap);

    this.subtitle = new NeonText({
      text: "Pinball",
      glow: "pink",
      size: "lg",
      as: "h2",
    });
    this.subtitle.mount(titleWrap);

    const actions = document.createElement("div");
    actions.className = "menu-actions";
    this.playButton = new Button({
      label: "Jouer",
      variant: "primary",
      onClick: () => gameStore.send({ type: "START_GAME" }),
    });
    this.leaderboardButton = new Button({
      label: "Leaderboard",
      variant: "ghost",
      onClick: () => gameStore.send({ type: "OPEN_LEADERBOARD" }),
    });
    this.playButton.mount(actions);
    this.leaderboardButton.mount(actions);
    card.appendChild(actions);
  }

  mount(host: HTMLElement = document.body): void {
    host.appendChild(this.root);
  }

  unmount(): void {
    this.title.unmount();
    this.subtitle.unmount();
    this.playButton.unmount();
    this.leaderboardButton.unmount();
    this.root.remove();
  }
}
