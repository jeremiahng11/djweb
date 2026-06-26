// Theme support for the CLASSIC game (loaded before classic.themed.js).
// Themes swap: in-game + menu background, the doodler (per-theme 4-frame sheet,
// optionally a selected "suit" variant), its nose, and the projectile.
// Classic gameplay, physics and menu layout are otherwise untouched.
var Doodle = Doodle || {};

// Surface a real error message on-screen / console (try/catch beats the masked
// "Script error." you get from window.onerror on file://).
Doodle._show = function (m) {
  try { var d = document.getElementById("err"); if (d) { d.style.display = "block"; d.textContent += m + "\n"; } } catch (e) {}
  try { console.error(m); } catch (e) {}
};

// Per-theme data (sourced from static/images/Playerfull via the build script):
//   nose : ships its own nose; false -> use the default liknjuska nose.
//   proj : ships a themed projectile (static/images/Projectiles/<t>.png).
//   suits: selectable doodler variants.
Doodle.THEME_DATA = {
  jungle:      { nose: true,  proj: true,  top: true,  suits: [] },
  space:       { nose: false, proj: true,  top: true,  plat: true, mon: true, prop: true, jet: true, rocket: true, comet: true, planet: true, strip: true, suits: [] },
  ghost:       { nose: true,  proj: true,  top: false, suits: [] },
  ice:         { nose: true,  proj: true,  top: false, suits: [] },
  bunny:       { nose: false, proj: true,  top: true,  suits: [] },
  doodlestein: { nose: true,  proj: true,  top: true,  suits: ["bat","bride","cat","clown","hunchback","mummy","pirate","pumpkin","ragdoll","vampire","werewolf","witch","zombie"] },
  soccer:      { nose: false, proj: true,  top: true,  suits: ["argentina","australia","brazil","croatia","england","france","germany","iran","italy","japan","mexico","original","portugal","russia","southkorea","spain","uruguay","usa"] },
  underwater:  { nose: false, proj: true,  top: true,  suits: [] },
  snow:        { nose: true,  proj: true,  top: true,  suits: [] },
  ninja:       { nose: false, proj: false, top: true,  suits: ["doublejumper","shadow","sugegasa","sumo"] },
  pirate:      { nose: true,  proj: false, top: true,  suits: ["pirates-cabin-boy","pirates-first-mate","pirates-sailor","pirates-second-mate"] },
  "8bit":      { nose: true,  proj: false, top: false, suits: [] },
};
// Full roadmap of themes (assets exist but per-theme data isn't finished for most -> they blank in-game).
Doodle.ALL_THEMES = ["default", "jungle", "space", "ghost", "ice", "bunny",
  "doodlestein", "soccer", "underwater", "snow", "ninja", "pirate", "8bit"];
// LIVE themes only: what the slider offers + what's playable. Add a theme here once it's fully built + tested.
Doodle.THEMES = ["default", "space"];

Doodle.getTheme = function () {
  var t = localStorage.getItem("DJ_theme") || "default";
  return Doodle.THEMES.indexOf(t) === -1 ? "default" : t;
};
Doodle.setTheme = function (t) { localStorage.setItem("DJ_theme", t); };

// Selected suit for a theme ("" = base doodler).
Doodle.getSuit = function (t) {
  t = t || Doodle.getTheme();
  var d = Doodle.THEME_DATA[t];
  if (!d || !d.suits.length) return "";
  var s = localStorage.getItem("DJ_suit_" + t) || "";
  return d.suits.indexOf(s) === -1 ? "" : s;
};
Doodle.setSuit = function (t, s) { localStorage.setItem("DJ_suit_" + t, s || ""); };

Doodle._bgPath = function (t) { return "static/images/Backgrounds/Backgrounds/" + t + ".png"; };

// True only if a spritesheet decoded with at least `min` real frames. Guards
// against browsers (Safari) that fail to decode a PNG -> 0 frames -> the Phaser
// animation crashes on `currentFrame.index`. When false we fall back to classic.
Doodle._sheetOK = function (game, key, min) {
  try {
    if (!game.cache.checkImageKey(key)) return false;
    var n = game.cache.getFrameCount(key);
    return !!n && n >= (min || 1);
  } catch (e) { return false; }
};
// True if a plain image decoded with real pixels.
Doodle._imgOK = function (game, key) {
  try {
    if (!game.cache.checkImageKey(key)) return false;
    var im = game.cache.getImage(key, true);
    return !!(im && (im.width || (im.base && im.base.width)));
  } catch (e) { return false; }
};

// ---- texture keys ----
Doodle.playerKey = function () {
  try {
    // multiplayer: your chosen character overrides the theme's doodler (its sheet is loaded at race start)
    if (Doodle.MP && Doodle.MP.active && Doodle.MP.myCharacter) {
      var mc = Doodle.MP.myCharacter;
      if (mc === "default") return "player0";
      var mk = "pl_" + mc;
      if (Doodle.game && Doodle._sheetOK(Doodle.game, mk, 1)) return mk;
    }
    var t = Doodle.getTheme();
    if (t === "default") return "player0";
    var suit = Doodle.getSuit(t);
    if (suit && Doodle._sheetOK(Doodle.game, "pl_" + t + "__" + suit, 1)) return "pl_" + t + "__" + suit;
    var k = "pl_" + t;
    if (Doodle.game && Doodle._sheetOK(Doodle.game, k, 1)) return k;
    return "player0";
  } catch (e) { Doodle._show("playerKey: " + e.message); return "player0"; }
};

// Nose key: themed nose where the theme ships one, else the default liknjuska.
Doodle.noseKey = function () {
  var t = Doodle.getTheme();
  var d = Doodle.THEME_DATA[t];
  return (d && d.nose) ? "nose_" + t : "nose_default";
};

// Rotate the space beam to follow the shot direction (vertical/up at velx=0).
Doodle.aimBullet = function (bullet, velx) {
  try {
    if (!bullet) return;
    var t = Doodle.getTheme(), d = Doodle.THEME_DATA[t];
    if (d && d.proj && t === "space") {
      bullet.angle = Math.atan2(velx, 1920) * 180 / Math.PI; // beam tips toward the aim, straight up when not aiming
    } else if (bullet.angle) {
      bullet.angle = 0;
    }
  } catch (e) {}
};

