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

        // --- Hustle point: enter the ramp room when touched ---------------
    this.hustlePoint = this.add.rectangle(
      width - 80,
      height - 200,
      32,
      32,
      0x4fc3f7 // blue-ish
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
enterRampRoom(player, hustlePoint) {
    // Teleport to the ramp room scene
    this.scene.start('RampScene');
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

// --- Ramp Scene --------------------------------------------------------
class RampScene extends Phaser.Scene {
  constructor() {
    super('RampScene');
  }

  preload() {
    // Load ramp images (your new art)
    this.load.image('ramp_left', 'assets/ramp_left.png');
    this.load.image('ramp_right', 'assets/ramp_right.png');
    // Player frames (player1..5) are already loaded in GameScene,
    // but that's OK – Phaser keeps them, so we don't need to reload them here.
  }

  create() {
    const { width, height } = this.scale;

    // Different background so the teleport feels real
    this.cameras.main.setBackgroundColor('#102030');

    // Title for the room
    this.add
      .text(width / 2, 40, 'Ramp Room', {
        fontSize: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      })
      .setOrigin(0.5);

    // Ground (same height as in GameScene)
    const groundHeight = 60;
    const ground = this.add.rectangle(
      width / 2,
      height - groundHeight / 2,
      width,
      groundHeight,
      0x30343f
    );
    this.physics.add.existing(ground, true);

    /* Old, unscalable code from ramps
    // Left ramp sprite
    const rampLeft = this.physics.add.staticImage(
      width / 2 - 80,
      height - groundHeight - 40,
      'ramp_left'
    );

    // Right ramp sprite
    const rampRight = this.physics.add.staticImage(
      width / 2 + 80,
      height - groundHeight - 40,
      'ramp_right'
    );
    */
    /*
   // Left ramp
const rampLeft = this.physics.add.staticSprite(
  0, 
  height - groundHeight, 
  'ramp_left'
)
  .setOrigin(0, 1)       // anchor bottom-left
  .setScale(1.6)         // adjust height/width
  .refreshBody();

// Right ramp
const rampRight = this.physics.add.staticSprite(
  width, 
  height - groundHeight, 
  'ramp_right'
)
  .setOrigin(1, 1)       // anchor bottom-right
  .setScale(1.6)
  .refreshBody();
 
  */
     // Draw ramps as background art (no physics for now)
    const rampScale = 1.66; // try 1.6, 1.8, 2.0 as you like

    const rampLeft = this.add
      .image(0, height - groundHeight +105, 'ramp_left')
      .setOrigin(0, 1) // bottom-left corner
      .setScale(rampScale);

    const rampRight = this.add
      .image(width, height - groundHeight +105, 'ramp_right')
      .setOrigin(1, 1) // bottom-right corner
      .setScale(rampScale);

    // Player – copy your GameScene player setup as closely as possible
    this.player = this.physics.add.sprite(100, height - 150, 'player1');
    this.player.setCollideWorldBounds(true);
    this.player.setBounce(0);
    this.player.body.setSize(this.player.width, this.player.height, true);

    // Inertia & braking settings – same as in GameScene (adjust to match yours)
    this.baseDragX = 400;
    this.brakeDragX = 1400;
    this.player.setDragX(this.baseDragX);
    this.player.body.setMaxVelocity(350, 900);

    this.isKicking = false;
    this.isBraking = false;

    // Collisions
    this.physics.add.collider(this.player, ground);
    //this.physics.add.collider(this.player, rampLeft);
    //this.physics.add.collider(this.player, rampRight);

    // Idle animation: reuse or recreate
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

    // Hint to go back
    this.add
      .text(width / 2, height - 40, 'Press ESC to return', {
        fontSize: '14px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      })
      .setOrigin(0.5);
  }

  update() {
    const jumpSpeed = -420;
    const accel = 800;

    if (!this.player || !this.player.body) return;

    // ESC: go back to main world
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      this.scene.start('GameScene');
      return;
    }

    const body = this.player.body;
    const onGround = body.blocked.down;
    const velX = body.velocity.x;
    const wasStandingStill = Math.abs(velX) < 20;

    const left = this.cursors.left.isDown;
    const right = this.cursors.right.isDown;
    const down = this.cursors.down.isDown;
    const upPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up);

    // Kick detection (push from still)
    if (
      !this.isKicking &&
      onGround &&
      wasStandingStill &&
      (left || right)
    ) {
      this.isKicking = true;
      this.player.anims.stop();
      this.player.setTexture('player3');

      this.time.delayedCall(500, () => {
        if (!this.player || !this.player.body) return;
        this.isKicking = false;
      });
    }

    // Braking (DOWN on ground)
    if (onGround && down) {
      this.isBraking = true;
      this.player.setDragX(this.brakeDragX);
    } else {
      this.isBraking = false;
      this.player.setDragX(this.baseDragX);
    }

    // Horizontal movement with inertia
    if (down) {
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

    // Jump
    if (onGround && upPressed) {
      body.setVelocityY(jumpSpeed);
    }

    // Visual / animation state
    const nowOnGround = body.blocked.down;
    const velXNow = body.velocity.x;
    const isStandingStillNow = Math.abs(velXNow) < 20;

    if (!nowOnGround) {
      this.player.anims.stop();
      this.player.setTexture('player4'); // air
    } else if (this.isBraking) {
      this.player.anims.stop();
      this.player.setTexture('player5'); // tail brake
    } else if (this.isKicking) {
      this.player.anims.stop();
      this.player.setTexture('player3'); // push
    } else if (isStandingStillNow) {
      this.player.anims.play('idle', true);
    } else {
      this.player.anims.stop();
      this.player.setTexture('player1'); // rolling
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
//  scene: [TitleScene, GameScene],
scene: [TitleScene, GameScene, RampScene],

};

const game = new Phaser.Game(config);
