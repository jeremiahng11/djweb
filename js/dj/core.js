// Core engine: canvas, world->view scaling, 60fps loop, input, blit helpers.
(function (DJ) {
  const WORLD_W = 640, WORLD_H = 900;   // native Python game space (physics)
  const VIEW_W = 635, VIEW_H = 955;     // on-screen canvas (locked to current game)

  class Engine {
    constructor(canvas) {
      this.canvas = canvas;
      canvas.width = VIEW_W;
      canvas.height = VIEW_H;
      this.ctx = canvas.getContext("2d");
      this.WORLD_W = WORLD_W;
      this.WORLD_H = WORLD_H;

      // Fill the 635x955 canvas with the 640x900 world (cover, preserving
      // aspect). "max" leaves no top/bottom gaps; it crops a few px at the far
      // left/right edges, where no gameplay content sits.
      this.scale = Math.max(VIEW_W / WORLD_W, VIEW_H / WORLD_H);
      this.offsetX = (VIEW_W - WORLD_W * this.scale) / 2;
      this.offsetY = (VIEW_H - WORLD_H * this.scale) / 2;

      // Input state (pygame-style).
      this.events = [];            // drained each frame by game.handle_events
      this.keys = Object.create(null);
      this.mouseDown = false;
      this.mouse = { x: 0, y: 0 };

      // Device-orientation tilt (mobile): gamma = left/right tilt in degrees.
      this.tiltGamma = 0;
      this.tiltBeta = 0;
      this.tiltActive = false;
      this._tiltAsked = false;

      this._bindInput();
      this._alpha = 255;
    }

    _toWorld(clientX, clientY) {
      const r = this.canvas.getBoundingClientRect();
      const cx = (clientX - r.left) * (this.canvas.width / r.width);
      const cy = (clientY - r.top) * (this.canvas.height / r.height);
      return {
        x: (cx - this.offsetX) / this.scale,
        y: (cy - this.offsetY) / this.scale,
      };
    }

    _bindInput() {
      const KEYMAP = {
        ArrowLeft: "LEFT", ArrowRight: "RIGHT", ArrowUp: "UP",
        Space: "SPACE", KeyA: "LEFT", KeyD: "RIGHT", KeyW: "UP",
      };
      window.addEventListener("keydown", (e) => {
        const k = KEYMAP[e.code];
        if (!k) return;
        e.preventDefault();
        if (!this.keys[k]) this.events.push({ type: "KEYDOWN", key: k });
        this.keys[k] = true;
      });
      window.addEventListener("keyup", (e) => {
        const k = KEYMAP[e.code];
        if (k) this.keys[k] = false;
      });

      // Device tilt steering (mobile). iOS 13+ needs a permission prompt
      // triggered by a user gesture, so we ask on the first tap.
      const onTilt = (e) => {
        if (e.gamma == null) return;
        this.tiltActive = true;
        this.tiltGamma = e.gamma;
        this.tiltBeta = e.beta || 0;
      };
      window.addEventListener("deviceorientation", onTilt);
      const askTilt = () => {
        if (this._tiltAsked) return;
        this._tiltAsked = true;
        const D = window.DeviceOrientationEvent;
        if (D && typeof D.requestPermission === "function") {
          D.requestPermission().then((s) => {
            if (s === "granted") window.addEventListener("deviceorientation", onTilt);
          }).catch(() => {});
        }
      };

      const down = (cx, cy) => {
        askTilt();
        this.mouse = this._toWorld(cx, cy);
        this.mouseDown = true;
        this.events.push({ type: "MOUSEBUTTONDOWN", button: 1, pos: { ...this.mouse } });
      };
      const up = (cx, cy) => {
        if (cx != null) this.mouse = this._toWorld(cx, cy);
        this.mouseDown = false;
        this.events.push({ type: "MOUSEBUTTONUP", button: 1, pos: { ...this.mouse } });
      };
      const move = (cx, cy) => { this.mouse = this._toWorld(cx, cy); };

      this.canvas.addEventListener("mousedown", (e) => down(e.clientX, e.clientY));
      window.addEventListener("mouseup", (e) => up(e.clientX, e.clientY));
      window.addEventListener("mousemove", (e) => move(e.clientX, e.clientY));
      this.canvas.addEventListener("touchstart", (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        down(t.clientX, t.clientY);
      }, { passive: false });
      this.canvas.addEventListener("touchend", (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        up(t.clientX, t.clientY);
      }, { passive: false });
      this.canvas.addEventListener("touchmove", (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        move(t.clientX, t.clientY);
      }, { passive: false });
    }

    // pygame.event.get() — returns + clears queued events for this frame.
    getEvents() { const e = this.events; this.events = []; return e; }
    keyPressed(name) { return !!this.keys[name]; }
    mousePos() { return this.mouse; }

    // --- rendering ---
    // alpha: 0..255 (matches pygame set_alpha); used for fade-out.
    setAlpha(a) { this._alpha = a; this.ctx.globalAlpha = Math.max(0, Math.min(1, a / 255)); }
    resetAlpha() { this._alpha = 255; this.ctx.globalAlpha = 1; }

    blit(img, x, y, flipX = false) {
      if (!img) return;
      const ctx = this.ctx;
      if (flipX) {
        ctx.save();
        ctx.translate(x + img.width, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(img, x, y);
      }
    }

    // Draw a sub-rectangle [sx,sy,sw,sh] of a sheet at world (x,y).
    blitFrame(sheet, f, x, y, flipX = false) {
      if (!sheet) return;
      const ctx = this.ctx;
      const [sx, sy, sw, sh] = f;
      if (flipX) {
        ctx.save();
        ctx.translate(x + sw, y);
        ctx.scale(-1, 1);
        ctx.drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);
        ctx.restore();
      } else {
        ctx.drawImage(sheet, sx, sy, sw, sh, x, y, sw, sh);
      }
    }

    blitScaled(img, x, y, w, h) { if (img) this.ctx.drawImage(img, x, y, w, h); }

    // --- gameplay-scaled drawing (default DJ.GS; pass `s` to override, e.g.
    //     the player draws at DJ.PS so the doodler matches the classic ratio) ---
    gblit(img, x, y, flipX = false, s = DJ.GS) {
      if (!img) return;
      const ctx = this.ctx, w = img.width * s, h = img.height * s;
      if (flipX) {
        ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, w, h); ctx.restore();
      } else ctx.drawImage(img, x, y, w, h);
    }
    gframe(sheet, f, x, y, flipX = false, s = DJ.GS) {
      if (!sheet) return;
      const ctx = this.ctx, sx = f[0], sy = f[1], sw = f[2], sh = f[3];
      const w = sw * s, h = sh * s;
      if (flipX) {
        ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1);
        ctx.drawImage(sheet, sx, sy, sw, sh, 0, 0, w, h); ctx.restore();
      } else ctx.drawImage(sheet, sx, sy, sw, sh, x, y, w, h);
    }

    text(str, x, y, size, color, font = "DoodleJump", align = "left") {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.font = `${size}px ${font}, sans-serif`;
      ctx.textBaseline = "top";
      ctx.textAlign = align;
      ctx.fillText(str, x, y);
      ctx.restore();
    }

    // Begin a frame: clear, fill letterbox with a stretched background, then
    // switch into world coordinates for the game's own drawing.
    beginFrame(bgImg) {
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);
      if (bgImg) ctx.drawImage(bgImg, 0, 0, VIEW_W, VIEW_H);
      ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
      ctx.globalAlpha = 1;
    }
    endFrame() {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.globalAlpha = 1;
    }

    // 60fps-gated loop. stepFn runs one Python-equivalent frame.
    run(stepFn) {
      let last = 0;
      const MIN = 1000 / 60 - 1.5;
      const loop = (t) => {
        requestAnimationFrame(loop);
        if (t - last < MIN) return;
        last = t;
        stepFn();
      };
      requestAnimationFrame(loop);
    }
  }

  DJ.Engine = Engine;
})(window.DJ = window.DJ || {});