// Themed projectile image key, or null to use the classic atlas "bullet".
Doodle.bulletKey = function () {
  try {
    var t = Doodle.getTheme();
    var d = Doodle.THEME_DATA[t];
    if (!d || !d.proj) return null;
    var k = "proj_" + t;
    if (Doodle.game && Doodle.game.cache && Doodle.game.cache.checkImageKey(k)) return k;
  } catch (e) { Doodle._show("bulletKey: " + e.message); }
  return null;
};

// Build the trunk (nose) sprite for the current theme.
Doodle.makeTrunk = function (game) {
  try {
    if (Doodle.getTheme() === "default") return new Phaser.Sprite(game, 0, 0, "atlas", "trunk");
    var nk = Doodle.noseKey();
    if (game.cache.checkImageKey(nk)) return new Phaser.Sprite(game, 0, 0, nk);
  } catch (e) { Doodle._show("makeTrunk: " + e.message); }
  return new Phaser.Sprite(game, 0, 0, "atlas", "trunk");
};

// Preload EVERY theme's assets up front so switching is an instant loadTexture
// (no runtime loader calls, which can stall Phaser mid-state).
Doodle.loadThemeAssets = function (game) {
  try {
    game.load.image("nose_default", "static/images/PlayerSheets/nose_default.png");
    game.load.image("menuOverlay", "static/images/menu_overlay.png");
    game.load.image("menuTitle", "static/images/menu_title.png");
    Doodle.THEMES.forEach(function (th) {
      if (th === "default") return;
      var d = Doodle.THEME_DATA[th];
      game.load.image("djbg_" + th, Doodle._bgPath(th));
      game.load.spritesheet("pl_" + th, "static/images/PlayerSheets/" + th + ".png", 124, 120, 4);
      if (d && d.nose) game.load.image("nose_" + th, "static/images/PlayerSheets/nose_" + th + ".png");
      if (d && d.proj) game.load.image("proj_" + th, "static/images/Projectiles/" + th + ".png");
      if (d && d.top) game.load.image("top_" + th, "static/images/Tops/" + th + ".png");
      if (d && d.plat) {
        game.load.image("plat_" + th + "_0", "static/images/PlatformTiles/" + th + "_0.png");
        game.load.spritesheet("platbreak_" + th, "static/images/PlatformTiles/" + th + "_break.png", 120, 58, 4);
      }
      if (d && d.mon) {
        [7, 8, 9, 11].forEach(function (ty) {
          game.load.image("mon_" + th + "_" + ty, "static/images/MonsterTiles/" + th + "_" + ty + ".png");
        });
        game.load.spritesheet("ufo_" + th, "static/images/ObstacleTiles/" + th + "_ufo.png", 158, 244, 2);
        game.load.image("bh_" + th, "static/images/ObstacleTiles/" + th + "_bh.png");
      }
      if (d && d.prop) {
        game.load.image("prop_" + th, "static/images/PowerTiles/" + th + "_prop.png");                       // static pickup (platform)
        game.load.spritesheet("propfly_" + th, "static/images/PowerTiles/" + th + "_prop_fly.png", 64, 64, 4); // spinning worn animation
      }
      if (d && d.jet) {
        game.load.image("jetpick_" + th, "static/images/PowerTiles/" + th + "_jetpack.png");                 // twin-rocket pickup (platform only)
        game.load.spritesheet("jet_" + th, "static/images/PowerTiles/" + th + "_jetpack_fly.png", 64, 128, 10); // worn flight animation
      }
      if (d && d.rocket) {
        game.load.spritesheet("rocket_" + th, "static/images/PowerTiles/" + th + "_rocket.png", 144, 336, 9);
        game.load.image("rocketpick_" + th, "static/images/PowerTiles/" + th + "_rocket_pickup.png");
      }
      if (d && d.comet) game.load.spritesheet("comet_" + th, "static/images/PowerTiles/" + th + "_comet.png", 28, 149, 3);
      if (d && d.planet) {
        for (var pi = 0; pi < 10; pi++) // ALL 10 planets from the tile set, used as side bodies
          game.load.image("pf_" + th + "_" + pi, "static/images/PlanetTiles/full_" + pi + ".png");
      }
      // menu chrome + ALL theme-slider previews (the menu's drag slider cycles every theme)
      game.load.image("menutorn", "static/images/themeslider/menu_tornpaper.png");
      game.load.image("mainmenu", "static/images/Backgrounds/menu_tiled.png");
      game.load.image("linedbg", "static/images/Backgrounds/linedbg.png"); // plain tall lined paper to fill sub-screens (scores/options) full-height
      if (Doodle.API_URL) { // multiplayer button states (online only)
        game.load.image("mpbtn", "static/images/Buttons/multiplayer@2x.png");
        game.load.image("mpbtn_on", "static/images/Buttons/multiplayer-on@2x.png");
        game.load.image("mpbtn_conn", "static/images/Buttons/multiplayer-connecting@2x.png");
      }
      Doodle.THEMES.forEach(function (_tm) {
        var _pn = ({ "default": "original", snow: "winter", doodlestein: "halloween" })[_tm] || _tm;
        game.load.image("themestrip_" + _tm, "static/images/themeslider/theme_" + _pn + "_X.png");
      });
      if (d) d.suits.forEach(function (s) {
        game.load.spritesheet("pl_" + th + "__" + s, "static/images/PlayerSheets/" + th + "__" + s + ".png", 124, 120, 4);
      });
    });
  } catch (e) { Doodle._show("loadThemeAssets: " + e.message); }
};

