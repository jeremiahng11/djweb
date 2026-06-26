// Multiplayer client + lobby UI. Talks to the server's WebSocket (<DJ_API_URL>/ws).
// Phase 1b: create/join/quick-match, pick mode, pick a UNIQUE character, ready-up, synced countdown.
// On "start" it hands off to the game (phase 2 wires the live race + opponent rendering).
var Doodle = Doodle || {};

Doodle.MP = (function () {
  var ws = null, myId = null, room = null, ov = null, card = null;
  var listeners = {}; // event -> fn

  // characters offered in the picker = the doodler roster (theme player sheets)
  var CHARACTERS = (Doodle.ALL_THEMES || ["default", "space"]).slice();

  function wsUrl() {
    var base = (typeof window !== "undefined" && window.DJ_API_URL) || "";
    if (!base) return null;
    return base.replace(/^http/i, "ws") + "/ws"; // https->wss
  }
  function myName() { try { return (localStorage.getItem("DJ_Doodle_name") || "player").slice(0, 24); } catch (e) { return "player"; } }
  function send(msg) { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); } catch (e) {} }
  function me() { return room && room.players ? room.players.filter(function (p) { return p.id === myId; })[0] : null; }
  function isHost() { return room && room.hostId === myId; }
  function emit(ev, a) { if (listeners[ev]) listeners[ev](a); }
  Doodle.MP_on = function (ev, fn) { listeners[ev] = fn; };

  function connect(onOpen) {
    var url = wsUrl();
    if (!url) { alert("Multiplayer needs the online build."); return; }
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) { onOpen && onOpen(); return; }
    ws = new WebSocket(url);
    ws.onopen = function () { onOpen && onOpen(); };
    ws.onclose = function () { };
    ws.onerror = function () { setMsg("connection error"); };
    ws.onmessage = function (e) {
      var m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.type === "hello") myId = m.id;
      else if (m.type === "joined") { myId = m.id; }
      else if (m.type === "room") { room = m.room; if (room.status === "lobby") { raceOver = false; iDied = false; clearGhosts(); clearRace(); } render(); }
      else if (m.type === "error") { setMsg(m.error); }
      else if (m.type === "countdown") { renderCountdown(m.n); }
      else if (m.type === "start") { startRace(m.seed); }
      else if (m.type === "players") { lastPlayers = m.players || []; if (Doodle.MP.active) renderRail(lastPlayers); emit("players", lastPlayers); }
      else if (m.type === "end") { renderStandings(m); }
    };
  }

  function startRace(seed) {
    iDied = false; raceOver = false; lastSent = 0; clearRace(); clearGhosts();
    Doodle.MP.active = true;
    if (seed && Doodle.seedLevel) Doodle.seedLevel(seed); // everyone builds the identical map from this seed
    Doodle.MP.myCharacter = (me() && me().character) || null;
    Doodle.MP.roomSnapshot = room;
    lastPlayers = (room && room.players) ? room.players.slice() : [];
    close();
    emit("start", room);
    var g = Doodle.game; if (!g) return;
    // preload EVERY player's character sheet (mine for my doodler, opponents' for their in-world ghosts)
    var need = [];
    ((room && room.players) || []).forEach(function (p) {
      var c = p.character;
      if (c && c !== "default" && need.indexOf(c) === -1 && !(Doodle._sheetOK && Doodle._sheetOK(g, "pl_" + c, 1))) need.push(c);
    });
    if (need.length) {
      try {
        need.forEach(function (c) { g.load.spritesheet("pl_" + c, "static/images/PlayerSheets/" + c + ".png", 124, 120, 4); });
        g.load.onLoadComplete.addOnce(function () { try { g.state.start("Game"); } catch (e) {} });
        g.load.start();
        return;
      } catch (e) {}
    }
    try { g.state.start("Game"); } catch (e) {}
  }

  // ---- in-race HUD: a vertical "climb rail" of every character + final standings ----
  var rail = null, lastSent = 0, iDied = false, raceOver = false;
  var ghosts = {}, lastPlayers = []; // in-world opponent sprites (id -> sprite) + latest server snapshot

  function clearGhosts() {
    for (var k in ghosts) { try { ghosts[k].djTag && ghosts[k].djTag.destroy(); ghosts[k].destroy(); } catch (e) {} }
    ghosts = {};
  }
  // place opponents in the play area at their real height: ghostY = myDoodler.y - (theirScore - myScore)*2
  function positionGhosts(state) {
    try {
      if (!state || !state.player || !state.add || raceOver) return;
      var opps = lastPlayers.filter(function (p) { return p.id !== myId; });
      var present = {}, W = state.game.width || 640, H = state.game.height || 960;
      opps.forEach(function (p, i) {
        present[p.id] = true;
        var g = ghosts[p.id];
        if (!g || !g.game) {
          var key = (p.character && p.character !== "default" && Doodle._sheetOK && Doodle._sheetOK(state.game, "pl_" + p.character, 1)) ? "pl_" + p.character : "player0";
          g = state.add.sprite(0, 0, key); g.anchor.setTo(.5); g.frame = 0;
          try { g.djTag = state.add.bitmapText(0, 0, "DoodleFont", String(p.name || ""), 22); g.djTag.anchor.setTo(.5); g.djTag.alpha = .75; } catch (e) {}
          ghosts[p.id] = g;
        }
        // shared map: place the ghost at the opponent's REAL x (falls back to a lane if x is missing)
        var gx = (typeof p.x === "number" && p.x) ? p.x : W * (0.22 + 0.56 * (opps.length > 1 ? i / (opps.length - 1) : 0.5));
        var y = state.player.y - (p.score - state.score) * 2;       // 2px per score point
        var on = y > 24 && y < H - 24;
        g.visible = on; if (g.djTag) g.djTag.visible = on;
        if (on) { g.x = gx; g.y = y; g.alpha = p.alive ? .55 : .28; if (g.djTag) { g.djTag.x = gx; g.djTag.y = y - 50; } }
      });
      for (var id in ghosts) if (!present[id]) { try { ghosts[id].djTag && ghosts[id].djTag.destroy(); ghosts[id].destroy(); } catch (e) {} delete ghosts[id]; }
    } catch (e) {}
  }
  function ensureRail() {
    if (rail) return;
    rail = el("div", "position:fixed;top:9%;right:6px;height:82%;width:46px;z-index:99990;pointer-events:none;");
    document.body.appendChild(rail);
  }
  function clearRace() { if (rail) { try { document.body.removeChild(rail); } catch (e) {} rail = null; } }
  // place every player on the rail by score (leader on top); alive = jumping, dead = greyed; mine = outlined
  function renderRail(players) {
    ensureRail(); if (!rail) return;
    while (rail.firstChild) rail.removeChild(rail.firstChild);
    var maxS = 1; players.forEach(function (p) { if (p.score > maxS) maxS = p.score; });
    players.forEach(function (p) {
      var frac = Math.max(0, Math.min(1, p.score / maxS));
      var icon = el("div", "position:absolute;left:0;width:44px;height:42px;bottom:" + (frac * 90) + "%;transition:bottom .15s linear;" +
        "background:url('static/images/PlayerSheets/" + (p.character || "default") + ".png') no-repeat 0 0;background-size:176px auto;" +
        (p.alive ? "animation:djjump .55s steps(4) infinite;" : "opacity:.4;filter:grayscale(1);") +
        (p.id === myId ? "outline:2px solid #fff;border-radius:7px;" : ""));
      rail.appendChild(icon);
    });
  }
  // called from the game's update() ~each frame: throttle + broadcast my score/alive
  function gameTick(state) {
    if (raceOver) return;
    ensureRail();
    positionGhosts(state); // each frame (keep spectating opponents after I die)
    if (iDied) return;
    var now = Date.now(); if (now - lastSent < 140) return; lastSent = now;
    var sc = Math.round((state && state.score) || 0);
    var px = Math.round((state && state.player && state.player.x) || 0);
    send({ type: "state", score: sc, height: sc, x: px, alive: !(state && state.player && state.player.alive === false) });
  }
  // called from the game's gameOver(): report my fall once
  function gameOver(state) {
    if (raceOver || iDied) return; iDied = true;
    var sc = Math.round((state && state.score) || 0);
    send({ type: "state", score: sc, height: sc, alive: false });
  }
  function renderStandings(data) {
    raceOver = true; clearRace(); clearGhosts(); openOverlay(); clearCard();
    card.appendChild(el("div", "font:800 30px system-ui;margin-bottom:2px;", "results"));
    card.appendChild(el("div", "font:600 14px system-ui;opacity:.7;margin-bottom:16px;", "mode: " + (data.mode || "")));
    (data.standings || []).forEach(function (p, i) {
      var row = el("div", "display:flex;align-items:center;justify-content:center;gap:10px;font:700 18px system-ui;margin:7px 0;" + (p.id === myId ? "color:#ffd9a8;" : ""));
      row.appendChild(el("span", "width:30px;text-align:right;font-size:20px;", ["🥇", "🥈", "🥉"][i] || (i + 1 + ".")));
      row.appendChild(el("span", "width:36px;height:34px;display:inline-block;background:url('static/images/PlayerSheets/" + (p.character || "default") + ".png') no-repeat 0 0;background-size:144px auto;"));
      row.appendChild(el("span", "", p.name + "  ·  " + p.score));
      card.appendChild(row);
    });
    card.appendChild(el("div", "height:16px;"));
    if (isHost()) card.appendChild(btn("rematch", BTN, function () { send({ type: "rematch" }); }));
    else card.appendChild(el("div", "font:600 13px system-ui;opacity:.6;margin:4px 0;", "waiting for the host to start a rematch…"));
    card.appendChild(btn("back to menu", BTN2, function () { send({ type: "leave" }); room = null; close(); raceOver = false; iDied = false; try { if (Doodle.game) Doodle.game.state.start("Menu"); } catch (e) {} }));
  }

  // ---- UI ----------------------------------------------------------------
  function el(tag, css, txt) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }
  var BTN = "display:inline-block;font:700 20px system-ui,sans-serif;background:#fff;color:#404a59;padding:11px 26px;margin:7px;border-radius:22px;cursor:pointer;-webkit-tap-highlight-color:transparent;";
  var BTN2 = "display:inline-block;font:600 16px system-ui,sans-serif;background:rgba(255,255,255,.16);color:#fff;padding:9px 18px;margin:5px;border-radius:18px;cursor:pointer;border:1px solid rgba(255,255,255,.4);";
  var msgEl = null;
  function setMsg(t) { if (msgEl) { msgEl.textContent = t || ""; if (t) setTimeout(function () { if (msgEl && msgEl.textContent === t) msgEl.textContent = ""; }, 3500); } }

  function openOverlay() {
    if (ov) return;
    if (!document.getElementById("mp_kf")) { // jump animation: cycle the 4 player-sheet frames
      var s = el("style"); s.id = "mp_kf"; s.textContent = "@keyframes djjump{from{background-position-x:0}to{background-position-x:-216px}}"; document.head.appendChild(s);
    }
    ov = el("div", "position:fixed;inset:0;z-index:99999;background:#404a59;color:#fff;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;overflow:auto;");
    card = el("div", "width:min(460px,92vw);text-align:center;padding:18px;");
    ov.appendChild(card); document.body.appendChild(ov);
  }
  function close() { if (ov) { document.body.removeChild(ov); ov = null; card = null; msgEl = null; } if (Doodle.MP_onClose) Doodle.MP_onClose(); }
  function clearCard() { while (card.firstChild) card.removeChild(card.firstChild); }
  function header(t) { card.appendChild(el("div", "font:800 30px system-ui;letter-spacing:1px;margin-bottom:6px;", "doodle jump")); card.appendChild(el("div", "font:600 18px system-ui;opacity:.85;margin-bottom:18px;", t)); }
  function addMsg() { msgEl = el("div", "min-height:20px;font:600 14px system-ui;color:#ffd9a8;margin-top:12px;"); card.appendChild(msgEl); }
  function btn(txt, style, fn) { var b = el("div", style, txt); b.onclick = fn; return b; }

  function renderHome() {
    clearCard(); header("multiplayer");
    card.appendChild(btn("create room", BTN, renderCreate));
    card.appendChild(btn("join room", BTN, renderJoin));
    card.appendChild(btn("quick match", BTN, function () { connect(function () { send({ type: "quickmatch", name: myName() }); }); }));
    card.appendChild(el("div", "height:8px;"));
    card.appendChild(btn("← back", BTN2, close));
    addMsg();
  }

  var MODES = [
    { k: "lastAlive", t: "last one alive wins" },
    { k: "firstFall", t: "first to fall ends it" },
    { k: "targetHeight", t: "first to the target height" },
    { k: "highScore", t: "highest score wins" },
  ];
  function renderCreate() {
    clearCard(); header("pick a game mode");
    MODES.forEach(function (m) {
      card.appendChild(btn(m.t, BTN, function () { connect(function () { send({ type: "create", name: myName(), mode: m.k, targetHeight: 3000 }); }); }));
    });
    card.appendChild(el("div", "height:8px;"));
    card.appendChild(btn("← back", BTN2, renderHome));
    addMsg();
  }
  function renderJoin() {
    clearCard(); header("enter room code");
    var inp = el("input"); inp.maxLength = 4; inp.placeholder = "ABCD";
    inp.style.cssText = "font:700 28px system-ui;letter-spacing:6px;text-transform:uppercase;text-align:center;width:200px;padding:10px;border:none;border-radius:10px;color:#222;outline:none;";
    card.appendChild(inp); card.appendChild(el("div", "height:10px;"));
    card.appendChild(btn("join", BTN, function () { var c = (inp.value || "").trim().toUpperCase(); if (c.length === 4) connect(function () { send({ type: "join", code: c, name: myName() }); }); }));
    card.appendChild(btn("← back", BTN2, renderHome));
    addMsg();
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 60);
  }

  function render() {
    if (!ov || !room) return;
    if (room.status === "countdown") return; // countdown overlay handles it
    clearCard();
    header("room " + room.code);
    // players
    var pl = el("div", "margin-bottom:14px;");
    room.players.forEach(function (p) {
      var row = el("div", "font:600 17px system-ui;margin:4px 0;opacity:" + (p.ready ? "1" : ".7"));
      row.textContent = (p.id === room.hostId ? "★ " : "") + p.name + (p.character ? " — " + p.character : " — (no character)") + (p.ready ? "  ✓" : "");
      pl.appendChild(row);
    });
    card.appendChild(pl);
    // character grid (unique)
    card.appendChild(el("div", "font:600 14px system-ui;opacity:.8;margin:4px 0;", "pick your character"));
    var grid = el("div", "display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:8px 0;");
    var taken = {}; room.players.forEach(function (p) { if (p.character && p.id !== myId) taken[p.character] = true; });
    var mine = me() && me().character;
    CHARACTERS.forEach(function (ch) {
      var isTaken = !!taken[ch], isMine = ch === mine;
      var tile = el("div", "width:64px;padding:6px 4px;border-radius:10px;cursor:" + (isTaken ? "not-allowed" : "pointer") +
        ";background:" + (isMine ? "#fff" : "rgba(255,255,255,.12)") + ";color:" + (isMine ? "#404a59" : "#fff") +
        ";opacity:" + (isTaken ? ".3" : "1") + ";font:600 11px system-ui;");
      // sheet is 4 frames wide (496x120) -> size to 4x the tile so frame 0 fills it; the selected one animates (jumps)
      var pic = el("div", "width:54px;height:52px;margin:0 auto 3px;background:url('static/images/PlayerSheets/" + ch + ".png') no-repeat 0 0;background-size:216px auto;" + (isMine ? "animation:djjump .6s steps(4) infinite;" : ""));
      tile.appendChild(pic); tile.appendChild(el("div", "", ch));
      if (!isTaken) tile.onclick = function () { send({ type: "pick", character: ch }); };
      grid.appendChild(tile);
    });
    card.appendChild(grid);
    // ready + start
    var meP = me();
    card.appendChild(btn(meP && meP.ready ? "ready ✓ (tap to unready)" : "ready up", BTN, function () { send({ type: "ready", ready: !(meP && meP.ready) }); }));
    // host's start unlocks only when there are >= 2 players and everyone has a character + is ready
    if (isHost()) {
      if (room.players.length >= 2 && room.players.every(function (p) { return p.character && p.ready; }))
        card.appendChild(btn("start game", BTN, function () { send({ type: "start" }); }));
      else
        card.appendChild(el("div", "font:600 13px system-ui;opacity:.6;margin-top:8px;", "start unlocks once everyone has a character and is ready"));
    }
    card.appendChild(el("div", "height:6px;"));
    card.appendChild(btn("leave", BTN2, function () { send({ type: "leave" }); room = null; renderHome(); }));
    card.appendChild(el("div", "font:600 13px system-ui;opacity:.7;margin-top:10px;", "share code " + room.code + " · mode: " + room.mode));
    addMsg();
  }

  function renderCountdown(n) {
    if (!ov) return; clearCard();
    card.appendChild(el("div", "font:800 26px system-ui;opacity:.85;margin-bottom:10px;", "get ready"));
    card.appendChild(el("div", "font:800 120px system-ui;", String(n)));
  }

  return {
    active: false,
    myCharacter: null,
    roomSnapshot: null,
    open: function () {
      // show "connecting..." on the menu button until the socket opens, then reveal the lobby
      var done = false, to = setTimeout(function () { if (!done) { if (Doodle.MP_onClose) Doodle.MP_onClose(); alert("Could not reach the multiplayer server."); } }, 6000);
      connect(function () { done = true; clearTimeout(to); openOverlay(); renderHome(); });
    },
    close: close,
    send: send,
    gameTick: gameTick, // game update() -> broadcast my score + climb-rail
    gameOver: gameOver, // game gameOver() -> report my fall
  };
})();
