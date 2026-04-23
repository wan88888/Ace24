import Phaser from 'phaser';
import { Ace21Engine } from '../../game/simulation/engine';
import type { GameSnapshot, OperatorSymbol } from '../../game/simulation/types';

type MessageTone = 'neutral' | 'success' | 'error';

interface SceneCardView {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

interface OperatorView {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

export type SnapshotListener = (
  snapshot: GameSnapshot,
  message?: string,
  tone?: MessageTone
) => void;

const opSymbol = (label: string): string => {
  if (label === '*') {
    return '×';
  }

  if (label === '/') {
    return '÷';
  }

  if (label === 'sqrt') {
    return '√';
  }

  return label;
};

export class PlayScene extends Phaser.Scene {
  private readonly engine: Ace21Engine;
  private readonly onSnapshot: SnapshotListener;
  private readonly onBackHome: () => void;
  private topBeanText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private expressionText!: Phaser.GameObjects.Text;
  private currentValueText!: Phaser.GameObjects.Text;
  private cardViews: SceneCardView[] = [];
  private operatorViews: OperatorView[] = [];
  private renderedLevelId = -1;
  private numbersY = 470;

  private skipContainer!: Phaser.GameObjects.Container;
  private hintContainer!: Phaser.GameObjects.Container;
  private logHintText!: Phaser.GameObjects.Text;

  private successLayer!: Phaser.GameObjects.Container;
  private successPanel!: Phaser.GameObjects.Container;
  private successTitleText!: Phaser.GameObjects.Text;
  private successMetaText!: Phaser.GameObjects.Text;
  private successNextText!: Phaser.GameObjects.Text;
  private confettiPieces: Phaser.GameObjects.Rectangle[] = [];
  private modalOpen = false;
  private successIsLastLevel = false;

  constructor(
    engine: Ace21Engine,
    onSnapshot: SnapshotListener,
    onBackHome: () => void
  ) {
    super('play-scene');
    this.engine = engine;
    this.onSnapshot = onSnapshot;
    this.onBackHome = onBackHome;
  }

  public create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#f1efe7');

    this.drawPaperBackdrop(width, height);
    this.buildTopArea(width);
    this.buildWorldActors(width);
    this.buildUndoClearButtons(width);
    this.buildOperatorButtons(width, this.engine.getSnapshot().operatorSymbols);
    this.buildBottomButtons(width, height);
    this.buildLogHintText(width);
    this.buildSuccessModal(width, height);

    this.syncView();
  }

  public syncView(message?: string, tone: MessageTone = 'neutral'): void {
    const snapshot = this.engine.getSnapshot();

    if (snapshot.level.id !== this.renderedLevelId) {
      this.renderedLevelId = snapshot.level.id;
      this.buildCards(snapshot);
      this.buildOperatorButtons(this.scale.width, snapshot.operatorSymbols);
    }

    this.topBeanText.setText(String(snapshot.beans));
    this.levelText.setText(`LEVEL ${snapshot.level.id}`);
    this.currentValueText.setText(snapshot.movesUsed === 0 ? '' : String(snapshot.value));
    this.expressionText.setText(snapshot.expression);

    // HINT/SKIP disabled visual state
    const canSkip = !this.modalOpen && snapshot.beans >= snapshot.skipCost;
    const canHint = !this.modalOpen && snapshot.beans >= snapshot.hintCost;
    this.skipContainer.setAlpha(canSkip ? 1 : 0.42);
    this.hintContainer.setAlpha(canHint ? 1 : 0.42);

    // Log hint text visibility
    this.logHintText.setVisible(
      !this.modalOpen && snapshot.operatorSymbols.includes('log')
    );

    const used = new Set(snapshot.usedNumberIndices);

    this.cardViews.forEach((view, index) => {
      const isUsed = used.has(index);
      view.body.setFillStyle(isUsed ? 0xcdced2 : 0xf4f4f4, 1);
      view.label.setColor(isUsed ? '#8a8c93' : '#35373a');

      if (isUsed || this.modalOpen) {
        view.container.disableInteractive();
      } else {
        view.container.setInteractive({ useHandCursor: true });
      }
    });

    this.operatorViews.forEach((view) => {
      view.body.setFillStyle(this.modalOpen ? 0xcccccc : 0xf7dc3c, 1);
      view.label.setColor(this.modalOpen ? '#919191' : '#3b3b3b');

      if (this.modalOpen) {
        view.container.disableInteractive();
      } else {
        view.container.setInteractive({ useHandCursor: true });
      }
    });

    if (snapshot.targetReached) {
      this.currentValueText.setColor('#2e8b45');
    } else {
      this.currentValueText.setColor('#4f4f4f');
    }

    this.onSnapshot(snapshot, message, tone);
  }

