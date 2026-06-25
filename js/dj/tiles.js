// Tiles — ported from Sprites/tile.py. Seven types sharing a base.
(function (DJ) {
  const A = () => DJ.Assets;
  const randint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const choice = (arr) => arr[(Math.random() * arr.length) | 0];

  // weighted pick over population (last weight may correspond to null)
  function weightedChoice(pop, weights) {
    const total = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pop.length; i++) { r -= weights[i]; if (r <= 0) return pop[i]; }
    return pop[pop.length - 1];
  }

  const State = { total: 0 };

  class Tile {
    constructor(game, x, y) {
      State.total += 1;
      this.game = game;
      this.SCREEN_HEIGHT = game.SCREEN_HEIGHT;
      this.SCREEN_WIDTH = game.SCREEN_WIDTH;
      this.CENTER_X = game.CENTER_X;
      this.player = game.player;
      this.x = x; this.y = y;
      this.frameKey = "tileDefault";
      const f = A().FRAMES.tileDefault;
      this.rect = DJ.grect(x, y, f[2], f[3]);
      this.power_up = null;
      this.killed = false;

      if (!(this instanceof BrokenTile) && !(this instanceof MovingTile) && !this.game.main_menu) {
        this.generate_power_up();
      }
      this.game.platforms.push(this);
    }

    generate_power_up() {
      const cls = weightedChoice(DJ.POWER_UP_LIST.concat([null]), DJ.POWER_UP_WEIGHTS);
      if (cls) this.power_up = new cls(this.game, this.rect.centerx, this.rect.centery, this);
    }

    handle_events() {}
    update_current_image() {}

    update() { this.death_check(); this.player_collision_check(); this.power_up_check(); }
    power_up_check() { if (this.power_up) { this.power_up.update(); if (this.power_up && this.power_up.killed) this.power_up = null; } }

    player_collision_check() {
      const p = this.player;
      if (this.rect.colliderect(p.rect)) {
        if (p.falling && !p.dead && !p.is_using_booster() && !p.is_flying()) p.jump();
      }
    }
    death_check() { if (this.rect.y > this.SCREEN_HEIGHT) { State.total -= 1; this.killed = true; } }

    sheet() { return A().sheet(); }
    draw(e) {
      e.setAlpha(this.game.fade_out_alpha);
      e.gframe(this.sheet(), A().FRAMES[this.frameKey], this.rect.x, this.rect.y);
      e.resetAlpha();
      if (this.power_up) this.power_up.draw(e);
    }
  }

  class BrokenTile extends Tile {
    constructor(game, x, y) {
      super(game, x, y);
      this.frameKey = "tileBroken";
      this.start = this.y;
      this.velocity = [0, 0];
      this.gravity = 0.2;
      this.fall = false;
    }
    update() { this.death_check(); this.player_collision_check(); this.fall_check(); }
    fall_check() {
      if (this.fall) {
        this.velocity[1] += this.gravity;
        this.rect.move_ip(this.velocity[0], this.velocity[1]);
        if (this.velocity[1] < 2) this.frameKey = "tileBroken1";
        else if (this.velocity[1] < 3) this.frameKey = "tileBroken2";
        else if (this.velocity[1] < 4) this.frameKey = "tileBroken3";
      }
    }
    player_collision_check() {
      const p = this.player;
      if (!this.fall) {
        if (this.rect.colliderect(p.rect) && p.falling && p.rect.bottom >= this.rect.top &&
            !p.dead && !p.is_using_booster() && !p.is_flying()) {
          A().play("break"); this.fall = true;
        }
      }
    }
  }

  class MovingTile extends Tile {
    constructor(game, x, y) {
      super(game, x, y);
      this.velocity = choice([-1, 1]);
      this.speed = randint(1, 4);
      this.frameKey = "tileMoving";
      this._generate_boundaries();
      this.paused = false;
    }
    update() {
      if (!this.player.paused) {
        this.update_movement(); this.boundary_check(); this.death_check();
        this.player_collision_check(); this.power_up_check();
      }
    }
    update_movement() {
      this.rect.x += this.velocity * this.speed;
      if (this.power_up) this.power_up.rect.x += this.velocity * this.speed;
    }
    boundary_check() {
      if (this.rect.right > this.max_right) { this.rect.right = this.max_right; this.velocity *= -1; }
      else if (this.rect.left < this.max_left) { this.rect.left = this.max_left; this.velocity *= -1; }
    }
    _generate_boundaries() {
      let max_left = randint(0, this.CENTER_X);
      let max_right = randint(this.CENTER_X + 1, 640);
      while (max_right - max_left < 150) {
        max_left = randint(0, this.CENTER_X);
        max_right = randint(this.CENTER_X + 2, 640);
      }
      this.max_left = max_left; this.max_right = max_right;
    }
  }

  class DisappearingTile extends Tile {
    constructor(game, x, y) { super(game, x, y); this.frameKey = "tileDisappearing"; }
    player_collision_check() {
      const p = this.player;
      if (this.rect.colliderect(p.rect) && p.falling && !p.dead && !p.is_using_booster() && !p.is_flying()) {
        A().play("pop"); p.jump(); State.total -= 1; this.killed = true;
      }
    }
  }

  class ShiftingTile extends Tile {
    constructor(game, x, y) {
      super(game, x, y);
      this.frameKey = "tileShifting";
      this.shift = false; this.move_speed = 5;
      this.upper_bound = this.SCREEN_WIDTH - this.rect.width;
      this.lower_bound = this.rect.width;
    }
    update() { this.death_check(); this.player_collision_check(); this.shift_check(); this.power_up_check(); }
    player_collision_check() {
      const p = this.player;
      if (this.rect.colliderect(p.rect) && p.falling && p.rect.bottom >= this.rect.top &&
          !p.dead && !p.is_using_booster() && !p.is_flying()) {
        let target_x = randint(this.lower_bound, this.upper_bound);
        while (target_x > this.rect.left - 50 && target_x < this.rect.right + 50) target_x = randint(this.lower_bound, this.upper_bound);
        this.target_x = target_x; p.jump(); this.shift = true;
      }
    }
    shift_check() {
      if (this.shift) {
        if (this.rect.x < this.target_x) { this.rect.x += 5; if (this.power_up) this.power_up.rect.x += 5; }
        else if (this.rect.x > this.target_x) { this.rect.x -= 5; if (this.power_up) this.power_up.rect.x -= 5; }
        if (this.target_x - 5 <= this.rect.x && this.rect.x <= this.target_x + 5) this.shift = false;
      }
    }
  }

  class MoveableTile extends Tile {
    constructor(game, x, y) {
      super(game, x, y);
      this.frameKey = "moveable";
      this.moving = false; this.moved = false;
      if (this.power_up) { this.power_up.rect.x = this.rect.x + 20; this.power_up.rect.y += 6; }
    }
    sheet() { return A().defaultSheet(); }
    handle_events(ev) {
      if (ev.type === "MOUSEBUTTONDOWN" && ev.button === 1 && !this.moved) {
        if (this.rect.collidepoint(ev.pos.x, ev.pos.y)) {
          this.moving = true;
          this.offset_x = ev.pos.x - this.rect.x;
          this.offset_y = ev.pos.y - this.rect.y;
        }
      } else if (ev.type === "MOUSEBUTTONUP" && ev.button === 1 && this.moving) {
        this.moving = false; this.moved = true;
      }
    }
    update() { this.death_check(); this.player_collision_check(); this.check_moving(); this.power_up_check(); }
    player_collision_check() {
      const p = this.player;
      if (this.rect.colliderect(p.rect) && p.falling && p.rect.bottom >= this.rect.top &&
          !p.dead && !p.is_using_booster() && !p.is_flying()) {
        p.jump();
        if (this.moving) { this.moving = false; this.moved = true; }
      }
    }
    check_moving() {
      if (this.moving) {
        const m = this.game.engine.mousePos();
        this.rect.x = m.x - this.offset_x; this.rect.y = m.y - this.offset_y;
        if (this.power_up) { this.power_up.rect.x = m.x - this.offset_x + 20; this.power_up.rect.y = m.y - this.offset_y; }
      }
    }
    draw(e) {
      e.setAlpha(this.game.fade_out_alpha);
      e.gframe(A().defaultSheet(), A().DEFAULT_SHEET_FRAMES.moveable, this.rect.x, this.rect.y);
      e.resetAlpha();
      if (this.power_up) this.power_up.draw(e);
    }
  }

  class ExplodingTile extends Tile {
    constructor(game, x, y) {
      super(game, x, y);
      this.frameKey = "tileExp0";
      this.start = this.y; this.velocity = [0, 0]; this.gravity = 0.2;
      this.frame = 0; this.collision = false;
    }
    update() { this.death_check(); this.player_collision_check(); this.explode_check(); }
    explode_check() {
      if (this.collision) {
        const f = this.frame;
        if (f < 5) this.frameKey = "tileExp0";
        else if (f < 10) this.frameKey = "tileExp1";
        else if (f < 15) this.frameKey = "tileExp2";
        else if (f < 20) this.frameKey = "tileExp3";
        else if (f < 25) this.frameKey = "tileExp4";
        else if (f < 30) this.frameKey = "tileExp5";
        else if (f < 35) this.frameKey = "tileExp6";
        else { this.frameKey = "tileExp7"; A().play("explode"); this.killed = true; }
      }
    }
    player_collision_check() {
      const p = this.player;
      if (!this.collision) {
        this.collision = this.rect.colliderect(p.rect);
        if (this.collision && p.falling && p.rect.bottom >= this.rect.top &&
            !p.dead && !p.is_using_booster() && !p.is_flying()) {
          p.jump(); A().play("break");
        }
      } else this.frame += 1;
    }
  }

  DJ.TileState = State;
  // Spawn population + weights (Python: [Tile, MovingTile, ShiftingTile, MoveableTile, DisappearingTile, BrokenTile, ExplodingTile])
  DJ.TILE_TYPES = [Tile, MovingTile, ShiftingTile, MoveableTile, DisappearingTile, BrokenTile, ExplodingTile];
  DJ.Tiles = { Tile, MovingTile, ShiftingTile, MoveableTile, DisappearingTile, BrokenTile, ExplodingTile };
})(window.DJ = window.DJ || {});
