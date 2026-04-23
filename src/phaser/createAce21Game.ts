import Phaser from 'phaser';
import { PlayScene } from './scenes/PlayScene';

export const createAce21Game = (parent: string, playScene: PlayScene): Phaser.Game => {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: 768,
    height: 1338,
    backgroundColor: '#e7e8eb',
    scene: [playScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  };

  return new Phaser.Game(config);
};
