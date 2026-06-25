var Doodle = Doodle || {};

// Responsive height: match the device aspect so the game FILLS the screen (no letterbox bars).
// Width stays 635 (gameplay is balanced around it); height grows on tall phones -> more vertical room.
var _djW = 635, _djH = 955;
try {
  // Measure the FULL-SCREEN parent (#gameParent is sized to 100vh) rather than window.innerHeight,
  // which iOS reports short of the physical screen -> that shortfall was the black band at the bottom.
  // EXACT_FIT then stretches the canvas to fill the parent exactly; matching the aspect avoids distortion.
  var _gp = document.getElementById("gameParent");
  var _sw = (_gp && _gp.offsetWidth) || window.innerWidth || 393;
  var _sh = (_gp && _gp.offsetHeight) || window.innerHeight || 852;
  _djH = Math.max(955, Math.min(1800, Math.round(_djW * (_sh / _sw))));
} catch (e) {}
Doodle.game = new Phaser.Game(_djW, _djH, Phaser.AUTO, "gameParent");
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