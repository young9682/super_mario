/* 让一个"会看路"的机器人试跑每一关，验证可通过性 */
var fs = require("fs");
function mkCanvas() { var c = { width: 300, height: 150, style: {} }; c.getContext = function () { return mkCtx(); }; return c; }
function mkCtx() { var o = {}; var noop = function () { }; return new Proxy(o, { get: function (t, k) { return (k in t) ? t[k] : noop; }, set: function (t, k, v) { t[k] = v; return true; } }); }
function mkEl(id) { return { id: id, style: {}, textContent: "", innerHTML: "", classList: { add: function () { }, remove: function () { } }, addEventListener: function () { }, querySelector: function () { return mkEl(id + "x"); } }; }
global.window = { addEventListener: function () { }, innerWidth: 1280, innerHeight: 900 };
global.document = { getElementById: function (id) { return id === "cv" ? mkCanvas() : mkEl(id); }, createElement: function () { return mkCanvas(); } };
global.requestAnimationFrame = function () { };
global.setInterval = function () { return 0; };
global.clearInterval = function () { };

var src = fs.readFileSync("_check.js", "utf8").replace('"use strict";', "");
(0, eval)(src);

function botWantsJump(p, lvl) {
  var look = Math.max(6, Math.abs(p.vx) * 13);
  var col = Math.floor((p.x + p.w + look) / TS), k;
  for (k = Math.floor(p.y / TS); k <= Math.floor((p.y + p.h - 1) / TS); k++) if (solidAt(lvl, col, k)) return true;
  for (var dx = 1; dx <= 4; dx++) {
    var c = Math.floor((p.x + p.w) / TS) + dx, has = false;
    for (var y = Math.floor((p.y + p.h) / TS); y < ROWS; y++) if (solidAt(lvl, c, y)) { has = true; break; }
    if (!has) return true;
  }
  return false;
}

var report = [];
LEVELS.forEach(function (def, li) {
  loadLevel(li);
  game.state = "play";
  var maxX = 0, falls = 0, stuck = 0, frames = 0, done = false, lastX = 0, hold = 0;
  while (frames < 12000 && !done) {
    var p = player;
    if (p && !p.dead) {
      p.star = 600;
      KEY.right = 1; KEY.run = 1; KEY.left = 0;
      if (p.onGround && hold === 0 && botWantsJump(p, game.level)) { KEY.jumpEdge = 1; hold = 34; }
      if (hold > 0) { KEY.jump = 1; hold--; } else KEY.jump = 0;
    }
    try { update(); render(); } catch (e) { report.push(def.name + " 异常: " + e.message + " @ " + e.stack.split("\n")[1]); break; }
    frames++;
    if (player && player.x > maxX) maxX = player.x;
    if (player && player.y > VH + 10) {
      falls++;
      if (falls > 14) { report.push(def.name + " 掉坑过多"); break; }
      loadLevel(li); game.state = "play"; hold = 0; continue;
    }
    if (game.state === "flag" || game.state === "complete" || game.state === "win") done = true;
    if (Math.abs(maxX - lastX) < 0.4) stuck++; else stuck = 0;
    lastX = maxX;
    if (stuck > 900) { report.push(def.name + " 在 x=" + maxX.toFixed(0) + " (列 " + Math.floor(maxX / 16) + ") 卡住"); break; }
  }
  var endX = (def.flag !== undefined) ? def.flag * 16 : (def.bridge ? def.bridge[1] * 16 : def.width * 16);
  report.push(def.name + "  终点x=" + endX + "  到达x=" + maxX.toFixed(0) +
    "  用时" + frames + "帧  掉坑" + falls + "次  " + (maxX >= endX - 130 ? ">>> 通过" : ">>> 未通过"));
});
console.log(report.join("\n"));
