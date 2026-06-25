// Game — states, spawning, scoring, end game. Ported from game.py.
(function (DJ) {
  const A = () => DJ.Assets;
  const randint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  function weightedChoice(pop, weights) {
    const total = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pop.length; i++) { r -= weights[i]; if (r <= 0) return pop[i]; }
    return pop[pop.length - 1];
  }

  class Game {
    constructor(engine) {
      this.engine = engine;
      this.SCREEN_WIDTH = 640;
      this.SCREEN_HEIGHT = 900;
      this.CENTER_X = 320;
      this.CENTER_Y = 450;
      // Tuned to the real Doodle Jump feel (classic: gravity 1728/s², jump
      // -1080/s at 60fps in a 960 world, scaled to this 900 world).
      this.GRAVITY = 0.45;
      this.JUMP_STRENGTH = -17;

      this.running = true;
      this.main_menu = true;
      this.options_menu = false;
      this.play_game = false;
      this.end_game = false;

      this.platforms = [];
      this.bullets = [];
      this.monsters = [];
      this.blackholes = [];
      this.UFOs = [];

      this.tile_objects = DJ.TILE_TYPES;
      this.enemy_objects = [DJ.Monster, DJ.Blackhole, DJ.UFO];

      this.quadrants = ["Q1", "Q2", "Q3", "Q4"];
      this.quadrant_idx = 0;

      this.fade_out_speed = 3;
      this.fade_out_alpha = 255;
      this.frame = 0;

      // Images
      this.MAIN_MENU_IMAGE = A().img("Backgrounds/main_menu.png");
      this.BACKGROUND_IMAGE = this.MAIN_MENU_IMAGE;
      this.END_SHEET = A().img("start-end-tiles.png");

      this.initialise_main_menu_objects();
    }

    allEnemies() { return this.monsters.concat(this.blackholes, this.UFOs); }

    // ---- init ----
    initialise_main_menu_objects() {
      this.player = new DJ.MenuPlayer(this, 110, 750);
      new DJ.Tiles.Tile(this, 115, 763);          // self-adds to platforms
      this.UFOs.push(new DJ.UFO(this, 450, 200));
      this.play_button = new DJ.UI.PlayButton(this);
      this.options_button = new DJ.UI.OptionButton(this);
      this.main_menu_button = new DJ.UI.MenuButton(this, { x: null, y: 200 });
    }

    initialise_game_objects() {
      DJ.TileState.total = 0;
      this.clear_all_sprites();
      this.player = new DJ.Player(this, this.CENTER_X, this.CENTER_Y);
      this.resume_button = new DJ.UI.ResumeButton(this);
      this.pause_button = new DJ.UI.PauseButton(this);
      this.play_again_button = new DJ.UI.PlayAgain(this);
      this.main_menu_button = new DJ.UI.MenuButton(this, { x_multiplier: 1.75, y_multiplier: 1.5 });
      this.generate_n_tiles(20, false);
    }

    initialise_game_weights() {
      this.max_tile_number = 20;
      this.tile_weights = [9999999, 5, 5, 1, 5, 5, 5];
      this.max_enemy_number = 1;
      this.enemy_weight = 0.001;
    }

    clear_all_sprites() {
      for (const m of this.monsters) if (m.sound) m.sound.pause();
      for (const u of this.UFOs) if (u.sound) u.sound.pause();
      this.platforms = [];
      this.bullets = [];
      this.monsters = [];
      this.blackholes = [];
      this.UFOs = [];
    }

    changeTheme(name) {
      A().setTheme(name).then(() => {
        this.BACKGROUND_IMAGE = A().background();
        if (this.player && this.player.reloadImages) this.player.reloadImages();
      });
    }

    // ---- generation ----
    generate_random_tile() {
      while (DJ.TileState.total <= this.max_tile_number) {
        const tile = weightedChoice(this.tile_objects, this.tile_weights);
        this.generate_n_tiles(1, true, tile);
      }
    }

    generate_random_enemy() {
      if (this.allEnemies().length < this.max_enemy_number && !this.player.paused) {
        const enemy = weightedChoice(
          this.enemy_objects.concat([null]),
          [this.enemy_weight, this.enemy_weight, this.enemy_weight, 100]
        );
        if (enemy === DJ.Monster) this.monsters.push(new DJ.Monster(this));
        else if (enemy === DJ.Blackhole) this.blackholes.push(new DJ.Blackhole(this));
        else if (enemy === DJ.UFO) this.UFOs.push(new DJ.UFO(this));
      }
    }

    generate_n_tiles(n = 1, top = false, tile_type = DJ.Tiles.Tile) {
      const W = this.SCREEN_WIDTH, H = this.SCREEN_HEIGHT;
      const ranges = {
        Q1: [[0, 320], [0, 450]], Q2: [[320, 640], [0, 450]],
        Q3: [[0, 320], [450, 900]], Q4: [[320, 640], [450, 900]],
      };
      const quadCoords = () => {
        const q = this.quadrants[this.quadrant_idx % 4];
        const [[xl, xh], [yl, yh]] = ranges[q];
        let xlb = 0, xub = 0, ylb = 0, yub = 0;
        if (q === "Q1") { xlb = 60; ylb = 20; }
        else if (q === "Q2") { xub = -60; ylb = 20; }
        else if (q === "Q3") { xlb = 60; yub = -20; }
        else if (q === "Q4") { xub = -60; yub = -20; }
        const x = randint(xl + xlb, xh + xub);
        const y = randint(yl - ylb - 900, yh - yub - 900);
        return [x, y];
      };

      for (let i = 0; i < n; i++) {
        let valid = false, x = 0, y = 0;
        while (!valid) {
          valid = true;
          if (top) [x, y] = quadCoords();
          else { x = randint(65, W - 65); y = randint(-450, H - 25); }
          const np = DJ.grect(x, y, 60, 20);
          const c1 = np.center;
          for (const sprite of this.platforms.concat(this.allEnemies())) {
            const c2 = sprite.rect.center;
            const dist = Math.hypot(c1[0] - c2[0], c1[1] - c2[1]);
            if (np.colliderect(sprite.rect) || dist < 125) { valid = false; break; }
          }
        }
        new tile_type(this, x, y); // self-adds to platforms
        this.quadrant_idx += 1;
      }
    }

    // ---- drawing ----
    draw_top(e) {
      e.blitFrame(A().top(), [0, 0, 640, 92], 0, 0);
      e.text(String(Math.floor(this.player.score)), 30, 14, 46, "black", "Arial");
      this.pause_button.draw(e);
      this.resume_button.draw(e);
    }

    draw_end_game_screen(e) {
      this.draw_top(e);
      const U = A().UI_FRAMES;
      const score = String(Math.floor(this.player.score));
      const high = String(Math.floor(DJ.Player.high_score));
      e.text(score, this.CENTER_X, this.CENTER_Y * 0.826, 46, "black", "Arial", "center");
      e.text(high, this.CENTER_X, this.CENTER_Y * 1.13, 46, "black", "Arial", "center");
      e.blitFrame(this.END_SHEET, U.yourScore, (this.SCREEN_WIDTH - U.yourScore[2]) / 2, this.CENTER_Y * 0.7);
      e.blitFrame(this.END_SHEET, U.yourHigh, (this.SCREEN_WIDTH - U.yourHigh[2]) / 2, this.CENTER_Y * 0.95);
      e.blitFrame(this.END_SHEET, U.gameOver, this.CENTER_X - U.gameOver[2] / 2, 140);
      this.play_again_button.draw(e);
      this.main_menu_button.draw(e);
    }

    // ---- main loop pieces ----
    handle_events() {
      for (const ev of this.engine.getEvents()) {
        if (this.main_menu) {
          this.play_button.handle_events(ev);
          this.options_button.handle_events(ev);
          if (this.options_menu) this.main_menu_button.handle_events(ev);
        } else if (this.play_game) {
          this.pause_button.handle_events(ev);
          this.resume_button.handle_events(ev);
          this.player.handle_events(ev);
          for (const p of this.platforms) p.handle_events(ev);
        } else if (this.end_game) {
          this.play_again_button.handle_events(ev);
          this.main_menu_button.handle_events(ev);
        }
      }
    }

    update() {
      if (this.main_menu) {
        this.player.update();
        for (const p of this.platforms) p.update();
        for (const u of this.UFOs) u.update();
        this.play_button.update();
        this.options_button.update();
        if (this.options_menu) this.main_menu_button.update();
      } else if (this.play_game) {
        this.generate_random_tile();
        this.generate_random_enemy();
        for (const b of this.bullets) b.update();
        for (const p of this.platforms) p.update();
        this.player.update();
        for (const m of this.monsters) m.update();
        for (const b of this.blackholes) b.update();
        for (const u of this.UFOs) u.update();
        this.prune();
      } else if (this.end_game) {
        this.play_again_button.update();
        this.main_menu_button.update();
      }
    }

    prune() {
      this.bullets = this.bullets.filter((s) => !s.killed);
      this.platforms = this.platforms.filter((s) => !s.killed);
      this.monsters = this.monsters.filter((s) => !s.killed);
      this.blackholes = this.blackholes.filter((s) => !s.killed);
      this.UFOs = this.UFOs.filter((s) => !s.killed);
    }

    draw(e) {
      e.blit(this.BACKGROUND_IMAGE, 0, 0);

      if (this.main_menu) {
        if (!this.options_menu) this.play_button.draw(e);
        this.options_button.draw(e);
        this.player.draw(e);
        for (const u of this.UFOs) u.draw(e);
        for (const p of this.platforms) p.draw(e);
        if (this.options_menu) this.main_menu_button.draw(e);
      }

      if (this.play_game) {
        for (const b of this.bullets) b.draw(e);
        this.player.draw(e);
        for (const p of this.platforms) p.draw(e);
        for (const en of this.allEnemies()) en.draw(e);
        this.draw_top(e);
      }

      if (this.end_game) {
        if (this.fade_out_alpha === 0) {
          this.play_game = false;
          this.draw_end_game_screen(e);
          this.stopAllSounds();
          this.persistHighScore();
        }
        if (this.fade_out_alpha !== 0) this.fade_out_alpha -= this.fade_out_speed;
        if (this.fade_out_alpha < 0) this.fade_out_alpha = 0;
        if (!this.player.dead_by_suction) {
          const bottom = A().bottom();
          if (bottom) e.blit(bottom, 0, this.SCREEN_HEIGHT - bottom.height);
        }
      }
    }

    stopAllSounds() {
      for (const m of this.monsters) if (m.sound) m.sound.pause();
      for (const u of this.UFOs) if (u.sound) u.sound.pause();
    }
    persistHighScore() {
      localStorage.setItem("DJ2_highscore", String(Math.floor(DJ.Player.high_score)));
    }

    step() {
      this.handle_events();
      this.update();
      this.draw(this.engine);
      this.frame += 1;
    }
  }

  DJ.Game = Game;

  // ---- bootstrap ----
  DJ.boot = function (canvas) {
    const engine = new DJ.Engine(canvas);
    const A0 = DJ.Assets;
    return Promise.all([A0.loadCommon(), A0.loadTheme(A0.fileName)]).then(() => {
      const game = new DJ.Game(engine);
      DJ.game = game;
      engine.run(() => {
        engine.beginFrame(game.BACKGROUND_IMAGE);
        game.step();
        engine.endFrame();
      });
      return game;
    });
  };
})(window.DJ = window.DJ || {});
