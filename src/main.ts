import "./style.css";
import { Ace21Engine } from "./game/simulation/engine";
import { createAce21Game } from "./phaser/createAce21Game";
import { PlayScene } from "./phaser/scenes/PlayScene";
import type Phaser from "phaser";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("无法找到 #app 容器。");
}

app.innerHTML = `
  <main class="stage-shell">
    <section id="home-page" class="home-page">
      <div class="home-top">
        <button id="settings-btn" class="home-icon-btn" type="button" aria-label="设置">
          ⚙
        </button>
        <button id="levels-btn" class="home-icon-btn" type="button" aria-label="关卡选择">
          ☰
        </button>
        <div class="home-beans">
          <span class="bean-icon">⭐</span>
          <span id="home-bean-value">0</span>
        </div>
      </div>
      <div class="home-center">
        <h1 class="home-title">Ace 24</h1>
        <button id="start-game" class="home-start" type="button">Play</button>
      </div>
    </section>
    <section id="levels-page" class="levels-page hidden">
      <div class="levels-header">
        <button id="levels-back" class="home-icon-btn levels-back-btn" type="button" aria-label="返回">←</button>
        <h2 class="levels-title">LEVEL SELECT</h2>
      </div>
      <div id="levels-grid" class="levels-grid"></div>
    </section>
    <section id="game-page" class="game-page hidden">
      <div id="game-canvas" class="game-canvas"></div>
    </section>
  </main>
`;

const engine = new Ace21Engine();
let game: Phaser.Game | null = null;
let playScene: PlayScene | null = null;

const homePage = document.querySelector<HTMLElement>("#home-page");
const gamePage = document.querySelector<HTMLElement>("#game-page");
const levelsPage = document.querySelector<HTMLElement>("#levels-page");
const startGameButton = document.querySelector<HTMLButtonElement>("#start-game");
const settingsButton = document.querySelector<HTMLButtonElement>("#settings-btn");
const levelsBtnHome = document.querySelector<HTMLButtonElement>("#levels-btn");
const levelsBackBtn = document.querySelector<HTMLButtonElement>("#levels-back");
const levelsGrid = document.querySelector<HTMLElement>("#levels-grid");
const homeBeanValue = document.querySelector<HTMLElement>("#home-bean-value");

if (!homePage || !gamePage || !levelsPage || !startGameButton || !settingsButton
  || !levelsBtnHome || !levelsBackBtn || !levelsGrid || !homeBeanValue) {
  throw new Error("主页元素缺失。");
}

const syncHomeBalance = (): void => {
  const snapshot = engine.getSnapshot();
  homeBeanValue.textContent = String(snapshot.beans);
};

const showHome = (): void => {
  syncHomeBalance();
  levelsPage.classList.add("hidden");
  gamePage.classList.add("hidden");
  homePage.classList.remove("hidden");
};

const showGame = (): void => {
  homePage.classList.add("hidden");
  levelsPage.classList.add("hidden");
  gamePage.classList.remove("hidden");
};

const mountGame = (): void => {
  if (game) {
    return;
  }

  playScene = new PlayScene(
    engine,
    () => {
      // snapshot updates are handled inside PlayScene
    },
    showHome
  );

  game = createAce21Game("game-canvas", playScene);
};

const populateLevels = (): void => {
  levelsGrid.innerHTML = "";
  const snapshot = engine.getSnapshot();

  for (let i = 0; i < 100; i++) {
    const tierIdx = Math.floor(i / 10);
    const unlocked = engine.isLevelUnlocked(i);
    const stars = engine.getLevelBestStars(i);

    // Insert tier header every 10 levels
    if (i % 10 === 0) {
      const tierHeader = document.createElement("div");
      tierHeader.className = "levels-tier-header";
      tierHeader.textContent = "Tier " + (tierIdx + 1);
      levelsGrid.appendChild(tierHeader);
    }

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "level-cell";

    if (!unlocked) {
      cell.classList.add("locked");
      cell.disabled = true;
    } else if (stars > 0) {
      cell.classList.add("cleared");
    }

    const starStr = unlocked
      ? (stars > 0 ? "★".repeat(stars) + "☆".repeat(3 - stars) : "◦◦◦")
      : "□";

    cell.innerHTML =
      "<span class=\"level-num\">" + (i + 1) + "</span>" +
      "<span class=\"level-stars\">" + starStr + "</span>";

    if (unlocked) {
      cell.addEventListener("click", () => {
        const result = engine.goToLevel(i);
        if (result.ok) {
          levelsPage.classList.add("hidden");
          mountGame();
          if (playScene) {
            playScene.syncView();
          }
          showGame();
        }
      });
    }

    levelsGrid.appendChild(cell);
  }

  // Show current level indicator
  const currentCell = levelsGrid.querySelectorAll<HTMLButtonElement>(".level-cell:not(.locked)")[snapshot.levelIndex];
  if (currentCell) {
    currentCell.classList.add("current");
    currentCell.scrollIntoView({ block: "center" });
  }
};

const showLevels = (): void => {
  syncHomeBalance();
  populateLevels();
  homePage.classList.add("hidden");
  levelsPage.classList.remove("hidden");
};

startGameButton.addEventListener("click", () => {
  mountGame();
  showGame();
});

settingsButton.addEventListener("click", () => {
  settingsButton.classList.add("spin-once");
  window.setTimeout(() => {
    settingsButton.classList.remove("spin-once");
  }, 260);
});

levelsBtnHome.addEventListener("click", showLevels);
levelsBackBtn.addEventListener("click", showHome);

syncHomeBalance();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (game) {
      game.destroy(true);
      game = null;
      playScene = null;
    }
  });
}
