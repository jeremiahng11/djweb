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
      else if (m.type === "room") { room = m.room; render(); }
      else if (m.type === "error") { setMsg(m.error); }
      else if (m.type === "countdown") { renderCountdown(m.n); }
      else if (m.type === "start") { startRace(); }
      else if (m.type === "players") { emit("players", m.players); }
    };
  }

  function startRace() {
    // phase 2 will render opponents; for now close the lobby and start the game with the MP context set
    Doodle.MP.active = true;
    Doodle.MP.roomSnapshot = room;
    close();
    emit("start", room);
    try { if (Doodle.game) Doodle.game.state.start("Game"); } catch (e) {}
  }

  // ---- UI ----------------------------------------------------------------
  function el(tag, css, txt) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }
  var BTN = "display:inline-block;font:700 20px system-ui,sans-serif;background:#fff;color:#404a59;padding:11px 26px;margin:7px;border-radius:22px;cursor:pointer;-webkit-tap-highlight-color:transparent;";
  var BTN2 = "display:inline-block;font:600 16px system-ui,sans-serif;background:rgba(255,255,255,.16);color:#fff;padding:9px 18px;margin:5px;border-radius:18px;cursor:pointer;border:1px solid rgba(255,255,255,.4);";
  var msgEl = null;
  function setMsg(t) { if (msgEl) { msgEl.textContent = t || ""; if (t) setTimeout(function () { if (msgEl && msgEl.textContent === t) msgEl.textContent = ""; }, 3500); } }

  function openOverlay() {
    if (ov) return;
    ov = el("div", "position:fixed;inset:0;z-index:99999;background:#404a59;color:#fff;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;overflow:auto;");
    card = el("div", "width:min(460px,92vw);text-align:center;padding:18px;");
    ov.appendChild(card); document.body.appendChild(ov);
  }
  function close() { if (ov) { document.body.removeChild(ov); ov = null; card = null; msgEl = null; } }
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
      var pic = el("div", "width:54px;height:52px;margin:0 auto 3px;background:url('static/images/PlayerSheets/" + ch + ".png') no-repeat 0 0;background-size:54px auto;");
      tile.appendChild(pic); tile.appendChild(el("div", "", ch));
      if (!isTaken) tile.onclick = function () { send({ type: "pick", character: ch }); };
      grid.appendChild(tile);
    });
    card.appendChild(grid);
    // ready + start
    var meP = me();
    card.appendChild(btn(meP && meP.ready ? "ready ✓ (tap to unready)" : "ready up", BTN, function () { send({ type: "ready", ready: !(meP && meP.ready) }); }));
    if (isHost()) card.appendChild(btn("start game", BTN, function () { send({ type: "start" }); }));
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
    roomSnapshot: null,
    open: function () { openOverlay(); renderHome(); },
    close: close,
    send: send,
  };
})();
