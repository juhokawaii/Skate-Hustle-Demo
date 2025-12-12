// ======================================================================
//  MATTER HELPERS
// ======================================================================

const M = Phaser.Physics.Matter.Matter;
const Bodies = M.Bodies;

/**
 * Create the player sprite + Matter body.
 * Sprite: 128x170, bottom edge = wheels touching ground.
 * We align the bottom of the body to the bottom of the sprite.
 */
function createPlayer(scene, x, y) {
  const sprite = scene.matter.add.sprite(x, y, 'player1');

  // Sprite is 128x170
  const SPRITE_HEIGHT = 170;

  // The legs + torso, not including the board & wheels
  const BODY_HEIGHT = 120;  
  const BODY_WIDTH  = 60;

  // Where is the bottom of the BODY relative to the sprite?
  // Sprite bottom = wheels = true contact point.
  // Body bottom must meet wheels.
  //
  // Sprite bottom (center + 85)
  // Body bottom (center + BODY_HEIGHT/2)
  // offsetY = (SPRITE_HEIGHT/2) - (BODY_HEIGHT/2)
  const offsetY = (SPRITE_HEIGHT / 2) - (BODY_HEIGHT / 2);

  const mainBody = Bodies.rectangle(
    0,
    offsetY,            // shift downward so body bottom touches wheels
    BODY_WIDTH,
    BODY_HEIGHT,
    { label: 'PLAYER' }
  );

  // Foot sensor slightly below wheels
  const footSensor = Bodies.rectangle(
    0,
    offsetY + BODY_HEIGHT / 2 + 5,
    BODY_WIDTH * 0.6,
    6,
    {
      isSensor: true,
      label: 'FOOT_SENSOR'
    }
  );

  const compound = M.Body.create({
    parts: [mainBody, footSensor],
    friction: 0,
    frictionStatic: 0,
    frictionAir: 0.02,
    restitution: 0,
    label: 'PLAYER',
  });

  sprite
    .setExistingBody(compound)
    .setFixedRotation()
    .setPosition(x, y);

  sprite.onGroundContacts = 0;

  return sprite;
}

/**
 * Create a static ground polygon from a list of points
 * given in ABSOLUTE world coordinates.
 *
 * Works for flat and curved ground.
 */
function createSplineGround(scene, points) {
  // Compute a simple centroid for positioning
  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  const cx = sumX / points.length;
  const cy = sumY / points.length;

  // Convert absolute points to local coords around centroid
  const localVerts = points.map((p) => ({
    x: p.x - cx,
    y: p.y - cy,
  }));

  const body = scene.matter.add.fromVertices(
    cx,
    cy,
    [localVerts], // IMPORTANT: wrap in [ ... ]
    {
      isStatic: true,
      friction: 0.001,
      restitution: 0,
      label: 'GROUND',
    },
    true
  );

  return body;
}

/**
 * Create many small static ramp edges that perfectly follow
 * your ramp spline. No centroid issues — this is the cleanest solution.
 */
function createRampEdges(scene, points) {

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // Midpoint of the segment
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    // Segment length
    const length = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);

    // Segment angle
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    // Create a thin static rectangle to represent this segment
    scene.matter.add.rectangle(
      midX,
      midY,
      length,
      6, // ground thickness — small so the skater sits ON the line
      {
        isStatic: true,
        angle: angle,
        label: 'GROUND'
      }
    );
  }
}


// ======================================================================
//  PLAYER CONTROLLER (Matter-based)
// ======================================================================

class PlayerController {
  constructor(scene, player, cursors, opts = {}) {
    this.scene = scene;
    this.player = player;
    this.cursors = cursors;

    this.jumpSpeed = opts.jumpSpeed ?? -10;
    this.moveAccel = opts.moveAccel ?? 0.12;
    this.idleThreshold = opts.idleThreshold ?? 0.25;

    this.maxVelX = opts.maxVelX ?? 9;
    this.maxVelY = opts.maxVelY ?? 30;

    this.isKicking = false;
    this.isBraking = false;
  }

  get onGround() {
    return this.player.onGroundContacts > 0;
  }

  update() {
    const player = this.player;
    const body = player.body;
    if (!player || !body) return;

    const vel = body.velocity;
    const still = Math.abs(vel.x) < this.idleThreshold;

    const left = this.cursors.left.isDown;
    const right = this.cursors.right.isDown;
    const down = this.cursors.down.isDown;
    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up);

    // Kick from standstill
    if (!this.isKicking && this.onGround && still && (left || right)) {
      this.isKicking = true;
      player.anims.stop();
      player.setTexture('player3');
      player.setVelocityX(right ? 5 : -5);

      this.scene.time.delayedCall(450, () => {
        this.isKicking = false;
      });
    }