// ---- backgrounds ----
Doodle.applyMenuBg = function (state) {
  Doodle.setPageBgScene(Doodle.themeBottomColor()); // home-indicator strip shows the slider scene continuing down
  try {
    var t = Doodle.getTheme();
    // (tiled menu + theme slider show for EVERY theme so you can always drag the slider to change it)
    // swap the menu background to the tiled menu art
    if (state.bgMenu && Doodle._imgOK(state.game, "mainmenu")) { state.bgMenu.loadTexture("mainmenu"); state.bgMenu.width = 640; state.bgMenu.height = 1800; } // tall NATIVE-scale lined paper (no stretch); bottom crops off on shorter screens
    // play the UFO warning sound once when the themed menu loads
    // UFO sound AUTOPLAYS on menu load: try to resume the (possibly suspended) audio context, then play.
    // Stopped on leaving the menu so a queued play can't bleed into the game start.
    if (t === "space") try {
      var _sm = state.game.sound;
      if (_sm && _sm.context && _sm.context.state === "suspended" && _sm.context.resume) _sm.context.resume();
      if (!state._ufoPlayed && _sm && !_sm.noAudio) {
        state._ufoPlayed = true;
        var _uw = state.add.audio("ufo_warning");
        if (_uw) {
          _uw.play();
          if (state.game.state && state.game.state.onStateChange)
            state.game.state.onStateChange.addOnce(function () { try { _uw.stop(); } catch (e) {} });
        }
      }
    } catch (eu) {}
    // Keep the lined-paper menu (title, decorations, torn-paper bottom are baked into the bg);
    // only the doodler + UFO are themed (set up elsewhere). Here we tuck the themed preview slider
    // BEHIND the torn-paper bottom edge so it peeks out, like classic Doodle Jump.
    if (Doodle._imgOK(state.game, "themestrip_" + t)) {
      var TH = Doodle.THEMES, curIdx = TH.indexOf(t); if (curIdx < 0) curIdx = 0;
      var _SH = 190, _H = state.game.height, _SY = _H - _SH; // TALLER slider flush to the bottom edge (space scene reaches the edge like the original)
      // CAROUSEL: every theme's preview laid out in a row, the current one centered.
      // Drag the slider left/right -> the neighbouring themes slide in (you see what you're picking).
      var strip = state.add.group();
      TH.forEach(function (thm, i) {
        var key = "themestrip_" + thm;
        if (!Doodle._imgOK(state.game, key)) return;
        var sp = strip.create(i * 640, _SY, key); sp.width = 640; sp.height = _SH;
      });
      strip.x = -curIdx * 640;
      if (Doodle._imgOK(state.game, "menutorn")) {
        var _tn = state.add.sprite(0, _SY - 13, "menutorn"); _tn.width = 640; _tn.height = 82;   // torn-paper edge stays fixed; previews slide under it
      }
      // invisible drag handle on top; moving it scrolls the strip, releasing snaps to a theme
      var hit = state.add.sprite(0, _SY, "themestrip_" + t);
      hit.width = 640; hit.height = _SH; hit.alpha = 0;
      hit.inputEnabled = true; hit.input.enableDrag(); hit.input.allowVerticalDrag = false;
      var _minX = -(TH.length - 1) * 640;
      var _dStartX = strip.x, _hStartX = 0, _startIdx = curIdx, _vel = 0, _vPrevX = strip.x, _vPrevT = 0;
      hit.events.onDragStart.add(function () {
        if (state._stripTween && state._stripTween.isRunning) state._stripTween.stop();
        _dStartX = strip.x; _hStartX = hit.x; _startIdx = Math.round(-strip.x / 640);
        _vel = 0; _vPrevX = strip.x; _vPrevT = state.game.time.now;
      });
      hit.events.onDragUpdate.add(function () {
        var x = _dStartX + (hit.x - _hStartX); if (x > 0) x = 0; if (x < _minX) x = _minX; strip.x = x;
        var now = state.game.time.now, dt = now - _vPrevT;
        if (dt > 0) { _vel = (x - _vPrevX) / dt; _vPrevX = x; _vPrevT = now; }
      });
      hit.events.onDragStop.add(function () {
        var idx;
        if (Math.abs(_vel) > 0.45) idx = _vel < 0 ? _startIdx + 1 : _startIdx - 1; // FLICK: a quick push+release advances one in that direction (even if < 50%)
        else idx = Math.round(-strip.x / 640);                                      // SLOW drag: nearest panel -> >=50% advances, <50% slides back
        if (idx < 0) idx = 0; if (idx > TH.length - 1) idx = TH.length - 1;
        // SMOOTH slide-to-snap (eased tween, no instant jump)
        state._stripTween = state.add.tween(strip).to({ x: -idx * 640 }, 260, Phaser.Easing.Sinusoidal.Out, true);
        hit.x = 0;
        if (TH[idx] !== Doodle.getTheme()) {
          Doodle.setTheme(TH[idx]);
          // DEFER the (heavy) asset load until swiping settles, so the swipe itself stays buttery — no mid-swipe hitch.
          // Debounced: rapid swipes only load the final theme. Then re-skin the menu in place (no page reload / blink).
          if (state._themeLoadT) clearTimeout(state._themeLoadT);
          state._themeLoadT = setTimeout(function () {
            try {
              var g = state.game;
              Doodle.loadThemeAssets(g);
              g.load.onLoadComplete.addOnce(function () {
                try {
                  if (state.player && state.player.loadTexture) { state.player.loadTexture(Doodle.playerKey()); state.player.frame = 0; }
                  if (Doodle.applyMenuDecor) Doodle.applyMenuDecor(state);
                  Doodle.setPageBgScene(Doodle.themeBottomColor()); // strip follows the newly-selected theme's scene
                } catch (e2) {}
              });
              g.load.start();
            } catch (e1) {}
          }, 550);
        }
      });
    }
  } catch (e) { Doodle._show("applyMenuBg: " + e.message); }
};

// Swap a platform's texture to the theme's tile (types 0/1/3 -> normal, 2 -> breakable).
Doodle.applyPlatTexture = function (p) {
  try {
    var t = Doodle.getTheme();
    if (t === "default" || !p) return;
    if (p.type === 2) {
      var bk = "platbreak_" + t;
      if (!Doodle._sheetOK(p.game, bk, 4)) return;
      p.loadTexture(bk); p.frame = 0; p.anchor.setTo(0.5, 0);
      if (p.body) p.body.setSize(110, 22, 5, 0); // collide only on the top platform surface
    } else {
      var key = "plat_" + t + "_0";
      if (!Doodle._imgOK(p.game, key)) return;
      p.loadTexture(key); p.anchor.setTo(0.5, 0);
      p.width = 114; p.height = 30;
      if (p.body) p.body.setSize(p.width, p.height, 0, 0);
    }
  } catch (e) { Doodle._show("applyPlatTexture: " + e.message); }
};

// Theme-aware breakable break animation (themed spritesheet frames, else classic atlas).
Doodle.breakAnim = function (b) {
  try {
    var t = Doodle.getTheme();
    if (t !== "default" && Doodle._sheetOK(b.game, "platbreak_" + t, 4)) {
      b.animations.add("breake", [0, 1, 2, 3], 24, false); b.play("breake"); return;
    }
    b.animations.add("breake", ["atlas", "platform2", "platformSheet_02", "platformSheet_03", "platformSheet_04"], 24, false);
    b.play("breake");
  } catch (e) { Doodle._show("applyPlatTexture: " + e.message); }
};

