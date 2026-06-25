// Enemies — Monster, UFO, Blackhole. Ported from Sprites/{monster,ufo,blackhole}.py
(function (DJ) {
  const A = () => DJ.Assets;
  const randint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const choice = (arr) => arr[(Math.random() * arr.length) | 0];

  class Monster {
    constructor(game) {
      this.game = game; this.player = game.player;
      this.CENTER_X = game.CENTER_X; this.CENTER_Y = game.CENTER_Y;
      this.SCREEN_HEIGHT = game.SCREEN_HEIGHT; this.SCREEN_WIDTH = game.SCREEN_WIDTH;
      this.GRAVITY = game.GRAVITY; this.JUMP_STRENGTH = game.JUMP_STRENGTH;

      const keys = ["monTerrifier", "monFatGreen", "monBat", "monDouble", "monBall"];
      this.frameKey = choice(keys);
      const f = A().FRAMES[this.frameKey];
      this.rect = DJ.grect(0, 0, f[2], f[3]);
      this.rect.x = randint(this.rect.width, this.SCREEN_WIDTH - this.rect.width);
      this.rect.y = -this.rect.height;

      this.prior_speed = this.speed = randint(1, 5);
      this.prior_speed_x = this.speed_x = randint(1, 5);
      this.prior_speed_y = this.speed_y = randint(1, 5);
      this.direction = 1; this.direction_x = 1; this.direction_y = 1;
      this.angle = 0; this.radius = 100;

      this.movement_function = choice([this.ping_pong_ball, this.up_down_movement, this.side_to_side_movement]);
      this.sound = A().loop("monster");      // continuous growl while on screen
      A().play("monster_warning", 1);        // alert when it appears (near)
      this.blocked = false; this.collision = false; this.paused = false; this.killed = false;
    }
    update_current_image() {}
    update() { this.movement_function(); this.boundary_check(); this.killed_check(); this.player_collision_check(); }
    pause() {
      this.prior_speed = this.speed; this.prior_speed_x = this.speed_x; this.prior_speed_y = this.speed_y;
      this.speed = 0; this.speed_x = 0; this.speed_y = 0;
    }
    unpause() { this.speed = this.prior_speed; this.speed_x = this.prior_speed_x; this.speed_y = this.prior_speed_y; }

    player_collision_check() {
      const p = this.player;
      if (this.rect.colliderect(p.rect) && !this.collision && !p.is_flying() && !p.dead) {
        if (p.using_shield) {
          p.jump(false); this.blocked = true; this.collision = false;
          if (p.falling) this.remove();
          else { p.using_shield = false; A().play("block"); }
        } else if (!this.blocked) {
          this.collision = true;
          if (p.falling) { p.jump(false); this.remove(); }
          else {
            p.handling_events = false; p.knocked_out = true; p.dead = true; p.velocity_y = -1;
            A().play("thump", 1);
          }
        }
      } else this.blocked = false;
    }
    remove() { A().play(choice(["die_1", "die_2"])); if (this.sound) this.sound.pause(); this.killed = true; }
    killed_check() {
      for (const b of this.game.bullets) {
        if (!b.killed && this.rect.colliderect(b.rect)) { b.killed = true; this.remove(); break; }
      }
    }
    boundary_check() { if (this.rect.y > this.SCREEN_HEIGHT) { if (this.sound) this.sound.pause(); this.killed = true; } }

    ping_pong_ball() {
      this.rect.x += this.speed_x * this.direction_x;
      this.rect.y += this.speed_y * this.direction_y;
      if (this.rect.right > this.SCREEN_WIDTH || this.rect.left < 0) this.direction_x *= -1;
      if (this.rect.bottom > this.SCREEN_HEIGHT || this.rect.top < 0) this.direction_y *= -1;
    }
    up_down_movement() {
      this.rect.y += this.speed * this.direction;
      if (this.rect.bottom > this.SCREEN_HEIGHT || this.rect.top < 0) this.direction *= -1;
    }
    side_to_side_movement() {
      this.rect.x += this.speed * this.direction;
      if (this.rect.right > this.SCREEN_WIDTH || this.rect.left < 0) this.direction *= -1;
    }
    draw(e) {
      e.setAlpha(this.game.fade_out_alpha);
      e.gframe(A().sheet(), A().FRAMES[this.frameKey], this.rect.x, this.rect.y);
      e.resetAlpha();
    }
  }

  class UFO {
    constructor(game, x = null, y = null) {
      this.game = game; this.player = game.player;
      this.SCREEN_WIDTH = game.SCREEN_WIDTH; this.SCREEN_HEIGHT = game.SCREEN_HEIGHT;
      this.paused = false;
      this.frameKey = "ufoDefault";
      const f = A().FRAMES.ufoDefault;
      this.rect = DJ.grect(0, 0, f[2], f[3]);
      if (x === null) this.x = this.rect.x = randint(this.rect.width + 80, this.SCREEN_WIDTH - this.rect.width - 80);
      else this.x = this.rect.x = x;
      if (x === null) this.y = this.rect.y = -this.rect.height;
      else this.y = this.rect.y = y;
      this.blocked = false; this.collision = false; this.angle = 0; this.killed = false;
      this.sound = A().loop("ufo", 1);       // continuous hum while on screen
      A().play("ufo_warning", 1);            // alert when it appears (near)
    }
    update_current_image() { this.frameKey = "ufoDefault"; }
    update() { this.movement_update(); this.player_collision_check(); this.death_check(); this.killed_check(); }
    death_check() { if (this.rect.y > this.SCREEN_HEIGHT) this.remove(); }
    player_collision_check() {
      const p = this.player;
      if (this.rect.colliderect(p.rect) && !this.collision && !p.is_flying() && !p.dead) {
        if (p.using_shield) {
          p.jump(false); this.blocked = true; this.collision = false;
          if (p.falling) this.remove(true);
          else { p.using_shield = false; A().play("block"); }
        } else if (!this.blocked) {
          this.collision = true;
          if (p.falling) { p.jump(false); this.remove(true); }
          else {
            p.using_spring_shoes = false;
            p.suction_object_collided_with = this;
            p.suction_object_collision = true;
            p.dead_by_suction = true;
            p.paused = true; p.dead = true;
            this.collision = true;
            this.game.end_game = true;
            this.frameKey = "ufoCollision";
            A().play("ufo_suck");
          }
        }
      } else this.blocked = false;
    }
    killed_check() {
      for (const b of this.game.bullets) {
        if (!b.killed && this.rect.colliderect(b.rect)) { b.killed = true; this.remove(true); break; }
      }
    }
    remove(play_sound = false) { if (play_sound) A().play("pop"); if (this.sound) this.sound.pause(); this.killed = true; }
    draw(e) {
      e.setAlpha(this.game.fade_out_alpha);
      e.gframe(A().sheet(), A().FRAMES[this.frameKey], this.rect.x, this.rect.y);
      e.resetAlpha();
    }
    movement_update() {
      if (!this.paused) {
        this.angle += 0.09;
        this.rect.x += Math.trunc(5 * Math.sin(this.angle));
        this.rect.y += Math.trunc(2.5 * Math.sin(2 * this.angle));
      }
    }
  }

  class Blackhole {
    constructor(game) {
      this.game = game; this.player = game.player;
      this.SCREEN_WIDTH = game.SCREEN_WIDTH; this.SCREEN_HEIGHT = game.SCREEN_HEIGHT;
      const f = A().FRAMES.blackhole;
      this.rect = DJ.grect(0, 0, f[2], f[3]);
      this.rect.x = randint(this.rect.width, this.SCREEN_WIDTH - this.rect.width);
      this.rect.y = -this.rect.height;
      this.blocked = false; this.collision = false; this.killed = false;
    }
    update_current_image() {}
    update() { this.death_check(); this.player_collision_check(); }
    death_check() { if (this.rect.y > this.SCREEN_HEIGHT) this.killed = true; }
    player_collision_check() {
      const p = this.player;
      if (this.rect.colliderect(p.rect) && !this.collision && !p.is_flying() && !p.dead) {
        if (p.using_shield) {
          p.jump(false); p.using_shield = false; this.blocked = true; this.collision = false; A().play("block");
        } else if (!this.blocked) {
          p.using_spring_shoes = false;
          p.suction_object_collided_with = this;
          p.suction_object_collision = true;
          p.paused = true; p.dead_by_suction = true; p.dead = true;
          this.collision = true; this.game.end_game = true; A().play("suck");
        }
      } else this.blocked = false;
    }
    draw(e) {
      e.setAlpha(this.game.fade_out_alpha);
      e.gframe(A().sheet(), A().FRAMES.blackhole, this.rect.x, this.rect.y);
      e.resetAlpha();
    }
  }

  DJ.Monster = Monster; DJ.UFO = UFO; DJ.Blackhole = Blackhole;
})(window.DJ = window.DJ || {});