    // Braking – damp velocity
    if (this.onGround && down) {
      this.isBraking = true;
      player.setVelocityX(vel.x * 0.75);
    } else {
      this.isBraking = false;
    }

    // Horizontal motion
    let targetVX = vel.x;
    if (!down) {
      if (left) {
        targetVX -= this.moveAccel;
        player.flipX = true;
      } else if (right) {
        targetVX += this.moveAccel;
        player.flipX = false;
      } else {
        targetVX *= 0.96; // natural drift
      }
    }

    targetVX = Phaser.Math.Clamp(targetVX, -this.maxVelX, this.maxVelX);
    player.setVelocityX(targetVX);

    // Clamp vertical speed to avoid craziness
    if (vel.y > this.maxVelY) {
      player.setVelocityY(this.maxVelY);
    }

    // Jump
    if (this.onGround && jumpPressed) {
      player.setVelocityY(this.jumpSpeed);
    }

    // Animations
    const standing = Math.abs(player.body.velocity.x) < this.idleThreshold;

    if (!this.onGround) {
      player.anims.stop();
      player.setTexture('player4'); // air frame
    } else if (this.isBraking) {
      player.anims.stop();
      player.setTexture('player5');
    } else if (this.isKicking) {
      player.anims.stop();
      player.setTexture('player3');
    } else if (standing) {
      player.anims.play('idle', true);
    } else {
      player.anims.stop();
      player.setTexture('player1');
    }
  }
}

// ======================================================================
//  TITLE SCENE
// ======================================================================

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

    // Music
    this.load.audio('mainMusic', 'assets/title.mp3');
    this.load.audio('rampMusic', 'assets/ramp.mp3');

    // Grapics
    this.load.image('ramp_left', 'assets/ramp_left.png');
    this.load.image('ramp_right', 'assets/ramp_right.png');
    this.load.image('titleBg', 'assets/background1.png');
    this.load.image('gameBg', 'assets/background.png');

  }

  create() {
    const { width, height } = this.scale;

this.add.image(width / 2, height / 2, 'titleBg')
  .setOrigin(0.5)
  .setDisplaySize(width, height);

    /*const { width, height } = this.scale;

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
      .text(
        width / 2,
        height / 2 + 60,
        'Arrows to move & jump, DOWN to brake',
        {
          fontSize: '16px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }
      )
      .setOrigin(0.5);
    */
    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.start('GameScene');
    });
  }
}

// ======================================================================
//  GAME SCENE – FLAT GROUND
// ======================================================================

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#171a21');
    this.matter.world.setBounds(0, 0, width, height);

    // Idle animation (global)
    if (!this.anims.exists('idle')) {
      this.anims.create({
        key: 'idle',
        frames: [{ key: 'player1' }, { key: 'player2' }],
        frameRate: 2,
        repeat: -1,
      });
    }

// --- Ground: explicit wheel line + physics + visuals --------------

// Where should the wheels touch the ground visually?
const WHEEL_LINE_Y = height - 120;      // tweak this up/down to taste

// --- Background image ---------------------------------------------

this.add.image(
  width / 2,
  WHEEL_LINE_Y,
  'gameBg'
)
.setOrigin(0.5, 1)   // center horizontally, bottom-aligned
.setDepth(-20);

// How thick is the invisible physics slab under the wheels?
const GROUND_THICKNESS = 40;

// Physics body is centered below the wheel line
const groundBodyY = WHEEL_LINE_Y + GROUND_THICKNESS / 2;

// Physics ground (invisible)
this.groundBody = this.matter.add.rectangle(
  width / 2,
  groundBodyY,
  width,
  GROUND_THICKNESS,
  {
    isStatic: true,
    label: 'GROUND',
    friction: 0.001,
  }
);

// Visual ground strip from wheel line down to bottom of screen
const visualGroundHeight = height - WHEEL_LINE_Y;
this.add.rectangle(
  width / 2,
  WHEEL_LINE_Y + visualGroundHeight / 2,
  width,
  visualGroundHeight,
  0x30343f
).setOrigin(0.5, 0.5);



    // --- Player --------------------------------------------------------
    // Start above the ground, let gravity settle him onto it
    this.player = createPlayer(this, 120, WHEEL_LINE_Y - 200);
    this.player.anims.play('idle');

    this.cursors = this.input.keyboard.createCursorKeys();
    this.playerController = new PlayerController(
      this,
      this.player,
      this.cursors
    );

    // --- Music ---------------------------------------------------------
    this.bgMusic = this.sound.add('mainMusic', {
      volume: 1,
      loop: true,
    });
    this.bgMusic.play();

    // --- Collectible (yellow) -----------------------------------------
