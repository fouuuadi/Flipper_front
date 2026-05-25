import "./neon-text.css";

export type NeonGlow =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "lime"
  | "blue"
  | "cyan"
  | "pink"
  | "white";

export type NeonSize = "sm" | "md" | "lg" | "xl";

export interface NeonTextOptions {
  readonly text: string;
  readonly glow?: NeonGlow;
  readonly size?: NeonSize;
  readonly as?: keyof HTMLElementTagNameMap;
}

export class NeonText {
  private readonly el: HTMLElement;

  constructor(options: NeonTextOptions) {
    const tag = options.as ?? "span";
    this.el = document.createElement(tag);
    this.el.className = [
      "ui-neon-text",
      `ui-neon-text--${options.size ?? "md"}`,
      `ui-neon-text--${options.glow ?? "cyan"}`,
    ].join(" ");
    this.el.textContent = options.text;
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  unmount(): void {
    this.el.remove();
  }

  setText(text: string): void {
    this.el.textContent = text;
  }
}
