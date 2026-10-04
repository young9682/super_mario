/* 自研迷你 Canvas + PNG 导出，用于在无浏览器环境下目视检查画面 */
var fs = require("fs"), zlib = require("zlib");

/* ---------- 迷你 2D 画布 ---------- */
function parseColor(c) {
  if (!c || c === "transparent") return null;
  if (c.charAt(0) === "#") {
    if (c.length === 4) return [parseInt(c[1] + c[1], 16), parseInt(c[2] + c[2], 16), parseInt(c[3] + c[3], 16), 255];
    return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16), 255];
  }
  var m = /rgba?\(([^)]+)\)/.exec(c);
  if (m) {
    var p = m[1].split(",").map(function (s) { return parseFloat(s); });
    return [p[0] | 0, p[1] | 0, p[2] | 0, Math.round((p.length > 3 ? p[3] : 1) * 255)];
  }
  return [255, 0, 255, 255];
}
function mapply(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
function mmul(a, b) {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
          a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
          a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}
function minv(m) {
  var det = m[0] * m[3] - m[1] * m[2];
  if (!det) return null;
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
          (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
}
function MCanvas(w, h) { this.width = w; this.height = h; this.style = {}; this.data = new Uint8ClampedArray(w * h * 4); }
MCanvas.prototype.getContext = function () { if (!this._c) this._c = new MCtx(this); return this._c; };
function MCtx(cv) {
  this.canvas = cv; this.fillStyle = "#000000"; this.font = ""; this.textAlign = "left";
  this.textBaseline = "top"; this.imageSmoothingEnabled = false;
  this.m = [1, 0, 0, 1, 0, 0]; this.stack = []; this._clip = null;
}
MCtx.prototype.save = function () { this.stack.push(this.m.slice().concat(this._clip ? this._clip.slice() : [])); };
MCtx.prototype.restore = function () {
  var s = this.stack.pop(); if (!s) return;
  this.m = s.slice(0, 6); this._clip = s.length > 6 ? s.slice(6) : null;
};
MCtx.prototype.setTransform = function (a, b, c, d, e, f) { this.m = [a, b, c, d, e, f]; };
MCtx.prototype.translate = function (x, y) { this.m = mmul(this.m, [1, 0, 0, 1, x, y]); };
MCtx.prototype.scale = function (x, y) { this.m = mmul(this.m, [x, 0, 0, y, 0, 0]); };
MCtx.prototype.rotate = function (t) { this.m = mmul(this.m, [Math.cos(t), Math.sin(t), -Math.sin(t), Math.cos(t), 0, 0]); };
MCtx.prototype.beginPath = function () { this.path = null; };
MCtx.prototype.rect = function (x, y, w, h) { this.path = [x, y, w, h]; };
MCtx.prototype.clip = function () { this._clip = this.path ? this.path.slice() : null; };
MCtx.prototype.clearRect = function (x, y, w, h) {
  var im = minv(this.m); if (!im) return;
  var c = this.canvas, d = c.data;
  var x0 = Math.max(0, Math.floor(Math.min(...[x, x + w].map(function (v) { return mapply(this.m, v, y)[0]; }.bind(this))))), x1;
  for (var py = 0; py < c.height; py++) for (var px = 0; px < c.width; px++) {
    var p = mapply(im, px + 0.5, py + 0.5);
    if (p[0] >= x && p[0] < x + w && p[1] >= y && p[1] < y + h) { var i = (py * c.width + px) * 4; d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; }
  }
};
MCtx.prototype.fillRect = function (x, y, w, h) {
  if (!(w > 0) || !(h > 0)) return;
  var col = parseColor(this.fillStyle); if (!col) return;
  var c = this.canvas, d = c.data, im = minv(this.m); if (!im) return;
  var cs = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(function (p) { return mapply(this.m, p[0], p[1]); }.bind(this));
  var xs = cs.map(function (p) { return p[0]; }), ys = cs.map(function (p) { return p[1]; });
  var bx0 = Math.max(0, Math.floor(Math.min.apply(null, xs))), bx1 = Math.min(c.width, Math.ceil(Math.max.apply(null, xs)));
  var by0 = Math.max(0, Math.floor(Math.min.apply(null, ys))), by1 = Math.min(c.height, Math.ceil(Math.max.apply(null, ys)));
  var cl = this._clip;
  for (var py = by0; py < by1; py++) {
    for (var px = bx0; px < bx1; px++) {
      var p = mapply(im, px + 0.5, py + 0.5);
      if (!(p[0] >= x && p[0] < x + w && p[1] >= y && p[1] < y + h)) continue;
      if (cl && !(p[0] >= cl[0] && p[0] < cl[0] + cl[2] && p[1] >= cl[1] && p[1] < cl[1] + cl[3])) continue;
      var i = (py * c.width + px) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
};
MCtx.prototype.drawImage = function (img, dx, dy) {
  var c = this.canvas, d = c.data, im = minv(this.m); if (!im) return;
  var cs = [[dx, dy], [dx + img.width, dy], [dx, dy + img.height], [dx + img.width, dy + img.height]]
    .map(function (p) { return mapply(this.m, p[0], p[1]); }.bind(this));
  var xs = cs.map(function (p) { return p[0]; }), ys = cs.map(function (p) { return p[1]; });
  var bx0 = Math.max(0, Math.floor(Math.min.apply(null, xs))), bx1 = Math.min(c.width, Math.ceil(Math.max.apply(null, xs)));
  var by0 = Math.max(0, Math.floor(Math.min.apply(null, ys))), by1 = Math.min(c.height, Math.ceil(Math.max.apply(null, ys)));
  var cl = this._clip, sd = img.data;
  for (var py = by0; py < by1; py++) {
    for (var px = bx0; px < bx1; px++) {
      var p = mapply(im, px + 0.5, py + 0.5);
      var sx = Math.floor(p[0] - dx), sy = Math.floor(p[1] - dy);
      if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) continue;
      if (cl && !(p[0] >= cl[0] && p[0] < cl[0] + cl[2] && p[1] >= cl[1] && p[1] < cl[1] + cl[3])) continue;
      var si = (sy * img.width + sx) * 4;
      if (sd[si + 3] === 0) continue;
      var i = (py * c.width + px) * 4;
      d[i] = sd[si]; d[i + 1] = sd[si + 1]; d[i + 2] = sd[si + 2]; d[i + 3] = 255;
    }
  }
};
MCtx.prototype.fillText = function () { };
MCtx.prototype.measureText = function () { return { width: 10 }; };

/* ---------- PNG 输出 ---------- */
var CRCT = (function () {
  var t = new Int32Array(256);
  for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(buf) {
  var c = 0xFFFFFFFF;
  for (var i = 0; i < buf.length; i++) c = CRCT[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  var len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  var t = Buffer.from(type, "ascii");
  var crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function savePNG(canvas, path) {
  var w = canvas.width, h = canvas.height, d = canvas.data;
  var raw = Buffer.alloc((w * 4 + 1) * h);
  for (var y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (var x = 0; x < w * 4; x++) raw[y * (w * 4 + 1) + 1 + x] = d[y * w * 4 + x];
  }
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  var png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
  fs.writeFileSync(path, png);
  console.log("saved", path, w + "x" + h);
}

/* ---------- 环境桩 ---------- */
var mainCanvas = null;
function mkCanvas(w, h) { return new MCanvas(w || 300, h || 150); }
function mkEl(id) { return { id: id, style: {}, textContent: "", innerHTML: "", classList: { add: function () { }, remove: function () { } }, addEventListener: function () { }, querySelector: function () { return mkEl(id + "x"); } }; }
global.window = { addEventListener: function () { }, innerWidth: 1280, innerHeight: 900 };
global.document = {
  getElementById: function (id) { if (id === "cv") { mainCanvas = mkCanvas(768, 720); return mainCanvas; } return mkEl(id); },
  createElement: function () { return mkCanvas(); }
};
global.requestAnimationFrame = function () { };
global.setInterval = function () { return 0; };
global.clearInterval = function () { };

var src = fs.readFileSync("_check.js", "utf8").replace('"use strict";', "");
(0, eval)(src);

/* ---------- 精灵总览图 ---------- */
(function spriteSheet() {
  var cv2 = new MCanvas(760, 900);
  var oldCtx = ctx, oldCv = cv;
  ctx = cv2.getContext("2d"); cv = cv2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#2a2a44"; ctx.fillRect(0, 0, 760, 900);
  var items = [];
  ["stand", "walk0", "walk1", "walk2", "jump", "skid", "dead"].forEach(function (k) {
    items.push(["S_" + k, SMALL[k]]); items.push(["B_" + k, BIG[k]]);
  });
  items.push(["koopa0", SPR.koopa[0]]); items.push(["koopa1", SPR.koopa[1]]);
  items.push(["shell", SPR.shell[0]]);
  items.push(["goomba0", SPR.goomba[0]]); items.push(["goomba1", SPR.goomba[1]]);
  items.push(["goomFlat", SPR.goombaFlat]);
  items.push(["mushroom", SPR.mushroom]); items.push(["1up", SPR.mushroom1up]);
  items.push(["flower", SPR.flower]); items.push(["star", SPR.star]);
  items.push(["coinA", SPR.coin[0]]); items.push(["coinB", SPR.coin[1]]);
  items.push(["coinC", SPR.coin[2]]);
  items.push(["piranha0", SPR.piranha[0]]); items.push(["piranha1", SPR.piranha[1]]);
  items.push(["koopaR0", SPR.koopaR[0]]);
  items.push(["fireA", { r: SPR.fireball[0] }]); items.push(["fireC", { r: SPR.fireball[2] }]);
  var Z = 4, cols = 9, cellW = 80, cellH = 150;
  for (var i = 0; i < items.length; i++) {
    var it = items[i], img = it[1].r;
    var cx = (i % cols) * cellW, cy = Math.floor(i / cols) * cellH;
    ctx.fillStyle = "#3a3a5c"; ctx.fillRect(cx + 2, cy + 2, cellW - 4, cellH - 4);
    ctx.drawImageScaled = null;
    ctx.save();
    ctx.translate(cx + (cellW - img.width * Z) / 2, cy + cellH - 20 - img.height * Z);
    ctx.scale(Z, Z);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
    ctx.fillStyle = "#ffe060";
    for (var k = 0; k < it[0].length; k++) {
      ctx.fillRect(cx + 6 + k * 6, cy + cellH - 14, 4, 8);
    }
  }
  ctx = oldCtx; cv = oldCv;
  savePNG(cv2, "shot_sprites.png");
})();

/* ---------- 每关整幅地图 ---------- */
LEVELS.forEach(function (def, li) {
  loadLevel(li);
  game.state = "play";
  player.x = 40; player.y = 13 * TS - 15; game.camX = 0;
  enemies.forEach(function (e) { e.active = true; });
  if (bowser) bowser.active = true;
  var lvl = game.level;
  var W = lvl.w * 16;
  var shot = new MCanvas(W, 240);
  var oc = ctx, ov = cv, ovw = VW, os = S;
  cv = shot; ctx = shot.getContext("2d"); VW = W; S = 1;
  try { render(); } catch (e) { console.log("render err", e.message); }
  /* 第二行：把玩家/相机恢复为横版视角的另一种取样（裁剪中间段） */
  ctx = oc; cv = ov; VW = ovw; S = os;
  savePNG(shot, "shot_map_" + def.name + ".png");
});

/* ---------- 单屏实景（256x240，放大 3 倍） ---------- */
function shotWindow(label, li, camX, opt) {
  opt = opt || {};
  loadLevel(li);
  game.state = "play";
  player.x = opt.px !== undefined ? opt.px : camX + 40;
  player.y = opt.py !== undefined ? opt.py : 13 * TS - 15;
  if (opt.big) { player.h = 30; player.y = 13 * TS - 30; }
  if (opt.power) player.power = opt.power;
  if (opt.star) player.star = 400;
  player.faceLeft = !!opt.faceLeft;
  if (opt.vx) { player.vx = opt.vx; player.animTimer = opt.anim || 1.4; }
  if (opt.dead) player.dead = true;
  game.camX = camX;
  enemies.forEach(function (e) { e.active = true; e.anim = 1; });
  if (bowser) bowser.anim = 1;
  if (opt.flag) { game.flagActive = true; game.flagY = 120; }
  game.tick = opt.tick || 20;
  var Z = 3;
  var shot = new MCanvas(256 * Z, 240 * Z);
  var oc = ctx, ov = cv, ovw = VW, os = S;
  cv = shot; ctx = shot.getContext("2d"); VW = 256; S = Z;
  try { render(); } catch (e) { console.log("render err", label, e.message); }
  ctx = oc; cv = ov; VW = ovw; S = os;
  savePNG(shot, "shot_" + label + ".png");
}
shotWindow("w11_start", 0, 0, { px: 40, vx: 1.4, anim: 1.2 });
shotWindow("w11_pipes", 0, 24 * 16 - 40, { px: 24 * 16 - 20, vx: 1.5, anim: 0.6 });
shotWindow("w11_mid", 0, 90 * 16, { px: 90 * 16 + 20, big: true, power: "big", vx: 2.4 });
shotWindow("w11_end", 0, 212 * 16 - 256, { px: 196 * 16, flag: true });
shotWindow("w12_under", 1, 18 * 16, { px: 18 * 16 + 30, big: true, power: "fire", vx: 1.8 });
shotWindow("w12_mid", 1, 86 * 16 - 60, { px: 86 * 16 - 30, big: true });
shotWindow("w13_sky", 2, 40 * 16, { px: 40 * 16 + 20, vx: 2.2, anim: 2.5 });
shotWindow("w13_mid", 2, 118 * 16 - 80, { px: 118 * 16, big: true });
shotWindow("w14_castle", 3, 60 * 16, { px: 60 * 16 + 20, big: true, power: "fire" });
shotWindow("w14_bowser", 3, 136 * 16, { px: 136 * 16, big: true, power: "fire", star: false });
shotWindow("w11_koopa", 0, 60 * 16 - 110, { px: 60 * 16 - 70, big: true, power: "big", vx: 2.0 });
shotWindow("w11_star", 0, 110 * 16, { px: 110 * 16, star: true, big: true });
shotWindow("gameover_ready", 0, 0, { px: 40 });

/* ---------- 踩扁尸体贴地对照：左边活栗子怪 / 右边踩扁的尸体 ---------- */
(function () {
  loadLevel(0); game.state = "play";
  var g = enemies.filter(function (e) { return e.kind === "goomba"; })[0];
  enemies.forEach(function (e) { e.active = true; });
  var camX = Math.max(0, Math.round(g.x) - 100);
  game.camX = camX;
  var live = makeGoomba(g.x + 46, 13 * TS, false);
  live.active = true; live.anim = 0;
  enemies.push(live);
  stompEnemy(g);
  g.t = 8;
  console.log("踩扁对照: 盒高 h=" + g.h + " 底边=" + (g.y + g.h).toFixed(0) + " (地面线 208)");
  player.power = "big"; player.h = 30;
  player.x = g.x - 1;
  player.y = g.y + g.h - 30;     /* 与尸体同底边，模拟玩家贴着尸体站 */
  player.vx = 1.0; player.animTimer = 1.3;
  game.tick = 20;
  var Z = 3;
  var shot = new MCanvas(256 * Z, 240 * Z);
  var oc = ctx, ov = cv, ovw = VW, os = S;
  cv = shot; ctx = shot.getContext("2d"); VW = 256; S = Z;
  try { render(); } catch (e) { console.log("render err squash", e.message); }
  ctx = oc; cv = ov; VW = ovw; S = os;
  savePNG(shot, "shot_w11_squash.png");
})();