  private onCardSelected(index: number): void {
    if (this.modalOpen) {
      return;
    }

    const result = this.engine.playCard(index);
    this.syncView(result.message, result.ok ? 'neutral' : 'error');

    if (!result.ok) {
      return;
    }

    this.tryHandleTargetReached();
  }

  private onOperatorSelected(operator: OperatorSymbol): void {
    if (this.modalOpen) {
      return;
    }

    const result = this.engine.playOperator(operator);
    this.syncView(result.message, result.ok ? 'neutral' : 'error');

    if (!result.ok) {
      return;
    }

    this.tryHandleTargetReached();
  }

  private tryHandleTargetReached(): void {
    const snapshot = this.engine.getSnapshot();
    if (snapshot.targetReached) {
      this.handleLevelSuccess();
    }
  }

  private handleLevelSuccess(): void {
    if (this.modalOpen) {
      return;
    }

    const submitResult = this.engine.submit();
    this.syncView(submitResult.message, submitResult.ok ? 'success' : 'error');

    if (!submitResult.ok) {
      return;
    }

    const snapshot = this.engine.getSnapshot();
    const isLastLevel = snapshot.levelIndex + 1 >= snapshot.totalLevels;
    this.showSuccessModal(submitResult.beanReward ?? 0, isLastLevel);
  }

  private handleSuccessNext(): void {
    if (!this.modalOpen) {
      return;
    }

    this.hideSuccessModal();

    if (this.successIsLastLevel) {
      this.syncView('恭喜你，已完成全部关卡。', 'success');
      return;
    }

    const result = this.engine.nextLevel();
    this.syncView(result.message, result.ok ? 'neutral' : 'error');
  }

  private showSuccessModal(beanReward: number, isLastLevel: boolean): void {
    this.successIsLastLevel = isLastLevel;
    this.modalOpen = true;

    this.successTitleText.setText('Congratulation');
    this.successMetaText.setText(`Rewards ${beanReward} × ⭐`);
    this.successNextText.setText(isLastLevel ? '完成' : 'NEXT');

    this.successLayer.setVisible(true);
    this.playConfetti();
    this.successPanel.setScale(0.85);

    this.tweens.add({
      targets: this.successPanel,
      scaleX: 1,
      scaleY: 1,
      duration: 140,
      ease: 'Back.out'
    });

    this.syncView();
  }

  private hideSuccessModal(): void {
    this.clearConfetti();
    this.successLayer.setVisible(false);
    this.modalOpen = false;
  }

  private playConfetti(): void {
    this.clearConfetti();

    const colors = [0xff5a5f, 0xffcc00, 0x2ec4b6, 0x4d96ff, 0xff8fab, 0x84cc16];
    const cx = this.successPanel.x;
    const cy = this.successPanel.y;

    for (let i = 0; i < 36; i += 1) {
      const piece = this.add
        .rectangle(
          cx + Phaser.Math.Between(-260, 260),
          cy - Phaser.Math.Between(160, 240),
          Phaser.Math.Between(8, 16),
          Phaser.Math.Between(6, 12),
          colors[Phaser.Math.Between(0, colors.length - 1)]
        )
        .setDepth(130)
        .setRotation(Phaser.Math.FloatBetween(0, Math.PI));

      this.confettiPieces.push(piece);
      this.successLayer.add(piece);

      this.tweens.add({
        targets: piece,
        x: piece.x + Phaser.Math.Between(-90, 90),
        y: piece.y + Phaser.Math.Between(220, 340),
        angle: Phaser.Math.Between(-240, 240),
        alpha: 0,
        duration: Phaser.Math.Between(800, 1200),
        ease: 'Cubic.easeOut',
      });
    }
  }

