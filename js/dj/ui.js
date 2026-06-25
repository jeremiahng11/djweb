// UI buttons + skin checkboxes — ported from Buttons/*.py
(function (DJ) {
  const A = () => DJ.Assets;

  class PlayButton {
    constructor(game) {
      this.game = game;
      this.image = A().img("Buttons/play.png");
      this.hover_image = A().img("Buttons/play_hover.png");
      this.rect = new DJ.Rect(100, 200, 222, 80);
      this.hovering = false; this.clicked = false; this.hide = false;
    }
    handle_events(ev) {
      if (this.hide) return;
      const m = this.game.engine.mousePos();
      if (ev.type === "MOUSEBUTTONDOWN" && ev.button === 1) {
        if (this.rect.collidepoint(ev.pos.x, ev.pos.y)) this.clicked = true;
      } else if (ev.type === "MOUSEBUTTONUP" && ev.button === 1 && this.clicked) {
        this.clicked = false; this.hide = true;
        this.game.main_menu = false; this.game.play_game = true;
        this.game.BACKGROUND_IMAGE = A().background();
        if (this.game.UFOs[0]) this.game.UFOs[0].remove();
        this.game.initialise_game_weights();
        this.game.initialise_game_objects();
        A().play("button");
      }
    }
    update() { this.hovering = this.rect.collidepoint(this.game.engine.mouse.x, this.game.engine.mouse.y); }
    draw(e) { if (!this.hide) e.blit(this.hovering ? this.hover_image : this.image, this.rect.x, this.rect.y); }
  }

  class Checkbox {
    constructor(game, xm, ym, name) {
      this.game = game; this.name = name;
      this.width = 40; this.height = 40;
      this.x = ((640 - this.width) / 2) * xm;
      this.y = ((900 - this.height) / 2) * ym;
      this.rect = new DJ.Rect(this.x, this.y, this.width, this.height);
      this.checked = name === A().fileName;
    }
    draw(e) {
      const ctx = e.ctx;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "black"; ctx.lineWidth = 2;
      ctx.strokeRect(this.x, this.y, this.width, this.height);
      ctx.restore();
      e.text(this.name.charAt(0).toUpperCase() + this.name.slice(1), this.x + 52, this.y + 4, 32, "black");
      if (this.checked) {
        ctx.save();
        ctx.strokeStyle = "rgb(0,255,0)"; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y); ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.moveTo(this.x + this.width, this.y); ctx.lineTo(this.x, this.y + this.height);
        ctx.stroke();
        ctx.restore();
      }
    }
    toggle() { this.checked = !this.checked; }
    handle_events(ev, all) {
      if (this.checked) return;
      if (ev.type === "MOUSEBUTTONDOWN" && ev.button === 1 && this.rect.collidepoint(ev.pos.x, ev.pos.y)) {
        for (const c of all) if (c.checked && c !== this) c.toggle();
        this.toggle();
        A().play("button");
        this.game.changeTheme(this.name);
      }
    }
  }

  class OptionButton {
    constructor(game) {
      this.game = game;
      this.image = A().img("Buttons/options.png");
      this.hover_image = A().img("Buttons/options_hover.png");
      this.TITLE = A().img("Backgrounds/options_title.png");
      this.rect = new DJ.Rect(100, 300, 224, 80);
      this.hovering = false; this.clicked = false; this.hide = false;
      const ths = A().THEMES;
      // y multipliers 0.7 .. 1.7
      this.checkboxes = ths.map((n, i) => new Checkbox(game, 0.8, 0.7 + i * 0.1, n));
    }
    handle_events(ev) {
      if (!this.hide) {
        if (ev.type === "MOUSEBUTTONDOWN" && ev.button === 1) {
          if (this.rect.collidepoint(ev.pos.x, ev.pos.y)) this.clicked = true;
        } else if (ev.type === "MOUSEBUTTONUP" && ev.button === 1 && this.clicked) {
          this.game.BACKGROUND_IMAGE = A().img("Backgrounds/options.png");
          this.game.options_menu = true;
          this.game.play_button.hide = true;
          this.clicked = false; this.hide = true;
        }
      } else {
        for (const c of this.checkboxes) c.handle_events(ev, this.checkboxes);
      }
    }
    update() { this.hovering = this.rect.collidepoint(this.game.engine.mouse.x, this.game.engine.mouse.y); }
    draw(e) {
      if (!this.hide) {
        e.blit(this.hovering ? this.hover_image : this.image, this.rect.x, this.rect.y);
      } else {
        e.blit(this.game.BACKGROUND_IMAGE, 0, 0);
        e.blit(this.TITLE, 0, 0);
        for (const c of this.checkboxes) c.draw(e);
      }
    }
  }

  class MenuButton {
    constructor(game, opts = {}) {
      this.game = game;
      this.frame = A().UI_FRAMES.menuBtn;
      this.hover_image = A().img("Buttons/menu_hover.png");
      const w = this.frame[2], h = this.frame[3];
      let x = opts.x, y = opts.y;
      const xm = opts.x_multiplier || 1, ym = opts.y_multiplier || 1;
      if (x == null) x = (640 - w) / 2;
      if (y == null) y = (900 - h) / 2;
      this.rect = new DJ.Rect(x * xm, y * ym, w, h);
      this.hovering = false; this.clicked = false; this.hide = false;
    }
    handle_events(ev) {
      if (this.hide) return;
      if (ev.type === "MOUSEBUTTONDOWN" && ev.button === 1) {
        if (this.rect.collidepoint(ev.pos.x, ev.pos.y)) this.clicked = true;
      } else if (ev.type === "MOUSEBUTTONUP" && ev.button === 1 && this.clicked) {
        this.clicked = false; this.hide = true;
        this.game.BACKGROUND_IMAGE = A().img("Backgrounds/main_menu.png");
        this.game.main_menu = true; this.game.options_menu = false;
        this.game.play_game = false; this.game.end_game = false;
        this.game.fade_out_alpha = 255;
        this.game.clear_all_sprites();
        this.game.initialise_main_menu_objects();
        A().play("button");
      }
    }
    update() { this.hovering = this.rect.collidepoint(this.game.engine.mouse.x, this.game.engine.mouse.y); }
    draw(e) {
      if (this.hide) return;
      if (this.hovering) e.blit(this.hover_image, this.rect.x, this.rect.y);
      else e.blitFrame(A().img("start-end-tiles.png"), this.frame, this.rect.x, this.rect.y);
    }
  }

  class PauseButton {
    constructor(game) {
      this.game = game; this.player = game.player;
      this.image = A().img("Buttons/pause.png");
      this.rect = new DJ.Rect(0, 0, 36, 35);
      this.rect.x = game.SCREEN_WIDTH - this.rect.width - 30;
      this.rect.y = 15;
      this.clicked = false; this.hide = false;
    }
    handle_events(ev) {
      if (this.hide || this.game.end_game) return;
      if (ev.type === "MOUSEBUTTONDOWN" && ev.button === 1) {
        if (this.rect.collidepoint(ev.pos.x, ev.pos.y)) {
          this.player.prior_y_velocity = this.player.velocity_y;
          this.player.velocity_y = 0; this.game.player.paused = true;
          for (const m of this.game.monsters) { m.pause(); if (m.sound) m.sound.pause(); }
          for (const u of this.game.UFOs) { u.paused = true; if (u.sound) u.sound.pause(); }
          this.clicked = true;
        }
      } else if (ev.type === "MOUSEBUTTONUP" && ev.button === 1 && this.clicked) {
        this.game.resume_button.hide = false; this.hide = true; this.clicked = false; A().play("button");
      }
    }
    draw(e) { if (!this.hide) e.blit(this.image, this.rect.x, this.rect.y); }
  }

  class ResumeButton extends PauseButton {
    constructor(game) {
      super(game);
      this.image = A().img("Buttons/resume.png");
      this.pause_screen = A().img("Backgrounds/pause_screen.png");
      this.hide = true;
    }
    handle_events(ev) {
      if (this.hide || this.game.end_game) return;
      if (ev.type === "MOUSEBUTTONDOWN" && ev.button === 1) {
        if (this.rect.collidepoint(ev.pos.x, ev.pos.y)) this.clicked = true;
      } else if (ev.type === "MOUSEBUTTONUP" && ev.button === 1 && this.clicked) {
        this.game.player.velocity_y = this.player.prior_y_velocity;
        this.game.player.paused = false; this.game.player.handling_events = true;
        for (const m of this.game.monsters) { m.unpause(); if (m.sound) m.sound.play().catch(()=>{}); }
        for (const u of this.game.UFOs) { u.paused = false; if (u.sound) u.sound.play().catch(()=>{}); }
        this.hide = true; this.clicked = false;
        this.game.pause_button.hide = false; A().play("button");
      }
    }
    draw(e) {
      if (!this.hide) { e.blit(this.image, this.rect.x, this.rect.y); e.blit(this.pause_screen, 0, 0); }
    }
  }

  class PlayAgain {
    constructor(game) {
      this.game = game;
      this.frame = A().UI_FRAMES.playAgainBtn;
      this.hover_image = A().img("Buttons/play_again_hover.png");
      const w = this.frame[2], h = this.frame[3];
      const x = (640 - w) / 2, y = (900 - h) / 2;
      this.rect = new DJ.Rect(x * 0.25, y * 1.5, w, h);
      this.hovering = false; this.clicked = false; this.hide = false;
    }
    handle_events(ev) {
      if (this.hide) return;
      if (ev.type === "MOUSEBUTTONDOWN" && ev.button === 1) {
        if (this.rect.collidepoint(ev.pos.x, ev.pos.y)) this.clicked = true;
      } else if (ev.type === "MOUSEBUTTONUP" && ev.button === 1 && this.clicked) {
        this.clicked = false; this.hide = true;
        this.game.main_menu = false; this.game.play_game = true; this.game.end_game = false;
        this.game.initialise_game_weights();
        this.game.initialise_game_objects();
        this.game.fade_out_alpha = 255;
        A().play("button");
      }
    }
    update() { this.hovering = this.rect.collidepoint(this.game.engine.mouse.x, this.game.engine.mouse.y); }
    draw(e) {
      if (this.hide) return;
      if (this.hovering) e.blit(this.hover_image, this.rect.x, this.rect.y);
      else e.blitFrame(A().img("start-end-tiles.png"), this.frame, this.rect.x, this.rect.y);
    }
  }

  DJ.UI = { PlayButton, OptionButton, MenuButton, PauseButton, ResumeButton, PlayAgain, Checkbox };
})(window.DJ = window.DJ || {});
