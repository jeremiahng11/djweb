var Doodle = Doodle || {};

// Responsive height: match the device aspect so the game FILLS the screen (no letterbox bars).
// Width stays 635 (gameplay is balanced around it); height grows on tall phones -> more vertical room.
var _djW = 635, _djH = 955;
try {
  // match the ACTUAL viewport aspect so the game fills the screen exactly under SHOW_ALL.
  // (window.screen misreports aspect on some phones -> too-short canvas + black band; innerHeight is the real viewport.)
  // EXACT_FIT stretches to fill, so just match the viewport aspect to avoid distortion (no safe-area padding here)
  var _sw = window.innerWidth || 393, _sh = window.innerHeight || 852;
  _djH = Math.max(955, Math.min(1800, Math.round(_djW * (_sh / _sw))));
} catch (e) {}
Doodle.game = new Phaser.Game(_djW, _djH, Phaser.AUTO);
Doodle.game.state.add("Boot", Doodle.BootState);
Doodle.game.state.add("Preload", Doodle.PreloadState);
Doodle.game.state.add("Game", Doodle.GameState);
Doodle.game.state.add("Menu", Doodle.MenuState);
Doodle.game.state.add("Settings", Doodle.SettingsState);
Doodle.game.state.add("Calibrate", Doodle.CalibrateState);
Doodle.game.state.add("Scores", Doodle.ScoresState);
if (Doodle.ThemeState) Doodle.game.state.add("Themes", Doodle.ThemeState);
if (Doodle.SuitState) Doodle.game.state.add("Suits", Doodle.SuitState);

// DIAGNOSTIC: surface the REAL error from any state method (Safari masks
// window.onerror to "Script error." on file://; try/catch sees the true message).
try {
  var _states = Doodle.game.state.states;
  for (var _name in _states) {
    (function (name) {
      ["init", "preload", "create", "update", "render"].forEach(function (fn) {
        var orig = _states[name][fn];
        if (typeof orig === "function") {
          _states[name][fn] = function () {
            try { return orig.apply(this, arguments); }
            catch (e) {
              if (Doodle._show) Doodle._show("ERR " + name + "." + fn + ": " + (e && e.message ? e.message : e) +
                (e && e.stack ? "\n" + String(e.stack).split("\n").slice(0, 3).join("\n") : ""));
              throw e;
            }
          };
        }
      });
    })(_name);
  }
} catch (e) { if (Doodle._show) Doodle._show("wrap: " + e.message); }

Doodle.game.state.start("Boot");