  private clearConfetti(): void {
    this.confettiPieces.forEach((piece) => piece.destroy());
    this.confettiPieces = [];
  }

  private drawPaperBackdrop(width: number, height: number): void {
    const backdrop = this.add.graphics();

    backdrop.fillStyle(0xf1efe7, 1);
    backdrop.fillRect(0, 0, width, height);

    for (let i = 0; i < 180; i += 1) {
      const gray = Phaser.Math.Between(225, 242);
      const color = (gray << 16) + (gray << 8) + gray;
      backdrop.fillStyle(color, Phaser.Math.FloatBetween(0.06, 0.16));
      backdrop.fillEllipse(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.Between(90, 230),
        Phaser.Math.Between(40, 120)
      );
    }

    for (let i = 0; i < 16; i += 1) {
      const line = this.add.graphics();
      line.lineStyle(1, 0xd7d4cb, 0.3);
      line.lineBetween(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height)
      );
    }
  }

  private buildTopArea(width: number): void {
    const backButton = this.createTopLeftButton(60, 82, () => {
      this.hideSuccessModal();
      this.onBackHome();
    });

    backButton.on('pointerover', () => {
      this.tweens.add({ targets: backButton, scale: 1.06, duration: 100 });
    });

    backButton.on('pointerout', () => {
      this.tweens.add({ targets: backButton, scale: 1, duration: 100 });
    });

    const topPanel = this.add.container(width - 60, 82);
    const panelBg = this.add.graphics();

    panelBg.fillStyle(0xf7dc3c, 1);
    panelBg.lineStyle(4, 0x3f3f3f, 1);
    panelBg.fillRoundedRect(-110, -28, 150, 56, 14);
    panelBg.strokeRoundedRect(-110, -28, 150, 56, 14);

    const coinIcon = this.add
      .text(-70, 0, '⭐', {
        fontFamily: '"Baloo 2", "Noto Sans SC", sans-serif',
        fontSize: '28px'
      })
      .setOrigin(0.5);

    this.topBeanText = this.add
      .text(-10, 0, '75', {
        fontFamily: '"Baloo 2", "Noto Sans SC", sans-serif',
        fontSize: '44px',
        fontStyle: '700',
        color: '#3a3a3a'
      })
      .setOrigin(0.5);

    topPanel.add([panelBg, coinIcon, this.topBeanText]);

    this.levelText = this.add
      .text(width / 2, 92, '', {
        fontFamily: '"Baloo 2", "Noto Sans SC", sans-serif',
        fontSize: '42px',
        fontStyle: '700',
        color: '#4a4a4a',
        stroke: '#f2f2f2',
        strokeThickness: 7
      })
      .setOrigin(0.5);
  }

  private buildWorldActors(width: number): void {
    const resultBoxY = 400;
    this.numbersY = 700;
    const resultBoxHeight = 120;
    const cardHeight = 100;
    const expressionY = (resultBoxY + resultBoxHeight / 2 + this.numbersY - cardHeight / 2) / 2;

    const resultBox = this.add
      .rectangle(width / 2, resultBoxY, 240, resultBoxHeight, 0xf8f8f6)
      .setStrokeStyle(4, 0x4a4a4a, 1)
      .setOrigin(0.5);

    this.currentValueText = this.add
      .text(width / 2, resultBoxY, '', {
        fontFamily: '"Baloo 2", "Noto Sans SC", sans-serif',
        fontSize: '56px',
        color: '#4f4f4f',
        stroke: '#f4f4f4',
        strokeThickness: 6
      })
      .setOrigin(0.5);

    this.expressionText = this.add
      .text(width / 2, expressionY, '', {
        fontFamily: '"Patrick Hand", "Noto Sans SC", sans-serif',
        fontSize: '28px',
        color: '#4b4b4b'
      })
      .setOrigin(0.5);

    resultBox.setDepth(2);
    this.currentValueText.setDepth(3);
    this.expressionText.setDepth(3);
  }

