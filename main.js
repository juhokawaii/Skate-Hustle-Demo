// --- Player Controller (shared between scenes) ------------------------
class PlayerController {
  constructor(scene, player, cursors, options = {}) {
    this.scene = scene;
    this.player = player;
    this.cursors = cursors;

    // Tunable options (with defaults)
    this.jumpSpeed = options.jumpSpeed ?? -420;
    this.accel = options.accel ?? 800;
    this.idleThreshold = options.idleThreshold ?? 20;

    this.baseDragX = options.baseDragX ?? 400;
    this.brakeDragX = options.brakeDragX ?? 1400;
    this.maxVelX = options.maxVelX ?? 350;
    this.maxVelY = options.maxVelY ?? 900;

    // State flags
    this.isKicking = false;
    this.isBraking = false;

    // Apply initial physics settings
    this.player.setDragX(this.baseDragX);
    this.player.body.setMaxVelocity(this.maxVelX, this.maxVelY);
  }

  update() {
    const player = this.player;
    const body = player.body;
    const scene = this.scene;

    if (!player || !body) return;

    const onGround = body.blocked.down;
    const velX = body.velocity.x;
    const wasStandingStill = Math.abs(velX) < this.idleThreshold;

    const left = this.cursors.left.isDown;
    const right = this.cursors.right.isDown;
    const down = this.cursors.down.isDown;
    const upPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up);

    // --- Kick: start from still ---------------------------------------
    if (
      !this.isKicking &&
      onGround &&
      wasStandingStill &&
      (left || right)
    ) {
      this.isKicking = true;
      player.anims.stop();
      player.setTexture('player3');

      scene.time.delayedCall(500, () => {
        if (!this.player || !this.player.body) return;
        this.isKicking = false;
      });
    }

    // --- Braking: DOWN on ground --------------------------------------
    if (onGround && down) {
      this.isBraking = true;
      player.setDragX(this.brakeDragX);
    } else {
      this.isBraking = false;
      player.setDragX(this.baseDragX);
    }

    // --- Horizontal movement with inertia -----------------------------
    if (down) {
      player.setAccelerationX(0);
    } else if (left) {
      player.setAccelerationX(-this.accel);
      player.flipX = true;
    } else if (right) {
      player.setAccelerationX(this.accel);
      player.flipX = false;
    } else {
      player.setAccelerationX(0);
    }

    // --- Jump ---------------------------------------------------------
    if (onGround && upPressed) {
      body.setVelocityY(this.jumpSpeed);
    }

    // --- Visual / animation state ------------------------------------
    const nowOnGround = body.blocked.down;
    const velXNow = body.velocity.x;
    const isStandingStillNow = Math.abs(velXNow) < this.idleThreshold;

    if (!nowOnGround) {
      // In air
      player.anims.stop();
      player.setTexture('player4'); // air frame
    } else if (this.isBraking) {
      player.anims.stop();
      player.setTexture('player5'); // brake frame
    } else if (this.isKicking) {
      player.anims.stop();
      player.setTexture('player3'); // push frame
    } else if (isStandingStillNow) {
      player.anims.play('idle', true); // idle loop (1–2)
    } else {
      player.anims.stop();
      player.setTexture('player1'); // rolling
    }
  }
}

// --- Title Scene ------------------------------------------------------
class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  preload() {
    // Player frames
    this.load.image('player1', 'assets/player1.png');
    this.load.image('player2', 'assets/player2.png');
    this.load.image('player3', 'assets/player3.png');
    this.load.image('player4', 'assets/player4.png');
    this.load.image('player5', 'assets/player5.png');

    // Ramp art for ramp room
    this.load.image('ramp_left', 'assets/ramp_left.png');
    this.load.image('ramp_right', 'assets/ramp_right.png');

    // Title music
    this.load.audio('mainMusic', 'assets/title.mp3');

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

    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.start('GameScene');
    });
  }
}

