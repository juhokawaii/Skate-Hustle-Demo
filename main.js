// --- Title Scene ---------------------------------------------------------
class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2 - 40, 'Skate Hustle', {
        fontSize: '48px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 20, 'Press SPACE to start', {
        fontSize: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 60, 'Arrows to move & jump, DOWN to brake', {
        fontSize: '16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      })
      .setOrigin(0.5);

    // When SPACE is pressed, start the game scene
    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.start('GameScene');
    });
  }
}

// --- Game Scene ----------------------------------------------------------
class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    // Player frames
    this.load.image('player1', 'assets/player1.png'); // idle / move base
    this.load.image('player2', 'assets/player2.png'); // idle alt
    this.load.image('player3', 'assets/player3.png'); // push / kick
    this.load.image('player4', 'assets/player4.png'); // air
    this.load.image('player5', 'assets/player5.png'); // brake
    // Soundtrack 
    this.load.audio('title', 'assets/title.mp3'); // title music 
  }

  create() {
    const { width, height } = this.scale;

    // Background
    this.cameras.main.setBackgroundColor('#171a21');
    // Background music
    this.music = this.sound.add('title', {
      volume: 1.0,   // 0.0 to 1.0
      loop: true
    });
    this.music.play();


    // Ground (static physics body)
    const groundHeight = 60;
    const ground = this.add.rectangle(
      width / 2,
      height - groundHeight / 2,
      width,
      groundHeight,
      0x30343f
    );
    this.physics.add.existing(ground, true); // static

    // Player sprite – start on frame 1
    this.player = this.physics.add.sprite(100, height - 150, 'player1');
    this.player.setCollideWorldBounds(true);
    this.player.setBounce(0);
    this.player.body.setSize(this.player.width, this.player.height, true);

    // Inertia & braking settings
    this.baseDragX = 200;     // normal drag
    this.brakeDragX = 800;   // stronger drag when braking
    this.player.setDragX(this.baseDragX);
    this.player.body.setMaxVelocity(400, 900);

    // Kick / brake state
    this.isKicking = false;
    this.isBraking = false;

    // Collide with ground
    this.physics.add.collider(this.player, ground);

    // Idle animation: player1 <-> player2
    this.anims.create({
      key: 'idle',
      frames: [{ key: 'player1' }, { key: 'player2' }],
      frameRate: 1, // calm idle
      repeat: -1,
    });
    this.player.anims.play('idle');

    // Simple collectible (yellow square)
    this.collectible = this.add.rectangle(
      width - 120,
      height - 120,
      24,
      24,
      0xffd54f
    );
    this.physics.add.existing(this.collectible);
    this.collectible.body.setAllowGravity(false);

    this.physics.add.overlap(
      this.player,
      this.collectible,
      this.handleCollect,
      null,
      this
    );

    // Keyboard input
    this.cursors = this.input.keyboard.createCursorKeys();

    // Score text
    this.score = 0;
    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontSize: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#ffffff',
    });
    this.scoreText.setScrollFactor(0);
  }

  handleCollect(player, collectible) {
    // Remove collectible from the game
    collectible.destroy();

    // Update score
    this.score += 10;
    this.scoreText.setText(`Score: ${this.score}`);

    // Small message
    this.add
      .text(
        this.scale.width / 2,
        80,
        'Nice! You grabbed the first hustle point!',
        {
          fontSize: '18px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }
      )
      .setOrigin(0.5);
  }

  update() {
    const jumpSpeed = -420;
    const accel = 800;

    if (!this.player || !this.player.body) return;

    // Current state
    const onGround = this.player.body.blocked.down;
    const velX = this.player.body.velocity.x;
    const wasStandingStill = Math.abs(velX) < 20;

    const left = this.cursors.left.isDown;
    const right = this.cursors.right.isDown;
    const down = this.cursors.down.isDown;

    // --- Kick: start of movement from still ------------------------------
    if (
      !this.isKicking &&
      onGround &&
      wasStandingStill &&
      (left || right)
    ) {
      this.isKicking = true;

      // Show kick frame
      this.player.anims.stop();
      this.player.setTexture('player3');

      // End kick after 0.5s
      this.time.delayedCall(500, () => {
        if (!this.player || !this.player.body) return;
        this.isKicking = false;
      });
    }

    // --- Braking: DOWN while moving on ground ----------------------------
    if (onGround && down) {
      this.isBraking = true;
      this.player.setDragX(this.brakeDragX);
    } else {
      this.isBraking = false;
      this.player.setDragX(this.baseDragX);
    }

    // --- Horizontal movement with inertia --------------------------------
    if (down) {
      // While braking, don't accelerate further
      this.player.setAccelerationX(0);
    } else if (left) {
      this.player.setAccelerationX(-accel);
      this.player.flipX = true;
    } else if (right) {
      this.player.setAccelerationX(accel);
      this.player.flipX = false;
    } else {
      this.player.setAccelerationX(0);
    }

    // --- Jump -------------------------------------------------------------
    if (onGround && Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      this.player.body.setVelocityY(jumpSpeed);
    }

    // --- Sprite / animation selection ------------------------------------
    const nowOnGround = this.player.body.blocked.down;
    const velXNow = this.player.body.velocity.x;
    const isStandingStillNow = Math.abs(velXNow) < 20;

    if (!nowOnGround) {
      // In air always wins
      this.player.anims.stop();
      this.player.setTexture('player4');
    } else if (this.isBraking) {
      // Tail brake pose
      this.player.anims.stop();
      this.player.setTexture('player5');
    } else if (this.isKicking) {
      // Push kick
      this.player.anims.stop();
      this.player.setTexture('player3');
    } else if (isStandingStillNow) {
      // Idle on ground
      this.player.anims.play('idle', true);
    } else {
      // Moving on ground
      this.player.anims.stop();
      this.player.setTexture('player1');
    }
  }
}

// --- Game Config ---------------------------------------------------------
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#1e1e1e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 900 },
      debug: false,
    },
  },
  scene: [TitleScene, GameScene],
};

const game = new Phaser.Game(config);