  private buildOperatorButtons(width: number, symbols: OperatorSymbol[]): void {
    this.operatorViews.forEach((view) => view.container.destroy());
    this.operatorViews = [];

    const buttonWidth = 94;
    const buttonHeight = 80;
    const gap = 10;
    const rowGap = 14;
    const maxCols = symbols.length > 6 ? 5 : symbols.length;
    const rows = Math.ceil(symbols.length / maxCols);
    const topY = rows === 1 ? 900 : 860;

    symbols.forEach((symbol, index) => {
      const row = Math.floor(index / maxCols);
      const col = index % maxCols;
      const inRow = Math.min(maxCols, symbols.length - row * maxCols);
      const rowWidth = inRow * buttonWidth + (inRow - 1) * gap;
      const startX = (width - rowWidth) / 2 + buttonWidth / 2;
      const x = startX + col * (buttonWidth + gap);
      const y = topY + row * (buttonHeight + rowGap);

      const body = this.add
        .rectangle(0, 0, buttonWidth, buttonHeight, 0xf7dc3c)
        .setStrokeStyle(3, 0x454545, 1)
        .setOrigin(0.5);

      const label = this.add
        .text(0, 0, opSymbol(symbol), {
          fontFamily: '"Baloo 2", "Noto Sans SC", sans-serif',
          fontSize: symbol === 'log' ? '34px' : '40px',
          color: '#3b3b3b'
        })
        .setOrigin(0.5);

      const container = this.add.container(x, y, [body, label]);
      container.setSize(buttonWidth, buttonHeight);
      container.setInteractive({ useHandCursor: true });

      container.on('pointerdown', () => {
        this.onOperatorSelected(symbol);
      });

      container.on('pointerover', () => {
        if (this.modalOpen) {
          return;
        }

        this.tweens.add({ targets: container, y: y - 4, duration: 80 });
      });

      container.on('pointerout', () => {
        this.tweens.add({ targets: container, y, duration: 80 });
      });

      this.operatorViews.push({ container, body, label });
    });
  }

  private buildUndoClearButtons(width: number): void {
    const undoBtn = this.createSquareIconButton(
      width / 2 - 180, 400, '↩',
      () => {
        if (this.modalOpen) return;
        const result = this.engine.undo();
        this.syncView(result.message, result.ok ? 'neutral' : 'error');
      }
    );

    const clearBtn = this.createSquareIconButton(
      width / 2 + 180, 400, '✕',
      () => {
        if (this.modalOpen) return;
        const result = this.engine.clearMoves();
        this.syncView(result.message, result.ok ? 'neutral' : 'error');
      }
    );

    this.add.existing(undoBtn);
    this.add.existing(clearBtn);
  }

