// Asset + theme system. Loads images/audio, exposes sprite-sheet frame
// rectangles (ported from the Python source), and manages the current skin.
(function (DJ) {
  const IMG_BASE = "static/images/";
  const AUDIO_BASE = "static/audio/";
  const FONT_PATH = "static/fonts/DoodleJump.ttf";

  const THEMES = [
    "default", "jungle", "space", "ghost", "ice",
    "bunny", "doodlestein", "soccer", "underwater", "snow",
  ];
  const tit  = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // Frame rectangles within the per-theme Game_tiles/{theme}.png sheet (900x512).
  // [sx, sy, sw, sh] — copied verbatim from the Python sprite definitions.
  const FRAMES = {
    tileDefault:      [1, 1, 57, 15],
    tileMoving:       [2, 19, 58, 17],
    tileDisappearing: [1, 55, 57, 15],
    tileShifting:     [1, 184, 57, 15],
    tileBroken:       [1, 73, 60, 15],
    tileBroken1:      [0, 90, 62, 20],
    tileBroken2:      [0, 116, 62, 27],
    tileBroken3:      [0, 148, 62, 32],
    tileExp0:         [1, 184, 57, 15],
    tileExp1:         [1, 202, 57, 15],
    tileExp2:         [1, 220, 57, 15],
    tileExp3:         [1, 238, 57, 15],
    tileExp4:         [1, 256, 57, 15],
    tileExp5:         [1, 274, 58, 18],
    tileExp6:         [1, 293, 61, 27],
    tileExp7:         [1, 321, 61, 28],
    // monsters
    monTerrifier:     [0, 421, 62, 91],
    monFatGreen:      [0, 357, 84, 61],
    monBat:           [148, 0, 77, 45],
    monDouble:        [63, 183, 80, 53],
    monBall:          [149, 263, 46, 39],
    // ufo / blackhole
    ufoDefault:       [428, 208, 84, 122],
    ufoCollision:     [428, 83, 84, 122],
    blackhole:        [233, 51, 67, 65],
    // spring / trampoline (from theme sheet)
    spring:           [404, 99, 17, 12],
    springExpanded:   [404, 115, 17, 28],
    tramp1:           [188, 98, 36, 14],
    tramp2:           [474, 53, 36, 14],
    tramp3:           [149, 94, 36, 18],
  };

  // Frames that come specifically from the DEFAULT Game_tiles sheet.
  const DEFAULT_SHEET_FRAMES = {
    moveable:        [150, 305, 80, 35],
    shoeDefault:     [301, 205, 27, 21],
    shoeCompressed:  [301, 237, 27, 21],
    shoeShoot:       [590, 214, 27, 20],
    shoeShootComp:   [589, 241, 27, 21],
  };

  // Jetpack sheet (Animations/Jetpack/{theme}.png, 256x384) — 64x124 rockets
  // in a 4-col x 3-row grid (10 frames).
  const JETPACK_FRAMES = {
    r1: [0, 0, 64, 124],   r2: [64, 0, 64, 124],   r3: [128, 0, 64, 124],   r4: [192, 0, 64, 124],
    r5: [0, 128, 64, 124], r6: [64, 128, 64, 124], r7: [128, 128, 64, 124], r8: [192, 128, 64, 124],
    r9: [0, 256, 64, 124], def: [64, 256, 64, 124],
  };
  // Propeller sheet (128x128) — 64x64 frames (2x2 grid).
  const PROPELLER_FRAMES = {
    p1: [0, 0, 64, 64], p2: [64, 0, 64, 64], p3: [0, 64, 64, 64], p4: [64, 0, 64, 64],
  };

  // start-end-tiles.png (1024x512) frames for end-game UI + menu buttons.
  const UI_FRAMES = {
    gameOver:     [2, 209, 433, 157],
    yourScore:    [795, 339, 218, 40],
    yourHigh:     [677, 393, 310, 56],
    menuBtn:      [3, 99, 222, 80],
    playAgainBtn: [231, 99, 222, 80],
  };

  // --- image cache / loader ---
  const cache = {};
  function loadImage(path) {
    if (cache[path]) return cache[path].promise;
    const img = new Image();
    const entry = { img, promise: null };
    entry.promise = new Promise((resolve) => {
      img.onload = () => resolve(img);
      img.onerror = () => { console.warn("missing image", path); resolve(img); };
      img.src = IMG_BASE + path;
    });
    cache[path] = entry;
    return entry.promise;
  }
  const getImg = (path) => (cache[path] ? cache[path].img : null);

  // --- audio ---
  // mp3 where available, wav otherwise (matches files on disk).
  const AUDIO_EXT = {
    button: "wav", activate_shield: "wav", explode: "wav", ufo: "wav",
  };
  const soundBuffers = {};
  function loadSound(name) {
    const ext = AUDIO_EXT[name] || "mp3";
    const a = new Audio();
    a.src = AUDIO_BASE + name + "." + ext;
    a.preload = "auto";
    soundBuffers[name] = a;
  }
  const SOUND_NAMES = [
    "jump", "shoot_1", "shoot_2", "break", "pop", "button", "monster", "fall",
    "thump", "die_1", "die_2", "suck", "spring", "trampoline", "jetpack",
    "propeller", "block", "activate_shield", "explode", "ufo", "ufo_suck",
    "monster_warning", "ufo_warning",
  ];

  let muted = localStorage.getItem("DJ2_muted") === "true";

  function playOnce(name, volume = 1) {
    if (muted) return null;
    const base = soundBuffers[name];
    if (!base) return null;
    const a = base.cloneNode();
    a.volume = Math.min(1, volume);
    a.play().catch(() => {});
    return a;
  }
  function playLoop(name, volume = 1) {
    if (muted) return null;
    const base = soundBuffers[name];
    if (!base) return null;
    const a = base.cloneNode();
    a.loop = true;
    a.volume = Math.min(1, volume);
    a.play().catch(() => {});
    return a;
  }

  // --- theme state ---
  let current = localStorage.getItem("DJ2_theme") || "default";
  if (!THEMES.includes(current)) current = "default";

  const Assets = {
    THEMES, FRAMES, DEFAULT_SHEET_FRAMES, JETPACK_FRAMES, PROPELLER_FRAMES, UI_FRAMES,
    loadImage, getImg,
    get fileName() { return current; },
    get folderName() { return tit(current); },
    isMuted() { return muted; },
    setMuted(v) { muted = v; localStorage.setItem("DJ2_muted", v ? "true" : "false"); },
    play: playOnce,
    loop: playLoop,

    // Theme-specific asset accessors (return loaded <img> for current theme).
    sheet()      { return getImg(`Game_tiles/${current}.png`); },
    defaultSheet(){ return getImg(`Game_tiles/default.png`); },
    background() { return getImg(`Backgrounds/Backgrounds/${current}.png`); },
    top()        { return getImg(`Backgrounds/Tops/${current}.png`); },
    bottom()     { return getImg(`Backgrounds/Bottoms/${current}.png`); },
    jetpack()    { return getImg(`Animations/Jetpack/${current}.png`); },
    propeller()  { return getImg(`Animations/Propeller/${current}.png`); },
    projectile() { return getImg(`Projectiles/${current}.png`); },
    player(name) { return getImg(`Player/${tit(current)}/Body/${name}.png`); },
    // common UI
    img: getImg,

    setTheme(name) {
      if (!THEMES.includes(name)) return Promise.resolve();
      // Load the new theme's assets BEFORE switching, so nothing draws blank.
      return this.loadTheme(name).then(() => {
        current = name;
        localStorage.setItem("DJ2_theme", name);
      });
    },

    loadTheme(name) {
      const f = name;
      const F = tit(name);
      const paths = [
        `Game_tiles/${f}.png`,
        `Backgrounds/Backgrounds/${f}.png`,
        `Backgrounds/Tops/${f}.png`,
        `Backgrounds/Bottoms/${f}.png`,
        `Animations/Jetpack/${f}.png`,
        `Animations/Propeller/${f}.png`,
        `Projectiles/${f}.png`,
        `Player/${F}/Body/left.png`,
        `Player/${F}/Body/left_jump.png`,
        `Player/${F}/Body/right.png`,
        `Player/${F}/Body/right_jump.png`,
        `Player/${F}/Body/shoot.png`,
        `Player/${F}/Body/shoot_jump.png`,
        `Player/${F}/Body/nose.png`,   // only some skins ship a detached nose
      ];
      return Promise.all(paths.map(loadImage));
    },

    loadCommon() {
      const common = [
        "Game_tiles/default.png",
        "Player/shield.png",
        "Power_up/shield_power_up.png",
        "Animations/Stars/1.png",
        "Animations/Stars/2.png",
        "Animations/Stars/3.png",
        "start-end-tiles.png",
        "Backgrounds/main_menu.png",
        "Backgrounds/options.png",
        "Backgrounds/options_title.png",
        "Backgrounds/pause_screen.png",
        "Buttons/play.png",
        "Buttons/play_hover.png",
        "Buttons/options.png",
        "Buttons/options_hover.png",
        "Buttons/pause.png",
        "Buttons/resume.png",
        "Buttons/menu_hover.png",
        "Buttons/play_again_hover.png",
      ];
      SOUND_NAMES.forEach(loadSound);
      const fontP = (window.FontFace
        ? new FontFace("DoodleJump", `url(${FONT_PATH})`).load()
            .then((ff) => document.fonts.add(ff))
            .catch(() => {})
        : Promise.resolve());
      return Promise.all(common.map(loadImage).concat([fontP]));
    },
  };

  DJ.Assets = Assets;
})(window.DJ = window.DJ || {});