// Swap an obstacle's texture to the theme's tile. Monsters 7/8/9/11, plus the
// black hole (4) and UFO/spaceship (6). Keeps a full body so collision still
// kills the doodler, and stops the UFO beam animation (themed UFO is static).
Doodle.applyObsTexture = function (o) {
  try {
    var t = Doodle.getTheme();
    if (t === "default" || !o) return;
    var ty = +o.type; // type can arrive as a string (e.g. the menu UFO is "6")
    if ([7, 8, 9, 11].indexOf(ty) !== -1) {
      // monster tiles are pre-sized to the classic frame, so the body the engine
      // already set still fits -> touch-kill and bullet-kill work unchanged.
      var mk = "mon_" + t + "_" + ty;
      if (Doodle._imgOK(o.game, mk)) o.loadTexture(mk);
      return;
    }
    if (ty === 6) { // UFO/spaceship: animated beam, touch = death
      var uk = "ufo_" + t;
      if (!Doodle._sheetOK(o.game, uk, 2)) return; // bad/undecoded sheet -> keep classic UFO
      if (o.animations) o.animations.stop();
      o.loadTexture(uk);
      o.animations.add("tbeam", [0, 1], 6, true); o.play("tbeam");
      if (o.body) o.body.setSize(112, 110, (o.width - 112) / 2, 8);
      return;
    }
    if (ty === 4) { // black hole, touch = suck-in death
      var bk = "bh_" + t;
      if (!Doodle._imgOK(o.game, bk)) return;
      o.loadTexture(bk);
      if (o.body) o.body.setSize(o.width * 0.7, o.height * 0.7, o.width * 0.15, o.height * 0.15);
      return;
    }
  } catch (e) { Doodle._show("applyObsTexture: " + e.message); }
};

// Theme the bonus PICKUP sitting on a platform (jetpack=bonus2, propeller=bonus3).
Doodle.applyBonusPickup = function (b, c) {
  try {
    var t = Doodle.getTheme();
    if (t === "default") return;
    // native (actual) tile size; anchor (.5,1) is set in Bonus.reset so the tight-trimmed
    // image sits edge-to-edge on the platform (no transparent padding -> no float).
    if (c === "bonus3" && Doodle._imgOK(b.game, "prop_" + t)) {
      b.loadTexture("prop_" + t);
    } else if (c === "bonus2" && Doodle._imgOK(b.game, "jetpick_" + t)) {
      b.loadTexture("jetpick_" + t); // twin-rocket pickup; sits centered on the platform (anchor .5,1 from reset)
    }
  } catch (e) { Doodle._show("applyBonusPickup: " + e.message); }
};

// Theme the in-flight jetpack (child on the player's back). Returns true if themed.
Doodle.jetAnim = function (a, b) {
  try {
    var t = Doodle.getTheme();
    if (t !== "default" && Doodle._sheetOK(b.game, "jet_" + t, 10)) {
      b.loadTexture("jet_" + t); b.frame = 0;
      b.anchor.setTo(0.5, 1); b.width = 64; b.height = 128; b.x = 46; b.y = 100; // full-size worn jetpack pushed out to the back, flame below
      b.animations.add("anim0", [0, 1, 2, 3], 24, true);
      b.animations.add("anim1", [4, 5, 6, 7], 24, true);
      b.animations.add("anim2", [8, 9], 12, true);
      b.play("anim0"); return true;
    }
  } catch (e) { Doodle._show("jetAnim: " + e.message); }
  return false;
};

// Theme-aware in-flight propeller animation (themed spritesheet, else classic atlas).
Doodle.propAnim = function (b) {
  try {
    var t = Doodle.getTheme();
    if (t !== "default" && Doodle._sheetOK(b.game, "propfly_" + t, 4)) {
      b.loadTexture("propfly_" + t); b.frame = 0;
      b.anchor.setTo(0.5, 1); b.x = 0; b.y = -1; // spinning dome seated on the helmet — worn like a propeller hat
      b.animations.add("prop", [0, 1, 2, 3], 18, true); b.play("prop");
      return;
    }
  } catch (e) { Doodle._show("propAnim: " + e.message); }
  b.animations.add("prop", ["atlas", "propeller_03", "propeller_02", "propeller_04"], 24, true); b.play("prop");
};

// ROCKET — a new, rare power-up (space only for now). Jetpack-style flight but
// longer (~5.5s, the furthest), the doodler-in-rocket visual, and rocket.ogg.
// Spawned 2-4 times per game from loadLevel; activated via bonusActivate.
Doodle.maybeRocket = function (gs, platform) {
  try {
    if (Doodle.getTheme() !== "space" || !platform) return;
    if (gs.score < 50) gs._rocketCount = 0;            // reset each new game
    if (platform.hasBonusObject !== -1) return;
    if (gs._rocketCount >= 4) return;
    if (Math.random() > 0.006) return;                 // rare
    var th = Doodle.getTheme();
    if (!Doodle._imgOK(gs.game, "rocketpick_" + th)) return;
    var b = gs.bonusPool.getFirstExists(false);
    if (b) b.reset(platform.x, platform.top + 5, "bonus2", platform, gs.score);
    else { b = new Doodle.Bonus(gs.game, platform.x, platform.top + 5, "bonus2", platform, gs.score, gs.sounds, gs.stats); gs.bonusPool.add(b); }
    b.isRocket = true;
    b.loadTexture("rocketpick_" + th);
    b.width = 144; b.height = 206; b.anchor.setTo(0.5, 1); // EXACTLY the flying rocket's body size (so it never changes size pickup->fly->empty)
    if (b.body) b.body.setSize(b.width, b.height, 0, 0);
    platform.hasBonusObject = 9;
    gs._rocketCount = (gs._rocketCount || 0) + 1;
  } catch (e) { Doodle._show("maybeRocket: " + e.message); }
};

