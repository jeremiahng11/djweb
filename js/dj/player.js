// Player, Bullet, MenuPlayer — ported faithfully from Sprites/player.py.
(function (DJ) {
  const A = () => DJ.Assets;
  const randChoice = (arr) => arr[(Math.random() * arr.length) | 0];

  class Bullet {
    constructor(x, y) {
      this.image = A().projectile();
      this.rect = DJ.grect(0, 0, this.image ? this.image.width : 13, this.image ? this.image.height : 11);
      this.rect.center = [x, y];
      this.killed = false;
    }
    update() {
      this.rect.y -= 15;
      if (this.rect.bottom < 0) this.killed = true;
    }
    draw(e) { e.gblit(this.image, this.rect.x, this.rect.y); }
  }

  class Player {
    constructor(game, x, y) {
      this.game = game;
      this.CENTER_X = game.CENTER_X;
      this.CENTER_Y = game.CENTER_Y;
      this.SCREEN_HEIGHT = game.SCREEN_HEIGHT;
      this.SCREEN_WIDTH = game.SCREEN_WIDTH;
      this.GRAVITY = game.GRAVITY;
      this.JUMP_STRENGTH = game.JUMP_STRENGTH;

      this.default_x = this.x = x;
      this.default_y = this.y = -900;
      this.previous_y_difference = Math.trunc(this.y - this.CENTER_Y);
      this.d = 1;

      const a = A();
      this.left_image = a.player("left");
      this.left_jump_image = a.player("left_jump");
      this.right_image = a.player("right");
      this.right_jump_image = a.player("right_jump");
      this.shoot_image = a.player("shoot");
      this.shoot_jump_image = a.player("shoot_jump");
      this.shield = a.img("Player/shield.png");
      this.prior_image = this.image = this.right_image;

      this.image_scale = 1;
      // Normalize every theme's doodler to the classic 124x120 frame size.
      this.FRAME_W = 124; this.FRAME_H = 120;
      this.pscale = this.image ? this.FRAME_W / this.image.width : 1;
      this.nose = a.player("nose"); // present only for skins that need a detached nose
      // Collision is a feet-anchored body box matching the visible doodler, so
      // it lands on platforms by its legs (a bit forgiving for playability).
      this.BODY_W = 70; this.BODY_H = 92;
      this.frameDX = (this.FRAME_W - this.BODY_W) / 2;   // center body in frame
      this.frameDY = this.FRAME_H - this.BODY_H - 4;     // anchor low (4px foot pad)
      this.rect = new DJ.Rect(0, 0, this.BODY_W, this.BODY_H);
      this.rect.center = [this.x, this.CENTER_Y];

      this.stars = [a.img("Animations/Stars/1.png"), a.img("Animations/Stars/2.png"), a.img("Animations/Stars/3.png")];
      this.knocked_out_animation = this.stars;

      this.speed = 5;
      this.movement_speed = 1;
      // Classic-style smooth horizontal movement.
      this.velocity_x = 0;
      this.MAX_VX = 10;      // top horizontal speed (px/frame) ~= classic 600/s
      this.ACCEL_X = 1.2;    // snappier keyboard ramp-up
      this.FRICTION_X = 0.7; // quicker stop when no input
      this.TILT_FULL_DEG = 22; // tilt angle (deg) for full speed
      this.end_game_y = 840;
      this.prior_y_velocity = 0;
      this.velocity_y = 0;
      this.score = 0;
      this.spring_shoe_jump_count = 0;

      this.using_spring_shoes = false;
      this.using_jetpack = false;
      this.using_propeller = false;
      this.using_shield = false;
      this.using_trampoline = false;
      this.using_spring = false;

      this.left = false;
      this.right = true;
      this.suction_object_collided_with = null;
      this.suction_object_collision = false;
      this.dead_by_suction = false;
      this.dead = false;

      this.spring_collision = false;
      this.trampoline_collision = false;

      this.jumping = false;
      this.falling = false;
      this.fall_checked = false;
      this.paused = false;
      this.knocked_out = false;
      this.handling_events = true;
      this.collision = false;
      this.draw_player = true;
    }

    handle_events(ev) {
      if (!this.paused && !this.is_flying() && !this.dead) {
        if (ev.type === "KEYDOWN" && (ev.key === "SPACE" || ev.key === "UP")) this.shoot();
        else if (ev.type === "MOUSEBUTTONDOWN" && ev.button === 1) this.shoot();
      }
    }

    update() {
      if (!this.paused) {
        this.update_movement();
        this.update_position_based_on_gravity();
        this.update_directional_image();
        this.update_score();
        this.update_spawning_properties();
        this.fall_check();
        this.y_boundary_check();
        this.x_boundary_check();
        this.spring_shoe_check();
        this.update_rect();
        this.update_other_sprites_based_upon_player_jump_difference();
      } else if (this.suction_object_collision) {
        this.suck_player_to_center_of_object();
      }
    }

    update_movement() {
      if (!(this.handling_events && !this.dead)) return;
      const e = this.game.engine;
      const MAX = this.MAX_VX;

      // Tilt (mobile) takes priority and sets speed directly; otherwise
      // keyboard accelerates smoothly; otherwise friction decays to a stop.
      let tilt = 0;
      if (e.tiltActive) tilt = Math.max(-1, Math.min(1, e.tiltGamma / this.TILT_FULL_DEG));

      let dir = 0;
      if (e.keyPressed("LEFT")) dir -= 1;
      if (e.keyPressed("RIGHT")) dir += 1;

      if (Math.abs(tilt) > 0.04) {
        this.velocity_x = tilt * MAX;
      } else if (dir !== 0) {
        this.velocity_x += dir * this.ACCEL_X;
        if (this.velocity_x > MAX) this.velocity_x = MAX;
        if (this.velocity_x < -MAX) this.velocity_x = -MAX;
      } else {
        this.velocity_x *= this.FRICTION_X;
        if (Math.abs(this.velocity_x) < 0.15) this.velocity_x = 0;
      }
      this.x += this.velocity_x;

      // Facing follows movement direction.
      if (this.velocity_x < -0.2) { this.left = true; this.right = false; this.prior_image = this.image = this.left_image; }
      else if (this.velocity_x > 0.2) { this.right = true; this.left = false; this.prior_image = this.image = this.right_image; }

      // Shoot pose while firing (tap / click / space / up), if not flying.
      if ((e.keyPressed("SPACE") || e.keyPressed("UP") || e.mouseDown) && !this.is_flying()) {
        this.prior_image = this.image = this.shoot_image;
      }
    }

    update_position_based_on_gravity() {
      this.velocity_y += this.GRAVITY;
      this.y += this.velocity_y;

      if (this.velocity_y > this.GRAVITY && !this.falling) {
        this.end_game_y = this.y + 450 + this.FRAME_H + 40;
        this.using_jetpack = false;
        this.using_propeller = false;
        this.using_trampoline = false;
        this.using_spring = false;
        this.falling = true;
        this.jumping = false;
      } else if (this.velocity_y < this.GRAVITY) {
        this.falling = false;
        this.jumping = true;
      }
    }

    update_directional_image() {
      if (this.jumping) {
        if (this.image === this.left_image) this.image = this.left_jump_image;
        else if (this.image === this.right_image) this.image = this.right_jump_image;
        else if (this.image === this.shoot_image) this.image = this.shoot_jump_image;
      } else {
        this.image = this.prior_image;
      }
    }

    update_score() {
      if (this.y < -900) this.score = Math.max(this.score, Math.abs(this.y) - 900);
      Player.high_score = Math.max(Player.high_score, this.score);
    }

    update_spawning_properties() {
      const g = this.game;
      if (g.frame === 0) {
        g.enemy_weight = this.score / 100000;
        if (this.score > 2500 && this.score <= 5000) g.tile_weights[0] = 250;
        if (this.score > 5000 && this.score <= 1000) { g.tile_weights[0] = 100; g.max_enemy_number = 1; }
        else if (this.score > 10000 && this.score <= 25000) { g.tile_weights[0] = 50; g.max_enemy_number = 2; }
        else if (this.score > 25000) { g.tile_weights[0] = 25; g.max_enemy_number = 3; }
        else if (this.score > 50000) g.tile_weights = [5, 5, 5, 0.1, 5, 1, 2];
      }
    }

    fall_check() {
      if (this.y >= this.end_game_y && !this.fall_checked) {
        if (this.y < 390) {
          const difference = Math.abs(this.y) - 900;
          this.y = -900;
          for (const p of this.game.platforms) {
            p.rect.y += difference;
            if (p.power_up) p.power_up.rect.y += difference;
          }
          for (const en of this.game.allEnemies()) en.rect.y += difference;
        }
        A().play("fall");
        this.fall_checked = true;
      }
    }

    y_boundary_check() {
      if (this.rect.top >= 900) {
        this.rect.y = 900;
        this.velocity_y = 0;
        this.dead = true;
        this.game.end_game = true;
      }
    }

    x_boundary_check() {
      if (this.x > this.SCREEN_WIDTH) this.x = 0;
      else if (this.x < 0) this.x = this.SCREEN_WIDTH;
    }

    spring_shoe_check() {
      if (this.using_spring_shoes && this.spring_shoe_jump_count % 5 === 0) {
        this.JUMP_STRENGTH = this.game.JUMP_STRENGTH;
        this.using_spring_shoes = false;
      }
    }

    update_rect() { this.rect.center = [this.x, this.y]; }

    update_other_sprites_based_upon_player_jump_difference() {
      if (this.y < this.CENTER_Y - this.rect.height) {
        const difference = Math.trunc((this.y - this.CENTER_Y) - this.previous_y_difference);
        this.previous_y_difference = Math.trunc(this.y - this.CENTER_Y);
        for (const p of this.game.platforms) {
          p.rect.y -= difference;
          if (p.power_up) p.power_up.rect.y -= difference;
        }
        for (const en of this.game.allEnemies()) en.rect.y -= difference;
        this.rect.y = (this.SCREEN_HEIGHT / 2 - this.rect.height) | 0;
      }
    }

    suck_player_to_center_of_object() {
      const obj = this.suction_object_collided_with;
      const sx = obj.rect.centerx, sy = obj.rect.centery;
      if (this.suction_object_collision && !(this.rect.x === sx && this.rect.y === sy)) {
        const dx = sx - this.rect.centerx, dy = sy - this.rect.centery;
        const distance = Math.hypot(dx, dy);
        if (distance >= 5) {
          const inv = 5 / distance;
          this.rect.move_ip(dx * inv, dy * inv);
        }
        if (this.image_scale > 0.02) this.image_scale -= 0.02;
      }
    }

    draw(e) {
      if (!this.draw_player) return;
      // Visual frame top-left = body box minus the frame offset.
      const fx = this.rect.x - this.frameDX, fy = this.rect.y - this.frameDY;
      const shooting = this.image === this.shoot_image || this.image === this.shoot_jump_image;

      if (this.image_scale < 1) {
        const s = this.pscale * this.image_scale;
        e.gblit(this.image, this.rect.centerx - this.image.width * s / 2,
                this.rect.centery - this.image.height * s / 2, false, s);
      } else {
        e.gblit(this.image, fx, fy, false, this.pscale);
        // Detached nose/trunk on shoot (only skins that ship a nose.png).
        if (shooting && this.nose && this.nose.width > 0) {
          const s = this.pscale;
          e.gblit(this.nose, this.rect.centerx - this.nose.width * s / 2, fy + 6 * s, false, s);
        }
      }
      if (this.knocked_out) {
        e.gblit(this.knocked_out_animation[this.game.frame % 3], fx, fy - 10 * this.pscale, false, this.pscale);
      }
      if (this.is_flying() && this.image === this.shoot_jump_image) this.image = this.right_image;
      this.draw_jetpack(e);
      this.draw_propeller(e);
      this.draw_shield(e);
      this.draw_spring_shoes(e);
    }

    draw_jetpack(e) {
      if (!this.using_jetpack) return;
      const a = A(), JF = a.JETPACK_FRAMES, sheet = a.jetpack(), S = this.pscale;
      let x = this.rect.x;
      x = this.right ? x - 5 * S : x + 35 * S;
      const excess_y = (a.fileName === "ooga" ? 13 : 0) * S;
      const frame = this.game.frame;
      let f;
      if (frame < 16) f = [JF.r1, JF.r2, JF.r3][frame % 3];
      else if (frame < 147) f = [JF.r4, JF.r5, JF.r6][frame % 3];
      else if (frame < 155) f = [JF.r7, JF.r8, JF.r9][frame % 3];
      else f = JF.def;
      if (this.paused) f = JF.r6;
      e.gframe(sheet, f, x, this.rect.y + 20 * S + excess_y, this.right, S);
    }

    draw_propeller(e) {
      if (!this.using_propeller) return;
      const a = A(), PF = a.PROPELLER_FRAMES, sheet = a.propeller(), S = this.pscale;
      const order = [PF.p1, PF.p2, PF.p3, PF.p4];
      const f = this.paused ? PF.p3 : order[this.game.frame % 4];
      e.gframe(sheet, f, this.rect.centerx - 15 * S, this.rect.top - 3 * S, false, S);
    }

    draw_shield(e) {
      if (!this.using_shield || !this.shield || !this.shield.width) return;
      // Translucent bubble centered on and sized to surround the doodler frame.
      const S = this.pscale;
      const fx = this.rect.x - this.frameDX, fy = this.rect.y - this.frameDY;
      const fw = this.FRAME_W * S, fh = this.FRAME_H * S;
      const w = fw * 0.98, h = fh * 0.98;
      const ctx = e.ctx;
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.drawImage(this.shield, fx + (fw - w) / 2, fy + (fh - h) / 2, w, h);
      ctx.restore();
    }

    draw_spring_shoes(e) {
      if (!this.using_spring_shoes) return;
      const a = A(), DF = a.DEFAULT_SHEET_FRAMES, sheet = a.defaultSheet(), S = this.pscale;
      if (this.image === this.shoot_image || this.image === this.shoot_jump_image) {
        const f = this.jumping ? DF.shoeShootComp : DF.shoeShoot;
        const ey = this.jumping ? 3 : 0;
        e.gframe(sheet, f, this.rect.x + 15 * S, this.rect.bottom - (5 - ey) * S, false, S);
      } else {
        const ex = this.right ? 5 : 0;
        const ey = this.jumping ? 3 : 0;
        const f = this.jumping ? DF.shoeCompressed : DF.shoeDefault;
        e.gframe(sheet, f, this.rect.x + (15 + ex) * S, this.rect.bottom - (5 - ey) * S, this.right, S);
      }
    }

    move_left() { this.prior_image = this.image = this.left_image; this.x -= this.speed; this.left = true; this.right = false; }
    move_right() { this.prior_image = this.image = this.right_image; this.x += this.speed; this.right = true; this.left = false; }

    shoot() {
      this.prior_image = this.image = this.shoot_image;
      A().play(randChoice(["shoot_1", "shoot_2"]));
      this.game.bullets.push(new Bullet(this.rect.centerx, this.rect.top));
    }

    jump(play_sound = true) {
      if (!this.is_flying()) {
        this.game.frame = 0;
        this.velocity_y = this.JUMP_STRENGTH;
        this.jumping = true;
        if (play_sound) A().play("jump");
        if (this.using_spring_shoes && !this.is_using_booster()) {
          A().play("spring");
          this.spring_shoe_jump_count += 1;
        }
      }
    }

    is_flying() { return this.using_jetpack || this.using_propeller; }
    is_using_booster() { return this.using_trampoline || this.using_spring; }

    update_image() { this.image = A().player("right"); this.prior_image = this.image; }

    // Re-fetch theme-specific images after a skin change (menu use).
    reloadImages() {
      const a = A();
      this.left_image = a.player("left");
      this.left_jump_image = a.player("left_jump");
      this.right_image = a.player("right");
      this.right_jump_image = a.player("right_jump");
      this.shoot_image = a.player("shoot");
      this.shoot_jump_image = a.player("shoot_jump");
      this.nose = a.player("nose");
      this.pscale = this.right_image && this.right_image.width ? this.FRAME_W / this.right_image.width : 1;
      this.prior_image = this.image = this.right_image;
    }
  }
  Player.high_score = parseInt(localStorage.getItem("DJ2_highscore") || "0", 10) || 0;

  class MenuPlayer extends Player {
    constructor(game, x, y) {
      super(game, x, y);
      this.y = 760;
      this.velocity_y = this.JUMP_STRENGTH;
    }
    handle_events() {}
    update() {
      this.velocity_y += this.GRAVITY;
      this.y += this.velocity_y;
      if (this.velocity_y > this.GRAVITY) { this.falling = true; this.jumping = false; }
      else this.falling = false;
      this.rect.topleft = [this.x, this.y];
    }
  }

  DJ.Player = Player;
  DJ.Bullet = Bullet;
  DJ.MenuPlayer = MenuPlayer;
})(window.DJ = window.DJ || {});
