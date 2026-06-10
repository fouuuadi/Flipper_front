import "./modal.css";

export interface ModalOptions {
  readonly title?: string;
  readonly closeOnBackdrop?: boolean;
  readonly closeOnEscape?: boolean;
  readonly onClose?: () => void;
}

export class Modal {
  private readonly backdrop: HTMLDivElement;
  private readonly dialog: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private readonly closeOnBackdrop: boolean;
  private readonly closeOnEscape: boolean;
  private readonly closeCb: (() => void) | null;
  private backdropHandler: ((event: MouseEvent) => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(options: ModalOptions = {}) {
    this.closeOnBackdrop = options.closeOnBackdrop ?? true;
    this.closeOnEscape = options.closeOnEscape ?? true;
    this.closeCb = options.onClose ?? null;

    this.backdrop = document.createElement("div");
    this.backdrop.className = "ui-modal";
    this.backdrop.setAttribute("role", "presentation");

    this.dialog = document.createElement("div");
    this.dialog.className = "ui-modal__dialog";
    this.dialog.setAttribute("role", "dialog");
    this.dialog.setAttribute("aria-modal", "true");
    this.backdrop.appendChild(this.dialog);

    if (options.title) {
      const titleEl = document.createElement("h2");
      titleEl.className = "ui-modal__title";
      titleEl.textContent = options.title;
      this.dialog.appendChild(titleEl);
    }

    this.body = document.createElement("div");
    this.body.className = "ui-modal__body";
    this.dialog.appendChild(this.body);
  }

  /** Conteneur dans lequel injecter du contenu (formulaire, boutons, etc.). */
  getBody(): HTMLDivElement {
    return this.body;
  }

  mount(host: HTMLElement = document.body): void {
    host.appendChild(this.backdrop);

    if (this.closeOnBackdrop) {
      this.backdropHandler = (event) => {
        if (event.target === this.backdrop) {
          this.close();
        }
      };
      this.backdrop.addEventListener("click", this.backdropHandler);
    }

    if (this.closeOnEscape) {
      this.keyHandler = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          this.close();
        }
      };
      window.addEventListener("keydown", this.keyHandler);
    }
  }

  close(): void {
    if (this.backdropHandler) {
      this.backdrop.removeEventListener("click", this.backdropHandler);
      this.backdropHandler = null;
    }
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    this.backdrop.remove();
    this.closeCb?.();
  }
}
