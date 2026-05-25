import "./button.css";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonOptions {
  readonly label: string;
  readonly variant?: ButtonVariant;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
}

export class Button {
  private readonly el: HTMLButtonElement;
  private clickHandler: (() => void) | null = null;

  constructor(options: ButtonOptions) {
    this.el = document.createElement("button");
    this.el.type = "button";
    this.el.className = `ui-button ui-button--${options.variant ?? "primary"}`;
    this.el.textContent = options.label;
    if (options.disabled) {
      this.el.disabled = true;
    }
    if (options.onClick) {
      this.clickHandler = options.onClick;
      this.el.addEventListener("click", this.clickHandler);
    }
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  unmount(): void {
    if (this.clickHandler) {
      this.el.removeEventListener("click", this.clickHandler);
      this.clickHandler = null;
    }
    this.el.remove();
  }

  setDisabled(disabled: boolean): void {
    this.el.disabled = disabled;
  }

  setLabel(label: string): void {
    this.el.textContent = label;
  }
}
