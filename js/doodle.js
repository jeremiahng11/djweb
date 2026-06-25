var Doodle = Doodle || {};

// Responsive height: match the device aspect so the game FILLS the screen (no letterbox bars).
// Width stays 635 (gameplay is balanced around it); height grows on tall phones -> more vertical room.
var _djW = 635, _djH = 955;
var _gp = document.getElementById("gameParent");
try {
  // #gameParent is `position:fixed; inset:0` (no explicit height) -> it fills the fixed containing block, which under
  // viewport-fit=cover is the TRUE full screen incl. the home-indicator strip. (vh/dvh/lvh/innerHeight all read short.)
  var _sw = (_gp && _gp.offsetWidth) || window.innerWidth || 393;
  var _sh = (_gp && _gp.offsetHeight) || window.innerHeight || 852;
  _djH = Math.max(955, Math.min(1800, Math.round(_djW * (_sh / _sw))));
} catch (e) {}
Doodle.game = new Phaser.Game(_djW, _djH, Phaser.AUTO, "gameParent");
// re-fit the canvas to the host when the viewport settles after launch / on rotate
function _djOnResize() { try { if (Doodle.game && Doodle.game.scale) Doodle.game.scale.refresh(); } catch (e) {} }
window.addEventListener("resize", _djOnResize);
window.addEventListener("orientationchange", function () { setTimeout(_djOnResize, 300); });
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