Doodle.activateRocket = function (a, b, gs) {
  try {
    if (b.used || a.withBonus) return; // only one flying power-up at a time
    b.used = true;
    a.withBonus = true; a.bonusType = 2;          // claim the doodler now (no death / no second pickup)
    a.isRocketRide = true;                        // distinguishes the rocket from the jetpack (both bonusType 2) for the achievement
    a._boarding = true;                           // freeze world scroll so the rocket stays put while boarding
    a._rkPrevKey = Doodle.playerKey();
    var th = Doodle.getTheme(), g = a.game, face = (a.scale.x < 0 ? -1 : 1);
    var poolY = (gs.bonusPool && gs.bonusPool.y) || 0;
    var rxw = b.x, rBottomW = b.y + poolY;        // where the pickup stood on its platform (world coords)
    b.kill();
    // fully disable the doodler's body during entry so ONLY the doodler tween moves (physics can't fight it)
    if (a.body) a.body.enable = false;
    a.x = rxw;
    // rocket stands ON the platform, BEHIND the doodler — it must not move while boarding
    var er = null;
    if (Doodle._imgOK(g, "rocketpick_" + th)) {
      er = g.add.sprite(rxw, rBottomW, "rocketpick_" + th);
      er.anchor.setTo(0.5, 1); er.width = 144; er.height = 206; // bottom sits on the platform (same body size as the flying rocket)
      try { a.parent.addChildAt(er, a.parent.getChildIndex(a)); } catch (e0) {}
    }
    var winY = rBottomW - 135; // the window/porthole — doodler descends here while the rocket stays put
    var doLaunch = function () {
      try {
        if (er) er.destroy();
        a._boarding = false; // boarding done — world scroll resumes
        if (gs.sounds && gs.sounds.rocket) gs.sounds.rocket.play();
        a.alpha = 1; a.scale.setTo(face, 1); a.y = winY; // rocket window stays exactly where the doodler entered (no jump)
        if (Doodle._sheetOK(g, "rocket_" + th, 9)) {
          a.loadTexture("rocket_" + th); a.frame = 0;
          a.anchor.setTo(0.5, 0.42);
          a.animations.add("rk", [0, 1, 2, 3, 4, 5, 6, 7, 8], 16, true); a.play("rk");
        }
        if (a.body) { a.body.enable = true; a.body.allowGravity = true; a.body.velocity.x = 0; a.body.velocity.y = -1400; a.body.gravity.y = -2400; } // stronger boost off the pad -> FASTER climb (~-2200), longer distance
        Doodle._rocketFlight(a, gs, th);
      } catch (eL) { Doodle._show("rocket launch: " + eL.message); }
    };
    // entry: doodler slides to the window center and shrinks to fit it (no fade), then the rocket takes off
    g.add.tween(a).to({ x: rxw }, 380, Phaser.Easing.Quadratic.Out, true);
    g.add.tween(a.scale).to({ x: 0.6 * face, y: 0.6 }, 380, Phaser.Easing.Quadratic.In, true);
    var tw = g.add.tween(a).to({ y: winY }, 380, Phaser.Easing.Quadratic.Out, true);
    tw.onComplete.add(doLaunch);
  } catch (e) { Doodle._show("activateRocket: " + e.message); }
};

// Rocket flight: ascent gravity stages + exit (doodler hops off, empty rocket drops away).
Doodle._rocketFlight = function (a, gs, th) {
  try {
    var pt = a.playerTimer, S = Phaser.Timer.SECOND / 60;
    pt.add(72 * S, function () { a.body.gravity.y = -1728; });  // cancels world gravity -> STEADY climb (constant speed)
    pt.add(285 * S, function () { a.body.gravity.y = 850; });   // thrust off -> STRONGER decel (world+850) so the faster rocket still slows to the same gentle ~-270 exit speed
    pt.add(330 * S, function () {
      try {
        var _vy = (a.body && a.body.velocity) ? a.body.velocity.y : -280; // CONTINUE the flight's upward speed -> no jerk at exit
        a.animations.stop(); a.withBonus = false; a.bonusType = null; a.isRocketRide = false;
        var th2 = Doodle.getTheme();
        if (Doodle._imgOK(a.game, "rocketpick_" + th2)) { // empty rocket drops away behind the doodler
          var _rkTop = a.y - (a.anchor ? a.anchor.y : 0.42) * a.height; // TOP of the riding rocket, captured BEFORE the doodler texture swap
          var er = a.game.add.sprite(a.x, _rkTop + 0.4 * 206, "rocketpick_" + th2);
          er.anchor.setTo(0.5, 0.4); er.width = 144; er.height = 206;   // EXACT flying-body size, body TOP aligned to the riding rocket -> NO drop/shrink when the flames cut; it keeps floating up
          try { a.parent.addChildAt(er, a.parent.getChildIndex(a)); } catch (ez) {} // render BEHIND the doodler
          a.game.physics.arcade.enable(er); er.body.allowGravity = true; // MUST be true or body gravity is ignored -> it never falls
          er.body.velocity.y = _vy;       // CONTINUES the rocket's own momentum -> NO jerk, smooth glide up
          er.body.velocity.x = 5;         // barely drifts sideways
          er.body.gravity.y = -1520;      // world(1728)+this = ~210 -> gentler decel: glides UP a bit FURTHER and lingers longer
          er.body.angularVelocity = 22;   // tips over gradually
          er.checkWorldBounds = true; er.outOfBoundsKill = true;
          a.game.time.events.add(780, function () {   // momentum spent -> tilt over, drop fast, and scroll with the world
            if (er && er.alive && er.body) {
              er.body.gravity.y = 1472; er.body.angularVelocity = 60;
              gs._fallRockets = (gs._fallRockets || []).filter(function (r) { return r && r.alive; });
              gs._fallRockets.push(er);
            }
          });
        }
        a.anchor.setTo(0.5, 0.5); // restore doodler anchor
        a.loadTexture(a._rkPrevKey); a.frame = 0;
        a.scale.setTo(1, 1); // full size + NEUTRAL facing (scale.x=1) so the body offset/reset is correct; control re-flips it
        a.y += 26; // pops out at the bottom-front of the rocket (below the window), like the video
        if (a.body) {
          a.body.enable = true;          // re-activate physics/collision so it lands on platforms again
          a.body.setSize(60, 90, a.width / 2 - 30, a.height / 2 - 45 + 20); // realign collision box to the doodler
          a.body.reset(a.x, a.y);        // FORCE the body back onto the doodler (it was stale at the rocket); scale.x=1 -> box lands on the doodler, not 62px to the side
          a.body.velocity.x = 0;
          a.body.velocity.y = _vy;       // CONTINUES the flight's upward speed (NO jerk) -> smooth linger as the speed reduces, screen scrolls up a bit more
          a.body.gravity.y = -1520;      // world(1728)+this = ~210 -> gentler decel, drifts UP a bit FURTHER while slowing (linger)
          a.game.time.events.add(780, function () { if (a.alive && a.body) a.body.gravity.y = 0; }); // ...then world gravity takes over and it falls onto platforms
        }
      } catch (e2) {}
    });
  } catch (e) { Doodle._show("activateRocket: " + e.message); }
};