this.collectibleCollected = false;
this.collectible = this.add.rectangle(
  width - 120,
  height - 140,
  24,
  24,
  0xffd54f
);

// --- Hustle point (blue)  → RampScene -----------------------------
this.hustlePoint = this.add.rectangle(
  width - 80,
  height - 200,
  32,
  32,
  0x4fc3f7
);

    // --- Score ---------------------------------------------------------
    this.score = 0;
    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontSize: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#ffffff',
    });

    // --- Collision events ----------------------------------------------
    this.matter.world.on('collisionstart', this.onCollisionStart, this);
    this.matter.world.on('collisionend', this.onCollisionEnd, this);
  }

onCollisionStart(event) {
  const player = this.player;

  for (const pair of event.pairs) {
    const A = pair.bodyA;
    const B = pair.bodyB;

    const labelA = A.label;
    const labelB = B.label;

    // Ground detection via foot sensor
    if (labelA === 'FOOT_SENSOR' && B.isStatic) {
      player.onGroundContacts++;
    } else if (labelB === 'FOOT_SENSOR' && A.isStatic) {
      player.onGroundContacts++;
    }
  }
}


  onCollisionEnd(event) {
    const player = this.player;

    for (const pair of event.pairs) {
      const A = pair.bodyA;
      const B = pair.bodyB;

      const labelA = A.label;
      const labelB = B.label;

      if (labelA === 'FOOT_SENSOR' && B.isStatic) {
        player.onGroundContacts = Math.max(
          0,
          player.onGroundContacts - 1
        );
      } else if (labelB === 'FOOT_SENSOR' && A.isStatic) {
        player.onGroundContacts = Math.max(
          0,
          player.onGroundContacts - 1
        );
      }
    }
  }

  collectItem() {
    this.collectibleCollected = true;
    if (this.collectible) {
      this.collectible.destroy();
      this.collectible = null;
    }

    this.score += 10;
    this.scoreText.setText(`Score: ${this.score}`);
  }

  enterRampRoom() {
    if (this.bgMusic) {
      this.bgMusic.stop();
      this.bgMusic = null;
    }
    this.scene.start('RampScene');
  }

update() {
  this.playerController.update();

  // --- Manual overlaps for collectible & hustle point (sprite-based) ---
  const playerBounds = this.player.getBounds();

  // Collectible pickup
  if (
    !this.collectibleCollected &&
    this.collectible &&
    Phaser.Geom.Intersects.RectangleToRectangle(
      playerBounds,
      this.collectible.getBounds()
    )
  ) {
    this.collectItem();
  }

  // Hustle point → RampScene
  if (
    this.hustlePoint &&
    Phaser.Geom.Intersects.RectangleToRectangle(
      playerBounds,
      this.hustlePoint.getBounds()
    )
  ) {
    this.enterRampRoom();
  }
}



}

// ======================================================================
//  RAMP SCENE – CURVED GROUND
// ======================================================================

