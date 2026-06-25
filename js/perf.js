// Diagnostics overlay: shows the active renderer, the real GPU behind WebGL,
// and live FPS, so the cause of any slowness is visible. Press "D" to toggle.
//
// Why GPU matters: Phaser can report "WebGL" yet still be running on Chrome's
// SOFTWARE renderer (SwiftShader / "ANGLE ... Software"), which is slow and
// explains low FPS even on a near-static screen. The unmasked renderer string
// below tells us whether real hardware acceleration is active.
(function () {
  function detectGPU() {
    try {
      var c = document.createElement("canvas");
      var gl = c.getContext("webgl") || c.getContext("experimental-webgl");
      if (!gl) return "no WebGL context";
      var ext = gl.getExtension("WEBGL_debug_renderer_info");
      return ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : "GPU info blocked";
    } catch (e) {
      return "GPU detect failed";
    }
  }

  function start() {
    var game = window.Doodle && window.Doodle.game;
    if (!game || !game.isBooted) return window.setTimeout(start, 200);
    game.time.advancedTiming = true;

    var renderer =
      game.renderType === Phaser.WEBGL
        ? "WebGL"
        : game.renderType === Phaser.CANVAS
        ? "Canvas (slow!)"
        : "Headless";
    var gpu = detectGPU();
    var software = /swiftshader|software|llvmpipe|microsoft basic/i.test(gpu);

    var box = document.createElement("div");
    box.style.cssText =
      "position:fixed;top:6px;left:6px;z-index:9999;font:11px/1.4 monospace;" +
      "color:#0f0;background:rgba(0,0,0,.7);padding:4px 7px;border-radius:4px;" +
      "pointer-events:none;white-space:pre;max-width:260px";
    document.body.appendChild(box);

    document.addEventListener("keydown", function (e) {
      if (e.key === "d" || e.key === "D")
        box.style.display = box.style.display === "none" ? "block" : "none";
    });

    window.setInterval(function () {
      box.innerHTML =
        "renderer: " + renderer + "\n" +
        "gpu: " + gpu + (software ? "  ⚠ SOFTWARE" : "") + "\n" +
        "fps: " + (game.time.fps || 0) + "   (press D to hide)";
    }, 250);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start);
  else start();
})();
