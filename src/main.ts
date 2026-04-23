import './style.css';
import { Ace21Engine } from './game/simulation/engine';
import { createAce21Game } from './phaser/createAce21Game';
import { PlayScene } from './phaser/scenes/PlayScene';
import type Phaser from 'phaser';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('无法找到 #app 容器。');
}

app.innerHTML = `
  <main class="stage-shell">
    <section id="home-page" class="home-page">
      <div class="home-top">
        <button id="settings-btn" class="home-icon-btn" type="button" aria-label="设置">
          ⚙
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
    <section id="game-page" class="game-page hidden">
      <div id="game-canvas" class="game-canvas"></div>
    </section>
  </main>
`;

const engine = new Ace21Engine();
let game: Phaser.Game | null = null;

const homePage = document.querySelector<HTMLElement>('#home-page');
const gamePage = document.querySelector<HTMLElement>('#game-page');
const startGameButton = document.querySelector<HTMLButtonElement>('#start-game');
const settingsButton = document.querySelector<HTMLButtonElement>('#settings-btn');
const homeBeanValue = document.querySelector<HTMLElement>('#home-bean-value');

if (!homePage || !gamePage || !startGameButton || !settingsButton || !homeBeanValue) {
  throw new Error('主页元素缺失。');
}

const syncHomeBalance = (): void => {
  const snapshot = engine.getSnapshot();
  homeBeanValue.textContent = String(snapshot.beans);
};

const showHome = (): void => {
  syncHomeBalance();
  homePage.classList.remove('hidden');
  gamePage.classList.add('hidden');
};

const showGame = (): void => {
  homePage.classList.add('hidden');
  gamePage.classList.remove('hidden');
};

const mountGame = (): void => {
  if (game) {
    return;
  }

  const playScene = new PlayScene(
    engine,
    () => {
      // 关卡状态直接在场景内显示。
    },
    showHome
  );

  game = createAce21Game('game-canvas', playScene);
};

startGameButton.addEventListener('click', () => {
  mountGame();
  showGame();
});

settingsButton.addEventListener('click', () => {
  settingsButton.classList.add('spin-once');
  window.setTimeout(() => {
    settingsButton.classList.remove('spin-once');
  }, 260);
});

syncHomeBalance();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (game) {
      game.destroy(true);
      game = null;
    }
  });
}
