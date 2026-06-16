import { gameStore } from "@core/gameStore";
import "./settings.css";

interface SettingSlider {
  readonly title: string;
  readonly description: string;
  readonly value: number;
}

const SLIDERS: readonly SettingSlider[] = [
  { title: "SFX", description: "Effets sonores", value: 78 },
  { title: "MUSIQUE", description: "Volume de la musique", value: 65 },
];

export class Settings {
  private readonly root: HTMLElement;

  constructor() {
    this.root = document.createElement("section");
    this.root.className = "settings-scene";
    this.root.appendChild(this.createBackground());
    this.root.appendChild(this.createHeader());
    this.root.appendChild(this.createPanel());
    this.root.appendChild(this.createFooter());
  }

  mount(host: HTMLElement = document.body): void {
    host.appendChild(this.root);
  }

  unmount(): void {
    this.root.remove();
  }

  private createBackground(): DocumentFragment {
    const fragment = document.createDocumentFragment();
    ["settings-starfield", "settings-nebula settings-nebula--left", "settings-nebula settings-nebula--right"].forEach(
      (className) => {
        const layer = document.createElement("div");
        layer.className = className;
        layer.setAttribute("aria-hidden", "true");
        fragment.appendChild(layer);
      },
    );
    return fragment;
  }

  private createHeader(): HTMLElement {
    const header = document.createElement("header");
    header.className = "settings-header";

    const backButton = document.createElement("button");
    backButton.className = "settings-back-button";
    backButton.type = "button";
    backButton.setAttribute("aria-label", "Retour au menu");
    backButton.addEventListener("click", () => gameStore.send({ type: "BACK_TO_MENU" }));

    const arrow = document.createElement("img");
    arrow.src = "/images/cosmetics/Fleche.png";
    arrow.alt = "";
    arrow.setAttribute("aria-hidden", "true");
    backButton.appendChild(arrow);
    header.appendChild(backButton);

    const title = document.createElement("h1");
    title.textContent = "PARAMETRES";
    header.appendChild(title);

    const spacer = document.createElement("div");
    spacer.className = "settings-spacer";
    header.appendChild(spacer);

    return header;
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement("section");
    panel.className = "settings-panel";
    panel.setAttribute("aria-label", "Reglages audio et vibration");

    const frame = document.createElement("div");
    frame.className = "settings-panel-frame";

    SLIDERS.forEach((slider) => frame.appendChild(this.createSliderRow(slider)));
    frame.appendChild(this.createToggleRow());
    panel.appendChild(frame);

    return panel;
  }

  private createSliderRow(setting: SettingSlider): HTMLElement {
    const row = this.createRow(setting.title, setting.description);

    const slider = document.createElement("input");
    slider.className = "settings-slider";
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.value = String(setting.value);
    slider.setAttribute("aria-label", setting.description);
    row.appendChild(slider);

    return row;
  }

  private createToggleRow(): HTMLElement {
    const row = this.createRow("VIBRATION", "Retour haptique");
    row.classList.add("settings-toggle-row");

    const label = document.createElement("label");
    label.className = "settings-toggle";
    label.setAttribute("aria-label", "Activer ou desactiver la vibration");

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = true;
    label.appendChild(input);

    const track = document.createElement("span");
    track.className = "settings-toggle-track";

    const thumb = document.createElement("span");
    thumb.className = "settings-toggle-thumb";
    track.appendChild(thumb);
    label.appendChild(track);
    row.appendChild(label);

    return row;
  }

  private createRow(titleText: string, descriptionText: string): HTMLElement {
    const row = document.createElement("div");
    row.className = "settings-row";

    const labels = document.createElement("div");
    labels.className = "settings-labels";

    const title = document.createElement("span");
    title.className = "settings-title";
    title.textContent = titleText;
    labels.appendChild(title);

    const description = document.createElement("span");
    description.className = "settings-desc";
    description.textContent = descriptionText;
    labels.appendChild(description);

    row.appendChild(labels);
    return row;
  }

  private createFooter(): HTMLElement {
    const footer = document.createElement("footer");
    footer.className = "settings-footer";

    const applyButton = document.createElement("button");
    applyButton.className = "settings-action-button settings-action-button--primary";
    applyButton.type = "button";
    applyButton.textContent = "APPLIQUER";
    footer.appendChild(applyButton);

    const backButton = document.createElement("button");
    backButton.className = "settings-action-button";
    backButton.type = "button";
    backButton.textContent = "RETOUR";
    backButton.addEventListener("click", () => gameStore.send({ type: "BACK_TO_MENU" }));
    footer.appendChild(backButton);

    return footer;
  }
}
