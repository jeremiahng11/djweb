// A small re-implementation of pygame.Rect so the gameplay code can be ported
// from the Python original almost line-for-line. Stores top-left (x, y) plus
// width/height, and exposes the same derived properties (center, top, bottom,
// left, right, centerx, centery) with working setters.
(function (DJ) {
  // Gameplay scale: themed art is half the classic size, so render + collide
  // world sprites (platforms, tiles, enemies, power-up pickups) at 2x.
  DJ.GS = 2;
  // Player scale: the classic doodler is ~half a platform's width, so the
  // doodler stays near native size (smaller than the 2x world sprites).
  DJ.PS = 1.3;
  class Rect {
    constructor(x = 0, y = 0, w = 0, h = 0) {
      this.x = x;
      this.y = y;
      this.width = w;
      this.height = h;
    }
    // --- derived edges ---
    get left() { return this.x; }
    set left(v) { this.x = v; }
    get top() { return this.y; }
    set top(v) { this.y = v; }
    get right() { return this.x + this.width; }
    set right(v) { this.x = v - this.width; }
    get bottom() { return this.y + this.height; }
    set bottom(v) { this.y = v - this.height; }
    get centerx() { return this.x + this.width / 2; }
    set centerx(v) { this.x = v - this.width / 2; }
    get centery() { return this.y + this.height / 2; }
    set centery(v) { this.y = v - this.height / 2; }
    get center() { return [this.centerx, this.centery]; }
    set center(v) { this.centerx = v[0]; this.centery = v[1]; }
    get topleft() { return [this.x, this.y]; }
    set topleft(v) { this.x = v[0]; this.y = v[1]; }

    move_ip(dx, dy) { this.x += dx; this.y += dy; }

    colliderect(o) {
      return (
        this.x < o.x + o.width &&
        this.x + this.width > o.x &&
        this.y < o.y + o.height &&
        this.y + this.height > o.y
      );
    }
    collidepoint(px, py) {
      return px >= this.x && px < this.x + this.width &&
             py >= this.y && py < this.y + this.height;
    }
    copy() { return new Rect(this.x, this.y, this.width, this.height); }
  }
  DJ.Rect = Rect;
  // Gameplay rect: collision box scaled by GS, positioned later via center.
  DJ.grect = function (x, y, w, h) { return new Rect(x, y, w * DJ.GS, h * DJ.GS); };
  // Player rect: scaled by PS.
  DJ.prect = function (x, y, w, h) { return new Rect(x, y, w * DJ.PS, h * DJ.PS); };
})(window.DJ = window.DJ || {});
