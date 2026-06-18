import { dispatchIntent } from "@core/keyboardDispatcher";
import { matchSync } from "@services/matchSync";
import { menuAudio } from "@services/menuAudio";
import "./cosmetics.css";

interface SkinItem {
  readonly name: string;
  readonly image: string | null;
  readonly price: number | null;
  readonly owned?: boolean;
}

const ASSET_BASE = "/images/cosmetics/";
const SKINS: readonly SkinItem[] = [
  { name: "METAL BALL", image: "Balle-Metal.png", price: null, owned: true },
  { name: "LAVA BALL", image: "Balle-Lave.png", price: 500 },
  { name: "BOWSER BALL", image: "Bowser-Ball.png", price: 750 },
  { name: "STAR BALL", image: "Star-Ball.png", price: 650 },
  { name: "MARIO BALL", image: "MarioT.png", price: 700 },
  { name: "LUIGI BALL", image: "Luigi-Ball.png", price: 700 },
  { name: "HETIC COIN BALL", image: "HeticCoin-Balle.png", price: 900 },
  { name: "COMING SOON", image: null, price: 1000 },
  { name: "COMING SOON", image: null, price: 1000 },
];

export class CosmeticsStore {
  private readonly root: HTMLElement;

  constructor() {
    this.root = document.createElement("section");
    this.root.className = "cosmetics-scene";
    this.root.appendChild(this.createStarfield());
    this.root.appendChild(this.createHeader());
    this.root.appendChild(this.createHero());
    this.root.appendChild(this.createTabs());
    this.root.appendChild(this.createGrid());
    this.root.appendChild(this.createBottomNav());
  }

  mount(host: HTMLElement = document.body): void {
    host.appendChild(this.root);
    menuAudio.playMenu();
  }

  unmount(): void {
    this.root.remove();
  }

  private createStarfield(): HTMLElement {
    const starfield = document.createElement("div");
    starfield.className = "cosmetics-starfield";
    starfield.setAttribute("aria-hidden", "true");
    return starfield;
  }

  private createHeader(): HTMLElement {
    const header = document.createElement("header");
    header.className = "cosmetics-topbar";

    const backButton = document.createElement("button");
    backButton.className = "cosmetics-back-button";
    backButton.type = "button";
    backButton.setAttribute("aria-label", "Retour au menu");
    backButton.addEventListener("click", () =>
      dispatchIntent({ type: "BACK_TO_MENU" }, { sync: matchSync }),
    );

    const arrow = document.createElement("img");
    arrow.src = `${ASSET_BASE}Fleche.png`;
    arrow.alt = "";
    arrow.setAttribute("aria-hidden", "true");
    backButton.appendChild(arrow);
    header.appendChild(backButton);

    const currency = document.createElement("div");
    currency.className = "cosmetics-currency-pill";

    const coin = document.createElement("img");
    coin.src = `${ASSET_BASE}Hetic-Coin.png`;
    coin.alt = "Coin";
    currency.appendChild(coin);

    const amount = document.createElement("span");
    amount.textContent = "1250";
    currency.appendChild(amount);

    const addCoin = document.createElement("button");
    addCoin.className = "cosmetics-add-coin";
    addCoin.type = "button";
    addCoin.textContent = "+";
    currency.appendChild(addCoin);

    header.appendChild(currency);
    return header;
  }

  private createHero(): HTMLElement {
    const hero = document.createElement("div");
    hero.className = "cosmetics-hero";

    const leftStar = this.createStar("cosmetics-hero-star cosmetics-hero-star--left");
    const rightStar = this.createStar("cosmetics-hero-star cosmetics-hero-star--right");
    hero.append(leftStar, rightStar);

    const content = document.createElement("div");
    content.className = "cosmetics-hero-content";

    const subtitle = document.createElement("span");
    subtitle.className = "cosmetics-subtitle";
    subtitle.textContent = "COSMETIC STORE";
    content.appendChild(subtitle);

    const title = document.createElement("h1");
    title.textContent = "Boutique Cosmetique";
    content.appendChild(title);

    hero.appendChild(content);
    return hero;
  }

  private createStar(className: string): HTMLImageElement {
    const star = document.createElement("img");
    star.className = className;
    star.src = `${ASSET_BASE}star.png`;
    star.alt = "";
    star.setAttribute("aria-hidden", "true");
    return star;
  }

