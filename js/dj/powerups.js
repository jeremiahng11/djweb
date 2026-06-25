// Power-ups — ported from Sprites/Power_ups/*.py. Constructor (game, x, y, tile).
(function (DJ) {
  const A = () => DJ.Assets;

  class Jetpack {
    constructor(game, x, y) {
      this.game = game; this.player = game.player;
      this.SCREEN_HEIGHT = game.SCREEN_HEIGHT;
      this.x = x; this.y = y - 10 * DJ.GS;
      const f = A().JETPACK_FRAMES.def;
      this.rect = new DJ.Rect(0, 0, f[2], f[3]); this.rect.center = [this.x, this.y]; // frame already hi-res
      this.killed = false;
    }
    update() { this.death_check(); this.player_collision_check(); }
    death_check() { if (this.rect.y > this.SCREEN_HEIGHT) this.killed = true; }
    player_collision_check() {
      const p = this.player;
      if (this.rect.colliderect(p.rect) && !p.dead && !p.is_flying()) {
        const prev = p.JUMP_STRENGTH; p.JUMP_STRENGTH = -65; p.jump(false); p.JUMP_STRENGTH = prev;
        p.using_jetpack = true; A().play("jetpack");
      }
    }
    draw(e) { e.gframe(A().jetpack(), A().JETPACK_FRAMES.def, this.rect.x, this.rect.y, false, 1); }
  }

  class Propeller {
    constructor(game, x, y) {
      this.game = game; this.player = game.player;
      this.SCREEN_HEIGHT = game.SCREEN_HEIGHT;
      this.x = x; this.y = y - 15 * DJ.GS;
      const f = A().PROPELLER_FRAMES.p1;
      this.rect = new DJ.Rect(0, 0, f[2], f[3]); this.rect.center = [this.x, this.y]; // frame already hi-res
      this.killed = false;
    }
    update() { this.death_check(); this.player_collision_check(); }
    death_check() { if (this.rect.y > this.SCREEN_HEIGHT) this.killed = true; }
    player_collision_check() {
      const p = this.player;
      if (this.rect.colliderect(p.rect) && !p.dead && !p.is_flying()) {
        const prev = p.JUMP_STRENGTH; p.JUMP_STRENGTH = -55; p.jump(false); p.JUMP_STRENGTH = prev;
        p.using_propeller = true; A().play("propeller");
      }
    }
    draw(e) { e.gframe(A().propeller(), A().PROPELLER_FRAMES.p1, this.rect.x, this.rect.y, false, 1); }
  }

  class Shield {
    constructor(game, x, y, tile) {
      this.game = game; this.player = game.player; this.tile = tile;
      this.SCREEN_HEIGHT = game.SCREEN_HEIGHT;
      this.x = x; this.y = y - 30 * DJ.GS;
      this.image = A().img("Power_up/shield_power_up.png");
      this.rect = DJ.grect(0, 0, this.image ? this.image.width : 34, this.image ? this.image.height : 34);
      this.rect.center = [this.x, this.y];
      this.being_used = false; this.killed = false;
    }
    update() { this.death_check(); this.player_collision_check(); }
    death_check() {
      if (this.rect.y > this.SCREEN_HEIGHT || this.being_used) { this.tile.power_up = null; this.killed = true; }
    }
    player_collision_check() {
      const p = this.player;
      if (this.rect.colliderect(p.rect) && !p.dead && !p.using_shield) {
        p.using_shield = true; this.being_used = true; A().play("activate_shield");
      }
    }
    draw(e) { e.gblit(this.image, this.rect.x, this.rect.y); }
  }

  class Spring {
    constructor(game, x, y) {
      this.game = game; this.player = game.player;
      this.SCREEN_HEIGHT = game.SCREEN_HEIGHT;
      this.x = x; this.y = y - 10 * DJ.GS;
      const f = A().FRAMES.spring;
      this.rect = DJ.grect(0, 0, f[2], f[3]); this.rect.center = [this.x, this.y];
      this.expanded = false; this.collision = false; this.killed = false;
    }
    update() { this.death_check(); this.player_collision_check(); }
    player_collision_check() {
      const p = this.player;
      if (this.rect.colliderect(p.rect) && p.falling && !p.dead && !this.expanded) {
        const prev = p.JUMP_STRENGTH; p.JUMP_STRENGTH = -23; p.jump(false); p.JUMP_STRENGTH = prev;
        A().play("spring"); p.using_spring = true; this.collision = true;
      }
    }
    death_check() { if (this.rect.y > this.SCREEN_HEIGHT) this.killed = true; }
    draw(e) {
      if (this.collision && !this.expanded) { this.rect.y -= 20 * DJ.GS; this.expanded = true; }
      const f = this.expanded ? A().FRAMES.springExpanded : A().FRAMES.spring;
      e.gframe(A().sheet(), f, this.rect.x, this.rect.y);
    }
  }

  class SpringShoes {
    constructor(game, x, y) {
      this.game = game; this.player = game.player;
      this.SCREEN_HEIGHT = game.SCREEN_HEIGHT;
      this.x = x; this.y = y - 18 * DJ.GS;
      const f = A().DEFAULT_SHEET_FRAMES.shoeDefault;
      this.rect = DJ.grect(0, 0, f[2], f[3]); this.rect.center = [this.x, this.y];
      this.being_used = false; this.killed = false;
    }
    update() { this.death_check(); this.player_collision_check(); }
    player_collision_check() {
      const p = this.player;
      if (this.rect.colliderect(p.rect) && !p.dead && !p.is_flying()) {
        p.using_spring_shoes = true; p.spring_shoe_jump_count = 0; p.JUMP_STRENGTH = -23; p.jump();
        this.being_used = true;
      }
    }
    death_check() { if (this.rect.y > this.SCREEN_HEIGHT) this.killed = true; }
    draw(e) {
      if (!this.being_used) e.gframe(A().defaultSheet(), A().DEFAULT_SHEET_FRAMES.shoeDefault, this.rect.x, this.rect.y);
    }
  }

  class Trampoline {
    constructor(game, x, y) {
      this.game = game; this.player = game.player;
      this.SCREEN_HEIGHT = game.SCREEN_HEIGHT;
      this.x = x; this.y = y - 10 * DJ.GS;
      const f = A().FRAMES.tramp1;
      this.rect = DJ.grect(0, 0, f[2], f[3]); this.rect.center = [this.x, this.y];
      this.expanded = false; this.frameKey = "tramp1"; this.killed = false;
    }
    update() { this.death_check(); this.player_collision_check(); }
    death_check() { if (this.rect.y > this.SCREEN_HEIGHT) this.killed = true; }
    player_collision_check() {
      const p = this.player;
      const collision = this.rect.colliderect(p.rect);
      if (collision && p.falling && !p.dead) {
        const prev = p.JUMP_STRENGTH; p.JUMP_STRENGTH = -30; p.jump(false); p.JUMP_STRENGTH = prev;
        A().play("trampoline"); this.expanded = true; p.using_trampoline = true; this.frameKey = "tramp2";
      } else if (!collision && this.expanded) this.frameKey = "tramp3";
    }
    draw(e) { e.gframe(A().sheet(), A().FRAMES[this.frameKey], this.rect.x, this.rect.y); }
  }

  DJ.PowerUps = { Jetpack, Propeller, Spring, Shield, SpringShoes, Trampoline };
  // Order used for tile spawn weighting (matches Python Tile.POWER_UPS):
  // [Jetpack, Trampoline, Spring, Propeller, Shield, SpringShoes]
  DJ.POWER_UP_LIST = [Jetpack, Trampoline, Spring, Propeller, Shield, SpringShoes];
  DJ.POWER_UP_WEIGHTS = [0.1, 2, 7, 0.8, 5, 1, 80]; // last entry = None
})(window.DJ = window.DJ || {});