// --- Game Scene (hub world with hustle point) ------------------------
class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#171a21');

    // Ground
    const groundHeight = 60;
    const ground = this.add.rectangle(
      width / 2,
      height - groundHeight / 2,
      width,
      groundHeight,
      0x30343f
    );
    this.physics.add.existing(ground, true);

    // Player
    this.player = this.physics.add.sprite(100, height - 150, 'player1');
    this.player.setCollideWorldBounds(true);
    this.player.setBounce(0);
    this.player.body.setSize(this.player.width, this.player.height, true);

    this.physics.add.collider(this.player, ground);

    // Idle animation (global)
    if (!this.anims.exists('idle')) {
      this.anims.create({
        key: 'idle',
        frames: [{ key: 'player1' }, { key: 'player2' }],
        frameRate: 2,
        repeat: -1,
      });
    }
    this.player.anims.play('idle');

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();

    // Player controller (shared logic)
    this.playerController = new PlayerController(this, this.player, this.cursors, {
      baseDragX: 400,
      brakeDragX: 1400,
      maxVelX: 350,
      maxVelY: 900,
      jumpSpeed: -420,
      accel: 800,
      idleThreshold: 20,
    });

        // Background music for the main world
    this.bgMusic = this.sound.add('mainMusic', {
      volume: 1,
      loop: true,
    });
    this.bgMusic.play();

    // Simple collectible
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

    // Hustle point → ramp room
    this.hustlePoint = this.add.rectangle(
      width - 80,
      height - 200,
      32,
      32,
      0x4fc3f7
    );
    this.physics.add.existing(this.hustlePoint);
    this.hustlePoint.body.setAllowGravity(false);

    this.physics.add.overlap(
      this.player,
      this.hustlePoint,
      this.enterRampRoom,
      null,
      this
    );

    // Score text
    this.score = 0;
    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontSize: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#ffffff',
    });
  }

  handleCollect(player, collectible) {
    collectible.destroy();
    this.score += 10;
    this.scoreText.setText(`Score: ${this.score}`);

    this.add
      .text(
        this.scale.width / 2,
        80,
        'Nice! You grabbed a hustle point!',
        {
          fontSize: '18px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }
      )
      .setOrigin(0.5);
  }

enterRampRoom(player, hustlePoint) {
    if (this.bgMusic) {
      this.bgMusic.stop();
      this.bgMusic = null;
    }
    this.scene.start('RampScene');
  }


  update() {
    if (this.playerController) {
      this.playerController.update();
    }
  }
}

// --- Ramp Scene --------------------------------------------------------
class RampScene extends Phaser.Scene {
  constructor() {
    super('RampScene');
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#102030');

    this.add
      .text(width / 2, 40, 'Ramp Room', {
        fontSize: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      })
      .setOrigin(0.5);

    const groundHeight = 60;
    const ground = this.add.rectangle(
      width / 2,
      height - groundHeight / 2,
      width,
      groundHeight,
      0x30343f
    );
    this.physics.add.existing(ground, true);

    // Ramps as background art
    const rampScale = 1.67; // adjust as you like
    const rampY = height - groundHeight + 110; // move ramps slightly down

    this.add
      .image(0, rampY, 'ramp_left')
      .setOrigin(0, 1)
      .setScale(rampScale);

    this.add
      .image(width, rampY, 'ramp_right')
      .setOrigin(1, 1)
      .setScale(rampScale);

    // Player
    this.player = this.physics.add.sprite(100, height - 150, 'player1');
    this.player.setCollideWorldBounds(true);
    this.player.setBounce(0);
    this.player.body.setSize(this.player.width, this.player.height, true);

    this.physics.add.collider(this.player, ground);

    // Idle anim (if not already defined)
    if (!this.anims.exists('idle')) {
      this.anims.create({
        key: 'idle',
        frames: [{ key: 'player1' }, { key: 'player2' }],
        frameRate: 2,
        repeat: -1,
      });
    }
    this.player.anims.play('idle');

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyEsc = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC
    );

    // Player controller
    this.playerController = new PlayerController(this, this.player, this.cursors, {
      baseDragX: 400,
      brakeDragX: 1400,
      maxVelX: 350,
      maxVelY: 900,
      jumpSpeed: -420,
      accel: 800,
      idleThreshold: 20,
    });

    this.add
      .text(width / 2, height - 40, 'Press ESC to return', {
        fontSize: '14px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      })
      .setOrigin(0.5);
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      this.scene.start('GameScene');
      return;
    }

    if (this.playerController) {
      this.playerController.update();
    }
  }
}

// --- Game Config -------------------------------------------------------
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
  scene: [TitleScene, GameScene, RampScene],
};

const game = new Phaser.Game(config);