class RampScene extends Phaser.Scene {
  constructor() {
    super('RampScene');
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#102030');
    this.matter.world.setBounds(0, 0, width, height);

    const WHEEL_LINE_Y = height - 120;
    this.add.image(
  width / 2,
  WHEEL_LINE_Y,
  'gameBg'
)
.setOrigin(0.5, 1)
.setDepth(-20);


    //-------------------------------------------------------
    // UI
    //-------------------------------------------------------
    this.add.text(width / 2, 40, 'Ramp Room', {
      fontSize: '24px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }).setOrigin(0.5);

    //-------------------------------------------------------
    // Ramp artwork
    //-------------------------------------------------------
    const rampScale = 1.7;
    const rampOffsetY = 50;
    this.add.image(70, height + rampOffsetY, 'ramp_left')
      .setOrigin(0, 1)
      .setScale(rampScale)
      .setDepth(-10);

    this.add.image(width, height + rampOffsetY, 'ramp_right')
      .setOrigin(1, 1)
      .setScale(rampScale)
      .setDepth(-10);

    //-------------------------------------------------------
    // SINGLE SOURCE OF TRUTH — your yellow spline points
    //-------------------------------------------------------
    this.rampPoints = [
      { x:   4, y: 286 },
      { x:  44, y: 286 },
      { x:  84, y: 286 },
      { x: 123, y: 352 },
      { x: 163, y: 413 },
      { x: 202, y: 445 },
      { x: 242, y: 465 },
      { x: 282, y: 477 },
      { x: 322, y: 482 },
      { x: 361, y: 484 },
      { x: 401, y: 483 },
      { x: 441, y: 483 },
      { x: 480, y: 480 },
      { x: 520, y: 474 },
      { x: 560, y: 462 },
      { x: 600, y: 443 },
      { x: 639, y: 412 },
      { x: 679, y: 355 },
      { x: 718, y: 286 },
      { x: 758, y: 286 },
      { x: 798, y: 286 }
    ];

    //-------------------------------------------------------
    // Create bottom offset = thickness of collision strip
    //-------------------------------------------------------
    const thickness = 40;

    this.bottomPoints = this.rampPoints.map(p => ({
      x: p.x,
      y: p.y + thickness
    }));

    //-------------------------------------------------------
    // Build collision polygon from rampPoints + bottomPoints
    //-------------------------------------------------------
    const fullPolygon = [
      ...this.rampPoints,
      ...this.bottomPoints.slice().reverse()
    ];

    this.createMatterPolygon(fullPolygon);

    //-------------------------------------------------------
    // Debug draw (same data!)
    //-------------------------------------------------------
    //his.drawDebugSpline(this.rampPoints, this.bottomPoints);

    //-------------------------------------------------------
    // Player
    //-------------------------------------------------------
    this.player = createPlayer(this, 200, height - 550);
    this.player.anims.play('idle');

    this.cursors = this.input.keyboard.createCursorKeys();
    this.playerController = new PlayerController(this, this.player, this.cursors);

    this.keyEsc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    //-------------------------------------------------------
    // Ground contact tracking
    //-------------------------------------------------------
    this.matter.world.on('collisionstart', (event) => {
      for (const pair of event.pairs) {
        const A = pair.bodyA;
        const B = pair.bodyB;
        if (A.label === 'FOOT_SENSOR' && B.isStatic) this.player.onGroundContacts++;
        if (B.label === 'FOOT_SENSOR' && A.isStatic) this.player.onGroundContacts++;
      }
    });

    this.matter.world.on('collisionend', (event) => {
      for (const pair of event.pairs) {
        const A = pair.bodyA;
        const B = pair.bodyB;
        if (A.label === 'FOOT_SENSOR' && B.isStatic)
          this.player.onGroundContacts = Math.max(0, this.player.onGroundContacts - 1);
        if (B.label === 'FOOT_SENSOR' && A.isStatic)
          this.player.onGroundContacts = Math.max(0, this.player.onGroundContacts - 1);
      }
    });
// --- Ramp music --------------------------------------------------
this.rampMusic = this.sound.add('rampMusic', {
  volume: 1,
  loop: true,
});

this.rampMusic.play();


    //-------------------------------------------------------
    // Footer
    //-------------------------------------------------------
    this.add.text(width / 2, height - 30, 'Press ESC to return', {
      fontSize: '14px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }).setOrigin(0.5);
  }

  //---------------------------------------------------------
  // Create a static Matter polygon from one source of truth
  //---------------------------------------------------------
  createMatterPolygon(points) {
    // Compute centroid
    let cx = 0, cy = 0;
    for (const p of points) { cx += p.x; cy += p.y; }
    cx /= points.length;
    cy /= points.length;

    // Convert to local coords
    const local = points.map(p => ({
      x: p.x - cx,
      y: p.y - cy
    }));

    // Build polygon
    this.matter.add.fromVertices(
      cx,
      cy,
      [local],
      { isStatic: true, label: 'GROUND' },
      true
    );
  }

  //---------------------------------------------------------
  // Debug draw from the same ramp points
  //---------------------------------------------------------
  drawDebugSpline(rampPoints, bottomPoints) {
    const gfx = this.add.graphics();

    // Top spline
    gfx.lineStyle(4, 0xffff00, 1);
    gfx.beginPath();
    gfx.moveTo(rampPoints[0].x, rampPoints[0].y);
    for (let i = 1; i < rampPoints.length; i++) {
      gfx.lineTo(rampPoints[i].x, rampPoints[i].y);
    }
    gfx.strokePath();

    // Bottom spline
    gfx.lineStyle(2, 0xff00ff, 0.8);
    for (let i = 0; i < bottomPoints.length - 1; i++) {
      gfx.strokeLineShape({
        x1: bottomPoints[i].x,     y1: bottomPoints[i].y,
        x2: bottomPoints[i+1].x,   y2: bottomPoints[i+1].y
      });
    }
  }

  //---------------------------------------------------------
  update() {
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      if (this.rampMusic) {
        this.rampMusic.stop();
        this.rampMusic = null;
      }

      this.scene.start('GameScene');
      return;
    }

    this.playerController.update();
  }
}



// ======================================================================
//  GAME CONFIG
// ======================================================================

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#1e1e1e',
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 1 },
      debug: false, // set true if you want to see bodies
    },
  },
  scene: [TitleScene, GameScene, RampScene],
};

new Phaser.Game(config);