  private createTabs(): HTMLElement {
    const tabs = document.createElement("div");
    tabs.className = "cosmetics-tabs";

    const ballSkins = document.createElement("button");
    ballSkins.className = "cosmetics-tab cosmetics-tab--active";
    ballSkins.type = "button";
    ballSkins.textContent = "Ball Skins";
    tabs.appendChild(ballSkins);

    const trails = document.createElement("button");
    trails.className = "cosmetics-tab";
    trails.type = "button";
    trails.textContent = "Trails";
    tabs.appendChild(trails);

    return tabs;
  }

  private createGrid(): HTMLElement {
    const grid = document.createElement("div");
    grid.className = "cosmetics-grid";

    SKINS.forEach((skin, index) => {
      grid.appendChild(index === 0 ? this.createFeaturedCard(skin) : this.createSkinCard(skin));
    });

    return grid;
  }

  private createFeaturedCard(skin: SkinItem): HTMLElement {
    const card = document.createElement("article");
    card.className = "cosmetics-featured-card";

    const badge = document.createElement("div");
    badge.className = "cosmetics-equipped-badge";
    badge.textContent = "EQUIPPED";
    card.appendChild(badge);

    card.appendChild(this.createSkinPreview(skin, "cosmetics-featured-skin"));

    const title = document.createElement("h2");
    title.textContent = skin.name;
    card.appendChild(title);

    const state = document.createElement("p");
    state.textContent = skin.owned ? "Owned" : "";
    card.appendChild(state);

    return card;
  }

  private createSkinCard(skin: SkinItem): HTMLElement {
    const card = document.createElement("article");
    card.className = "cosmetics-skin-card";
    card.appendChild(this.createSkinPreview(skin, "cosmetics-skin-preview"));

    const title = document.createElement("h3");
    title.textContent = skin.name;
    card.appendChild(title);

    const buyButton = document.createElement("button");
    buyButton.className = "cosmetics-buy-button";
    buyButton.type = "button";

    const coin = document.createElement("img");
    coin.src = `${ASSET_BASE}Hetic-Coin.png`;
    coin.alt = "";
    coin.setAttribute("aria-hidden", "true");
    buyButton.appendChild(coin);

    const price = document.createElement("span");
    price.textContent = String(skin.price ?? "Owned");
    buyButton.appendChild(price);
    card.appendChild(buyButton);

    return card;
  }

  private createSkinPreview(skin: SkinItem, className: string): HTMLElement {
    const preview = document.createElement("div");
    preview.className = skin.image ? className : `${className} cosmetics-placeholder`;
    if (skin.image) {
      const img = document.createElement("img");
      img.src = `${ASSET_BASE}${skin.image}`;
      img.alt = skin.name;
      preview.appendChild(img);
    } else {
      preview.textContent = "?";
    }
    return preview;
  }

  private createBottomNav(): HTMLElement {
    const nav = document.createElement("nav");
    nav.className = "cosmetics-bottom-nav";
    nav.setAttribute("aria-label", "Navigation boutique");

    ["SHOP", "MISSIONS"].forEach((label, index) => {
      const item = document.createElement("button");
      item.className =
        index === 0 ? "cosmetics-nav-item cosmetics-nav-item--active" : "cosmetics-nav-item";
      item.type = "button";
      item.textContent = label;
      nav.appendChild(item);
    });

    const play = document.createElement("button");
    play.className = "cosmetics-nav-item cosmetics-play-button";
    play.type = "button";
    play.setAttribute("aria-label", "Jouer");
    play.addEventListener("click", () =>
      dispatchIntent({ type: "START_GAME" }, { sync: matchSync }),
    );
    const playIcon = document.createElement("img");
    playIcon.src = `${ASSET_BASE}IconPlay.PNG`;
    playIcon.alt = "";
    playIcon.setAttribute("aria-hidden", "true");
    play.appendChild(playIcon);
    nav.appendChild(play);

    ["SEASON", "PROFILE"].forEach((label) => {
      const item = document.createElement("button");
      item.className = "cosmetics-nav-item";
      item.type = "button";
      item.textContent = label;
      nav.appendChild(item);
    });

    return nav;
  }
}
