import "./input.css";

export interface InputOptions {
  readonly label?: string;
  readonly placeholder?: string;
  readonly value?: string;
  readonly maxLength?: number;
  readonly onInput?: (value: string) => void;
  readonly onSubmit?: (value: string) => void;
}

export class Input {
  private readonly root: HTMLLabelElement;
  private readonly inputEl: HTMLInputElement;
  private readonly errorEl: HTMLSpanElement;
  private inputHandler: ((event: Event) => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(options: InputOptions) {
    this.root = document.createElement("label");
    this.root.className = "ui-input";

    if (options.label) {
      const labelEl = document.createElement("span");
      labelEl.className = "ui-input__label";
      labelEl.textContent = options.label;
      this.root.appendChild(labelEl);
    }

    this.inputEl = document.createElement("input");
    this.inputEl.type = "text";
    this.inputEl.className = "ui-input__field";
    if (options.placeholder) this.inputEl.placeholder = options.placeholder;
    if (options.value) this.inputEl.value = options.value;
    if (options.maxLength) this.inputEl.maxLength = options.maxLength;
    this.inputEl.autocomplete = "off";
    this.inputEl.spellcheck = false;
    this.root.appendChild(this.inputEl);

    this.errorEl = document.createElement("span");
    this.errorEl.className = "ui-input__error";
    this.errorEl.setAttribute("aria-live", "polite");
    this.root.appendChild(this.errorEl);

    if (options.onInput) {
      const cb = options.onInput;
      this.inputHandler = () => cb(this.inputEl.value);
      this.inputEl.addEventListener("input", this.inputHandler);
    }

    if (options.onSubmit) {
      const cb = options.onSubmit;
      this.keyHandler = (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          cb(this.inputEl.value);
        }
      };
      this.inputEl.addEventListener("keydown", this.keyHandler);
    }
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.root);
  }

  unmount(): void {
    if (this.inputHandler) {
      this.inputEl.removeEventListener("input", this.inputHandler);
      this.inputHandler = null;
    }
    if (this.keyHandler) {
      this.inputEl.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    this.root.remove();
  }

  focus(): void {
    this.inputEl.focus();
  }

  getValue(): string {
    return this.inputEl.value;
  }

  setValue(value: string): void {
    this.inputEl.value = value;
  }

  setError(message: string | null): void {
    if (message) {
      this.root.classList.add("ui-input--error");
      this.errorEl.textContent = message;
    } else {
      this.root.classList.remove("ui-input--error");
      this.errorEl.textContent = "";
    }
  }

  setDisabled(disabled: boolean): void {
    this.inputEl.disabled = disabled;
  }
}