// COMET / shooting star (space): a decorative 3-frame animated streak that
// flies diagonally across the play area at random intervals. Non-colliding.
Doodle.startComets = function (state) {
  try {
    if (Doodle.getTheme() !== "space") return;
    if (!Doodle._sheetOK(state.game, "comet_space", 3)) return;
    // dedicated group so comets scroll WITH the world (moveScreen shifts it),
    // instead of sticking to the camera as the doodler climbs.
    state._cometGroup = state.add.group();      // small comets -> behind the planets
    state._cometGroupFront = state.add.group(); // the big comet -> in front of the planets
    // final stacking is set in startPlanets (which runs right after this)
    if (state.background) state.game.world.sendToBack(state.background); // bg stays at the very back
    var fire = function () {
      Doodle.spawnComet(state);
      state.time.events.add(5000 + Math.random() * 6000, fire, state);
    };
    state.time.events.add(2500 + Math.random() * 3500, fire, state);
  } catch (e) { Doodle._show("startComets: " + e.message); }
};
Doodle.spawnComet = function (state) {
  try {
    var g = state.game, t = Doodle.getTheme();
    if (!Doodle._sheetOK(g, "comet_" + t, 3)) return;
    var big = Math.random() < 0.22;             // occasionally a big comet, which passes IN FRONT of planets
    var grp = big ? (state._cometGroupFront || state._cometGroup) : state._cometGroup;
    if (!grp) return;
    var fromRight = Math.random() < 0.5;
    var x = fromRight ? g.width + 30 : -30;
    var y = (40 + Math.random() * (g.height * 0.45)) - grp.y; // local pos accounts for scroll
    var s = grp.create(x, y, "comet_" + t);
    s.anchor.setTo(0.5, 0.3);
    s.animations.add("c", [0, 1, 2], 6, true); s.play("c");
    s.scale.setTo(big ? (1.35 + Math.random() * 0.45) : (0.5 + Math.random() * 0.35)); // big -> front, small -> behind planets
    g.physics.arcade.enable(s);
    s.body.allowGravity = false;
    var sp = 300 + Math.random() * 160;
    s.body.velocity.x = fromRight ? -sp : sp;
    s.body.velocity.y = sp * (0.5 + Math.random() * 0.4);
    s.angle = Math.atan2(s.body.velocity.x, -s.body.velocity.y) * 180 / Math.PI; // head leads
    s.lifespan = 4500; // auto-remove after it has crossed
  } catch (e) { Doodle._show("spawnComet: " + e.message); }
};

// PLANETS (space): large background bodies that drift slowly down (parallax) as
// the doodler climbs. Side planets peek in from a random edge; sometimes a planet
// sits at the bottom at the start. They live in a group scrolled at half speed.
Doodle.startPlanets = function (state) {
  try {
    if (Doodle.getTheme() !== "space") return;
    if (!Doodle._imgOK(state.game, "pf_space_0")) return;
    state._planetGroup = state.add.group();
    // stack back -> front: bg, small comets, planets, big comet, [gameplay/platforms]
    if (state._cometGroupFront) state.game.world.sendToBack(state._cometGroupFront);
    state.game.world.sendToBack(state._planetGroup);
    if (state._cometGroup) state.game.world.sendToBack(state._cometGroup);
    if (state.background) state.game.world.sendToBack(state.background);
    if (Math.random() < 0.5) Doodle.spawnPlanet(state);         // a side planet at start
  } catch (e) { Doodle._show("startPlanets: " + e.message); }
};
// Called from loadLevel (runs only as the doodler climbs) so planets are tied to
// PROGRESSION, not a timer — they won't appear/disappear while you jump in place.
Doodle.maybePlanet = function (gs) {
  try {
    var grp = gs._planetGroup; if (!grp) return;
    var H = gs.game.height, alive = 0;
    grp.forEach(function (p) {
      if (p && p.alive) {
        if ((grp.y + p.y) > H + 500) p.kill();                 // prune ones scrolled well off the bottom
        else alive++;
      }
    });
    if (alive > 0) return;                                      // only one planet on screen at a time
    if (Math.random() > 0.012) return;                          // rare
    Doodle.spawnPlanet(gs, false);
  } catch (e) { Doodle._show("maybePlanet: " + e.message); }
};
Doodle.spawnPlanet = function (state) {
  try {
    var g = state.game, grp = state._planetGroup, t = Doodle.getTheme();
    if (!grp) return;
    // SIDE ONLY: any of the 10 planets peeks in from the left or right wall (part off-screen). No bottom planets.
    var pk = "pf_" + t + "_" + Math.floor(Math.random() * 10);
    if (!Doodle._imgOK(g, pk)) return;
    var left = Math.random() < 0.5;
    var screenY = -120 - Math.random() * 260;                   // start above the view, drifts down
    var p = grp.create(left ? 0 : g.width, screenY - grp.y, pk);
    p.anchor.setTo(0, 0.5);                                     // flat (cut) edge flush to the wall, curve peeks into the screen
    if (!left) p.scale.x = -1;                                  // mirror so the flat edge sits on the RIGHT wall
  } catch (e) { Doodle._show("spawnPlanet: " + e.message); }
};

// Theme the menu decorations (platform, UFO/spaceship, black hole) from tiles.
Doodle.applyMenuDecor = function (state) {
  try {
    var t = Doodle.getTheme(); if (t === "default") return;
    if (state.platform && Doodle._imgOK(state.game, "plat_" + t + "_0"))
      state.platform.loadTexture("plat_" + t + "_0");
    // (the menu UFO is an Obstacle -> applyObsTexture already themes+animates it)
    // (no black-hole decoration on the menu — removed per design)
    // animated winged monsters (type 10 -> auto-plays the "fly" wing-flap animation; not rethemed, so it's the classic blue winged monster)
    if (Doodle.Obstacle && !state._menuMonsters) {
      state._menuMonsters = true;
      try { var _m1 = new Doodle.Obstacle(state.game, 330, 748, "10"); state.add.existing(_m1); } catch (em1) {}
      try { var _m2 = new Doodle.Obstacle(state.game, 478, 720, "10"); state.add.existing(_m2); if (_m2 && _m2.scale) _m2.scale.x = -Math.abs(_m2.scale.x); } catch (em2) {}
    }
  } catch (e) { Doodle._show("applyMenuDecor: " + e.message); }
};