  private buildLogHintText(width: number): void {
    this.logHintText = this.add
      .text(width / 2, 1078, 'log X  =  log₁₀(X)', {
        fontFamily: '"Patrick Hand", "Noto Sans SC", sans-serif',
        fontSize: '30px',
        color: '#888888',
        stroke: '#f4f4f0',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setVisible(false);
  }

  private createSquareIconButton(
    x: number,
    y: number,
    icon: string,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const bg = this.add.graphics();
    bg.fillStyle(0xf4f4f4, 1);
    bg.lineStyle(4, 0x444444, 1);
    bg.fillRoundedRect(-30, -30, 60, 60, 12);
    bg.strokeRoundedRect(-30, -30, 60, 60, 12);

    const label = this.add
      .text(0, 0, icon, {
        fontFamily: '"Baloo 2", "Noto Sans SC", sans-serif',
        fontSize: '30px',
        color: '#444444'
      })
      .setOrigin(0.5);

    const container = this.add.container(x, y, [bg, label]);
    container.setSize(60, 60);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerdown', onClick);
    container.on('pointerover', () => {
      if (this.modalOpen) return;
      this.tweens.add({ targets: container, scale: 1.06, duration: 100 });
    });
    container.on('pointerout', () => {
      this.tweens.add({ targets: container, scale: 1, duration: 100 });
    });

    return container;
  }

  private buildBottomButtons(width: number, height: number): void {
    const skipButton = this.createBottomButton({
      x: width / 2 - 130,
      y: height - 200,
      label: 'Skip',
      icon: '>>',
      fillColor: 0xffaa2f,
      onClick: () => {
        if (this.modalOpen) {
          return;
        }

        const result = this.engine.skipLevel();
        this.syncView(result.message, result.ok ? 'neutral' : 'error');
      }
    });

    const hintButton = this.createBottomButton({
      x: width / 2 + 130,
      y: height - 200,
      label: 'Hint',
      icon: '?',
      fillColor: 0xffe134,
      onClick: () => {
        if (this.modalOpen) {
          return;
        }

        const result = this.engine.useHint();
        this.syncView(result.message, result.ok ? 'neutral' : 'error');
      }
    });

    this.skipContainer = skipButton;
    this.hintContainer = hintButton;

    this.add.existing(skipButton);
    this.add.existing(hintButton);
  }

  private buildCards(snapshot: GameSnapshot): void {
    this.cardViews.forEach((view) => view.container.destroy());
    this.cardViews = [];

    const count = snapshot.level.numbers.length;
    const cardWidth = count <= 4 ? 156 : 124;
    const cardHeight = 100;
    const gapX = count <= 4 ? 16 : 10;
    const startY = this.numbersY || 470;
    const colsFixed = Math.min(count, 5);
    const rowWidth = cardWidth * colsFixed + gapX * (colsFixed - 1);
    const startX = (this.scale.width - rowWidth) / 2 + cardWidth / 2;

    snapshot.level.numbers.forEach((card, index) => {
      const col = index % colsFixed;

      const x = startX + col * (cardWidth + gapX);
      const y = startY;

      const body = this.add
        .rectangle(0, 0, cardWidth, cardHeight, 0xf4f4f4)
        .setStrokeStyle(2, 0x666666, 1)
        .setOrigin(0.5);

      const label = this.add
        .text(0, 0, opSymbol(String(card)), {
          fontFamily: '"Baloo 2", "Noto Sans SC", sans-serif',
          fontSize: '44px',
          fontStyle: '700',
          color: '#35373a'
        })
        .setOrigin(0.5);

      const container = this.add.container(x, y, [body, label]);
      container.setSize(cardWidth, cardHeight);
      container.setInteractive({ useHandCursor: true });

      container.on('pointerover', () => {
        if (this.modalOpen) {
          return;
        }

        this.tweens.add({
          targets: container,
          y: y - 6,
          duration: 90,
          ease: 'Sine.out'
        });
      });

      container.on('pointerout', () => {
        this.tweens.add({
          targets: container,
          y,
          duration: 90,
          ease: 'Sine.out'
        });
      });

      container.on('pointerdown', () => {
        this.onCardSelected(index);
      });

      this.cardViews.push({ container, body, label });
    });
  }

  private buildSuccessModal(width: number, height: number): void {
    const blocker = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.34)
      .setInteractive({ useHandCursor: false });
    blocker.on('pointerdown', () => {});

    const panelBg = this.add
      .rectangle(0, 0, 620, 380, 0xfff8df)
      .setStrokeStyle(5, 0x4a4a4a, 1);

    this.successTitleText = this.add
      .text(0, -98, 'Congratulation', {
        fontFamily: '"Baloo 2", "Noto Sans SC", sans-serif',
        fontSize: '68px',
        color: '#3c3c3c'
      })
      .setOrigin(0.5);

    this.successMetaText = this.add
      .text(0, -4, 'Rewards 2 × ⭐', {
        fontFamily: '"Patrick Hand", "Noto Sans SC", sans-serif',
        fontSize: '52px',
        color: '#5a5a5a'
      })
      .setOrigin(0.5);

    const nextPill = this.add
      .rectangle(0, 114, 260, 92, 0xffde43)
      .setStrokeStyle(5, 0x3f3f3f, 1);

    this.successNextText = this.add
      .text(0, 114, 'NEXT', {
        fontFamily: '"Baloo 2", "Noto Sans SC", sans-serif',
        fontSize: '54px',
        color: '#3c3c3c'
      })
      .setOrigin(0.5);

    const nextZone = this.add.zone(0, 114, 260, 92).setInteractive({ useHandCursor: true });
    nextZone.on('pointerdown', () => this.handleSuccessNext());
    nextZone.on('pointerover', () => {
      this.tweens.add({
        targets: [nextPill, this.successNextText],
        scaleX: 1.04,
        scaleY: 1.04,
        duration: 90
      });
    });
    nextZone.on('pointerout', () => {
      this.tweens.add({
        targets: [nextPill, this.successNextText],
        scaleX: 1,
        scaleY: 1,
        duration: 90
      });
    });

    this.successPanel = this.add.container(width / 2, height / 2, [
      panelBg,
      this.successTitleText,
      this.successMetaText,
      nextPill,
      this.successNextText,
      nextZone
    ]);

    this.successLayer = this.add
      .container(0, 0, [blocker, this.successPanel])
      .setDepth(120)
      .setVisible(false);
  }

  private createTopLeftButton(
    x: number,
    y: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const icon = this.add.graphics();

    icon.fillStyle(0xf4f4f4, 1);
    icon.lineStyle(4, 0x444444, 1);
    icon.fillRoundedRect(-28, -28, 56, 56, 14);
    icon.strokeRoundedRect(-28, -28, 56, 56, 14);

    icon.fillStyle(0xffffff, 0.01);
    icon.fillTriangle(-8, 0, 8, -10, 8, 10);

    icon.lineStyle(6, 0x444444, 1);
    icon.strokeTriangle(-8, 0, 8, -12, 8, 12);

    const container = this.add.container(x, y, [icon]);
    container.setSize(56, 56);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', onClick);

    return container;
  }

  private createBottomButton(config: {
    x: number;
    y: number;
    label: string;
    icon: string;
    fillColor: number;
    onClick: () => void;
  }): Phaser.GameObjects.Container {
    const { x, y, label, icon, fillColor, onClick } = config;

    const pill = this.add.graphics();
    pill.fillStyle(fillColor, 1);
    pill.lineStyle(5, 0x3f3f3f, 1);
    pill.fillRoundedRect(-90, -36, 180, 72, 14);
    pill.strokeRoundedRect(-90, -36, 180, 72, 14);

    const mark = this.add
      .text(0, -4, icon, {
        fontFamily: '"Baloo 2", "Noto Sans SC", sans-serif',
        fontSize: '52px',
        color: '#3a3a3a'
      })
      .setOrigin(0.5);

    const caption = this.add
      .text(0, 62, label, {
        fontFamily: '"Baloo 2", "Noto Sans SC", sans-serif',
        fontSize: '48px',
        color: '#444444',
        stroke: '#f4f4f4',
        strokeThickness: 5
      })
      .setOrigin(0.5);

    const container = this.add.container(x, y, [pill, mark, caption]);
    container.setSize(190, 130);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerdown', onClick);
    container.on('pointerover', () => {
      if (this.modalOpen) {
        return;
      }

      this.tweens.add({ targets: container, scaleX: 1.03, scaleY: 1.03, duration: 90 });
    });
    container.on('pointerout', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 90 });
    });

    return container;
  }
}
