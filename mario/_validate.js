/* 关卡几何验证：沟壑宽度、跳跃高度、敌人落点 */
var fs = require("fs");
function mkCanvas() { var c = { width: 300, height: 150, style: {} }; c.getContext = function () { return mkCtx(); }; return c; }
function mkCtx() {
  var o = {}; var noop = function () { };
  return new Proxy(o, { get: function (t, k) { if (k in t) return t[k]; return noop; }, set: function (t, k, v) { t[k] = v; return true; } });
}
function mkEl(id) {
  return { id: id, style: {}, textContent: "", innerHTML: "", classList: { add: function () { }, remove: function () { } }, addEventListener: function () { }, querySelector: function () { return mkEl(id + "x"); } };
}
global.window = { addEventListener: function () { }, innerWidth: 1280, innerHeight: 900 };
global.document = { getElementById: function (id) { return id === "cv" ? mkCanvas() : mkEl(id); }, createElement: function () { return mkCanvas(); } };
global.requestAnimationFrame = function () { };
global.setInterval = function () { return 0; };
global.clearInterval = function () { };

var src = fs.readFileSync("_check.js", "utf8").replace('"use strict";', "");
(0, eval)(src);

/* 最大跳跃能力估算 */
/* 站立跳: v=4.35, 按住重力0.165 → 高度 4.35^2/(2*0.165) = 57px (3.6格)
   助跑跳: v=5.10 → 高度 78px (4.9格)，滞空 ≈ 50 帧
   助跑速度 2.60 px/帧 → 水平 130px ≈ 8.1格 (安全值按 5.5 格算) */
var MAX_JUMP_UP = 4.0;   /* 可稳定跳上的格数 */
var SAFE_GAP = 5.0;      /* 可稳定跨越的沟壑格数 */

var problems = [];
LEVELS.forEach(function (def, li) {
  LEVEL_PIRANHA = [];
  var lvl = buildLevel(def);
  var w = lvl.w;
  var rowOf = [], surf = [];
  for (var x = 0; x < w; x++) {
    var top = -1, y;
    for (y = 0; y < ROWS; y++) { if (SOLID[lvl.grid[y * w + x]]) { top = y; break; } }
    rowOf.push(top);
    /* 从地面向上连续实心的顶部（玩家可站立的地面高度） */
    var yy = 14, found = false;
    while (yy >= 3 && SOLID[lvl.grid[yy * w + x]]) { found = true; yy--; }
    surf.push(found ? yy : -1);
  }
  /* 1) 沟壑宽度（完全没有落脚点的列） */
  var run = 0, runStart = -1;
  for (x = 0; x < w; x++) {
    var isPit = (rowOf[x] < 0) || (rowOf[x] > 14);
    if (isPit) { if (run === 0) runStart = x; run++; }
    else {
      if (run > SAFE_GAP) problems.push(def.name + ": 沟壑 " + runStart + "-" + (x - 1) + " 宽 " + run + " 格（> " + SAFE_GAP + "）");
      run = 0;
    }
  }
  if (run > SAFE_GAP) problems.push(def.name + ": 末尾沟壑宽 " + run);
  /* 2) 相邻落脚点高差（只看地面层） */
  var prev = -1, prevX = -1;
  for (x = 0; x < w; x++) {
    if (surf[x] < 0) continue;
    if (prev >= 0 && surf[x] < prev - 5)
      problems.push(def.name + ": x=" + x + " 前方墙体过高 " + (prev - surf[x]) + " 格");
    prev = surf[x]; prevX = x;
  }
  /* 3) 敌人落点 */
  (def.enemies || []).forEach(function (e) {
    var r = surfaceRow(lvl, e[1]);
    if (r >= ROWS) problems.push(def.name + ": 敌人 " + e[0] + " 在 x=" + e[1] + " 无落脚点");
  });
  /* 4) 水管/台阶位于地面之上 */
  (def.pipes || []).forEach(function (p) {
    if (rowOf[p[0]] > 14 || rowOf[p[1]] > 14) problems.push(def.name + ": 水管 x=" + p[0] + " 悬空");
  });
  /* 5) 旗杆与城堡在界内且在屏幕内可见 */
  var camMax = w * 16 - 256;
  if (def.flag !== undefined) {
    if (def.flag * 16 < camMax) problems.push(def.name + ": 旗杆在最后一次镜头之外");
    if (rowOf[def.flag] > 14) problems.push(def.name + ": 旗杆下方是坑");
  }
  if (def.castle !== undefined && def.castle * 16 + 80 > w * 16) problems.push(def.name + ": 城堡超出边界");
  /* 6) 斧头必须站在实地上 */
  if (def.axe !== undefined && surf[def.axe] < 0) problems.push(def.name + ": 斧头悬空");

  console.log(def.name, "宽度", w, "| 沟壑数", (function () { var c = 0, rr = 0; for (var i = 0; i < w; i++) { var p = rowOf[i] < 0 || rowOf[i] > 14; if (p && !rr) c++; rr = p; } return c; })(),
    "| 敌人", (def.enemies || []).length, "| 方块", (def.blocks || []).length, "| 镜头终点", camMax);
});
console.log(problems.length ? ("\n发现问题:\n" + problems.join("\n")) : "\n=== 关卡几何检查通过 ===");