// Swap the in-game top score bar to the theme's bar (the classic "panel" sprite).
Doodle.applyTopBar = function (state) {
  try {
    var t = Doodle.getTheme();
    if (t === "default" || !state.panel) return;
    var d = Doodle.THEME_DATA[t];
    var k = "top_" + t;
    if (!d || !d.top || !Doodle._imgOK(state.game, k)) return;
    state.panel.loadTexture(k);
    // anchor to the very top and grow downward by the safe-area inset, so the bar covers the status-bar area
    // (no game peeking above it) while the score sits below the notch.
    state.panel.cameraOffset.set(0, -23); state.panel.y = -23; state.panel.x = 0;
    state.panel.width = 640; state.panel.height = 92 + (Doodle.safeTop || 0);
    state.panel.alpha = 1;
  } catch (e) { Doodle._show("applyTopBar: " + e.message); }
};

// Paint the HTML page background to match the current screen's bottom edge. iOS PWAs won't let the canvas
// paint under the home indicator, so this makes that strip blend (space slate / cream) instead of showing black.
Doodle.setPageBg = function (color) { try { document.body.style.background = color; } catch (e) {} };
Doodle.themeBottomColor = function () { return Doodle.getTheme() === "default" ? "#f7efe7" : "#404a59"; };
// Paint the page bg as the current theme's slider scene anchored to the bottom, so the home-indicator strip
// shows the space scene continuing down (instead of a flat band). Color fallback if the image can't load.
Doodle.setPageBgScene = function (color) {
  try {
    var t = Doodle.getTheme();
    var pn = ({ "default": "original", snow: "winter", doodlestein: "halloween" })[t] || t;
    var path = "static/images/themeslider/theme_" + pn + "_X.png";
    var url = (window.__DJ_ASSETS && window.__DJ_ASSETS[path]) || path;
    document.body.style.background = color + " url('" + url + "') center bottom / 100% auto no-repeat";
  } catch (e) { Doodle.setPageBg(color); }
};

// --- Online leaderboard -------------------------------------------------
// Set window.DJ_API_URL (in the HTML) to your deployed leaderboard server to enable global scores.
// When empty, the game stays local-only (no network calls).
Doodle.API_URL = (typeof window !== "undefined" && window.DJ_API_URL) || "";
Doodle.submitScore = function (name, score, theme) {
  if (!Doodle.API_URL) return;
  try {
    fetch(Doodle.API_URL + "/api/scores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: (name || "unnamed").slice(0, 24), score: Math.max(0, Math.round(score) || 0), theme: theme || Doodle.getTheme() }),
    }).catch(function () {});
  } catch (e) {}
};
Doodle.fetchTopScores = function (cb, theme) {
  if (!Doodle.API_URL) { cb(null); return; }
  try {
    fetch(Doodle.API_URL + "/api/scores/top?limit=10" + (theme ? "&theme=" + encodeURIComponent(theme) : ""))
      .then(function (r) { return r.json(); })
      .then(function (d) { cb((d && d.scores) || []); })
      .catch(function () { cb(null); });
  } catch (e) { cb(null); }
};

// Measure the safe-area insets in GAME units. Read LATE (in each state's create) via the persistent #safeprobe,
// because env(safe-area-inset-*) is often 0 at boot before iOS resolves the PWA chrome.
Doodle.computeSafeInsets = function (game) {
  try {
    var pr = document.getElementById("safeprobe"), st = 0, sb = 0;
    if (pr) { var cs = window.getComputedStyle(pr); st = parseFloat(cs.paddingTop) || 0; sb = parseFloat(cs.paddingBottom) || 0; }
    var gp = document.getElementById("gameParent");
    var gh = (game && game.height) || 955;
    var disp = (gp && gp.offsetHeight) || window.innerHeight || gh;
    var sy = disp / gh;
    if (sy > 0) { Doodle.safeTop = Math.round(st / sy); Doodle.safeBot = Math.round(sb / sy); }
  } catch (e) {}
  if (typeof Doodle.safeTop !== "number") Doodle.safeTop = 0;
  if (typeof Doodle.safeBot !== "number") Doodle.safeBot = 0;
};

// Fill a sub-screen (scores / options / calibrate) with full-height lined paper so there's no empty band below.
Doodle.fillSubBg = function (state) {
  Doodle.computeSafeInsets(state.game);
  Doodle.setPageBg("#f7efe7"); // lined-paper cream under the home indicator
  try {
    if (!Doodle._imgOK(state.game, "linedbg")) return;
    var bg = state.add.sprite(0, 0, "linedbg");
    bg.width = 640; bg.height = Math.max(state.game.height, 1800);
    state.world.sendToBack(bg);
  } catch (e) {}
};

Doodle._applyBg = function (state) {
  Doodle.setPageBg(Doodle.themeBottomColor()); // home-indicator strip matches the in-game theme bg (space slate / cream)
  try { Doodle._bg = state.background; Doodle._setBg(state.game, Doodle.getTheme()); }
  catch (e) { Doodle._show("_applyBg: " + e.message); }
};
Doodle._setBg = function (game, name) {
  try {
    var bg = Doodle._bg; if (!bg) return;
    if (name === "default") { bg.loadTexture("atlas2", "background"); return; }
    var key = "djbg_" + name;
    if (Doodle._imgOK(game, key)) bg.loadTexture(key);
  } catch (e) { Doodle._show("_setBg: " + e.message); }
};

Doodle.applyTheme = function (name) {
  try {
    if (Doodle.THEMES.indexOf(name) === -1) name = "default";
    Doodle.setTheme(name);
    if (Doodle._bg && Doodle._bg.game) Doodle._setBg(Doodle._bg.game, name);
  } catch (e) { Doodle._show("applyTheme: " + e.message); }
};

Doodle._previewBg = function (spr, name, game) {
  try {
    if (!spr) return;
    if (name === "default") spr.loadTexture("atlas2", "background");
    else { var key = "djbg_" + name; if (Doodle._imgOK(game, key)) spr.loadTexture(key); }
    spr.width = 640; spr.height = 960;
  } catch (e) { Doodle._show("_previewBg: " + e.message); }
};

// ---- theme picker (full-screen state) ----
Doodle.ThemeState = {
  create: function () {
   try {
    var self = this;
    this.bg = this.add.sprite(0, 0, "atlas2", "background");
    this.bg.width = 640; this.bg.height = 960;
    Doodle._previewBg(this.bg, Doodle.getTheme(), this.game);

    var title = this.add.bitmapText(320, 24, "DoodleFont", "choose theme", 50);
    title.anchor.setTo(0.5);

    this.gfx = this.add.graphics(0, 0);
    this.BS = 36;
    this._pos = [];
    var cols = [{ bx: 60, lx: 110 }, { bx: 350, lx: 400 }];
    var perCol = Math.ceil(Doodle.THEMES.length / 2);
    Doodle.THEMES.forEach(function (t, i) {
      var col = i < perCol ? 0 : 1;
      var row = i < perCol ? i : i - perCol;
      var c = cols[col];
      var y = 80 + row * 108;
      self._pos.push({ bx: c.bx, y: y });
      self.add.bitmapText(c.lx, y - 2, "DoodleFont", t, 34);
      var hit = self.add.sprite(c.bx - 10, y - 8, "atlas2", "background");
      hit.width = 280; hit.height = 52; hit.alpha = 0;
      hit.inputEnabled = true; hit.themeName = t;
      hit.events.onInputUp.add(function (s) {
        try {
          Doodle.applyTheme(s.themeName);
          Doodle._previewBg(self.bg, s.themeName, self.game);
          self._redraw();
        } catch (e) { Doodle._show("themeClick: " + e.message); }
      }, this);
    });

    // » suits « (only if the current theme has suits)
    this.suitsBtn = this.add.bitmapText(320, 838, "DoodleFont", "", 44);
    this.suitsBtn.anchor.setTo(0.5);
    this.suitsBtn.inputEnabled = true;
    this.suitsBtn.events.onInputUp.add(function () {
      if (Doodle.THEME_DATA[Doodle.getTheme()] && Doodle.THEME_DATA[Doodle.getTheme()].suits.length)
        self.state.start("Suits");
    }, this);

    var back = this.add.bitmapText(320, 902, "DoodleFont", "« back", 50);
    back.anchor.setTo(0.5);
    back.inputEnabled = true;
    back.events.onInputUp.add(function () { self.state.start("Settings"); }, this);

    this._redraw();
   } catch (e) { Doodle._show("ThemeState.create: " + e.message); }
  },
  _redraw: function () {
   try {
    var g = this.gfx, cur = Doodle.getTheme(), BS = this.BS;
    g.clear();
    for (var i = 0; i < this._pos.length; i++) {
      var x = this._pos[i].bx, y = this._pos[i].y;
      g.beginFill(0xffffff, 0.82); g.drawRect(x - 10, y - 6, 250, BS + 12); g.endFill();
      g.lineStyle(3, 0x000000, 1); g.drawRect(x, y, BS, BS);
      if (Doodle.THEMES[i] === cur) {
        g.lineStyle(4, 0x00bb00, 1);
        g.moveTo(x, y); g.lineTo(x + BS, y + BS);
        g.moveTo(x + BS, y); g.lineTo(x, y + BS);
      }
    }
    var d = Doodle.THEME_DATA[cur];
    this.suitsBtn.text = (d && d.suits.length) ? "» suits «" : "";
   } catch (e) { Doodle._show("_redraw: " + e.message); }
  }
};

// ---- suit picker (full-screen grid) ----
Doodle.SuitState = {
  create: function () {
   try {
    var self = this, t = Doodle.getTheme();
    var suits = (Doodle.THEME_DATA[t] || {}).suits || [];
    this.bg = this.add.sprite(0, 0, "atlas2", "background");
    this.bg.width = 640; this.bg.height = 960;
    Doodle._previewBg(this.bg, t, this.game);

    var title = this.add.bitmapText(320, 22, "DoodleFont", t + " suits", 48);
    title.anchor.setTo(0.5);

    this.gfx = this.add.graphics(0, 0);
    this._pos = [];
    var entries = [""].concat(suits); // "" = base/no suit
    // 3 columns when there are many suits, else 2 (bigger cells).
    var cols = entries.length > 9 ? 3 : 2;
    var cellW = cols === 3 ? 202 : 300;
    var cellH = cols === 3 ? 112 : 132;
    var prev = cols === 3 ? 0.5 : 0.62;
    var x0 = cols === 3 ? 16 : 30, y0 = 78;
    entries.forEach(function (s, i) {
      var cx = x0 + (i % cols) * cellW;
      var cy = y0 + Math.floor(i / cols) * cellH;
      self._pos.push({ x: cx, y: cy, w: cellW - 12, h: cellH - 10, suit: s });
      var key = s ? ("pl_" + t + "__" + s) : ("pl_" + t);
      if (self.game.cache.checkImageKey(key)) {
        var spr = self.add.sprite(cx + 30, cy + cellH / 2 - 4, key); spr.frame = 0;
        spr.anchor.setTo(0.5); spr.scale.setTo(prev);
      }
      var label = (s || "default").replace("pirates-", "").replace(/-/g, " ");
      self.add.bitmapText(cx + 58, cy + 16, "DoodleFont", label, cols === 3 ? 20 : 26);
      var hit = self.add.sprite(cx, cy, "atlas2", "background");
      hit.width = cellW - 12; hit.height = cellH - 10; hit.alpha = 0;
      hit.inputEnabled = true; hit.suit = s;
      hit.events.onInputUp.add(function (h) { Doodle.setSuit(t, h.suit); self._redraw(); }, this);
    });

    var back = this.add.bitmapText(320, 916, "DoodleFont", "« back", 48);
    back.anchor.setTo(0.5); back.inputEnabled = true;
    back.events.onInputUp.add(function () { self.state.start("Themes"); }, this);

    this._redraw();
   } catch (e) { Doodle._show("SuitState.create: " + e.message); }
  },
  _redraw: function () {
   try {
    var g = this.gfx, cur = Doodle.getSuit();
    g.clear();
    for (var i = 0; i < this._pos.length; i++) {
      var p = this._pos[i];
      var on = (p.suit === cur);
      g.lineStyle(on ? 5 : 2, on ? 0x00bb00 : 0x000000, on ? 1 : 0.5);
      g.beginFill(0xffffff, on ? 0.5 : 0.28);
      g.drawRoundedRect(p.x, p.y, p.w, p.h, 10); g.endFill();
    }
   } catch (e) { Doodle._show("SuitState._redraw: " + e.message); }
  }
};
