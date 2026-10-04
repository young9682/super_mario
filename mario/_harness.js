/* 无头测试台：桩化 DOM，运行游戏逻辑，检查异常 */
var handlers = {};
function mkCanvas() {
  var c = { width: 300, height: 150, style: {} };
  c.getContext = function () { return mkCtx(); };
  return c;
}
function mkCtx() {
  var o = { canvas: { width: 768, height: 720 } };
  var noop = function () { };
  return new Proxy(o, {
    get: function (t, k) { if (k in t) return t[k]; return noop; },
    set: function (t, k, v) { t[k] = v; return true; }
  });
}
function mkEl(id) {
  var e = {
    id: id, style: {}, textContent: "", innerHTML: "",
    classList: { add: function () { }, remove: function () { }, contains: function () { return false; } },
    addEventListener: function (t, f) { (handlers[id + ":" + t] = handlers[id + ":" + t] || []).push(f); },
    querySelector: function () { return mkEl(id + ">child"); }
  };
  return e;
}
global.window = {
  addEventListener: function (t, f) { (handlers["win:" + t] = handlers["win:" + t] || []).push(f); },
  innerWidth: 1280, innerHeight: 900, devicePixelRatio: 1
};
global.document = {
  getElementById: function (id) { return id === "cv" ? mkCanvas() : mkEl(id); },
  createElement: function (t) { return mkCanvas(); }
};
global.requestAnimationFrame = function () { };
global.setInterval = function () { return 0; };
global.clearInterval = function () { };
global.navigator = { userAgent: "node" };

var errors = [];
function fire(type, code) {
  var hs = handlers["win:" + type] || [];
  for (var i = 0; i < hs.length; i++) {
    try { hs[i]({ code: code, repeat: false, preventDefault: function () { } }); }
    catch (e) { errors.push(type + " " + code + ": " + e.message); }
  }
}

/* ---- 载入游戏代码 ---- */
var fs = require("fs");
var src = fs.readFileSync("_check.js", "utf8").replace('"use strict";', "");
try {
  (0, eval)(src);
} catch (e) {
  console.log("LOAD ERROR:", e.message, e.stack);
  process.exit(1);
}
console.log("loaded ok, state=", game.state);

/* ---- 驱动 ---- */
function step(n, keys, label) {
  for (var i = 0; i < n; i++) {
    for (var k in keys) {
      if (keys[k] === 1) fire("keydown", k);
      else fire("keyup", k);
    }
    try { update(); } catch (e) { errors.push(label + " update#" + i + ": " + e.message + " | " + e.stack.split("\n")[1]); if (errors.length > 6) return; }
    try { render(); } catch (e) { errors.push(label + " render#" + i + ": " + e.message + " | " + e.stack.split("\n")[1]); if (errors.length > 6) return; }
  }
}

fire("keydown", "Enter"); fire("keyup", "Enter");
step(30, {}, "title");

var RIGHT = { ArrowRight: 1 }, JUMPR = { ArrowRight: 1, Space: 1 }, RUNR = { ArrowRight: 1, ShiftLeft: 1 };
step(120, RIGHT, "ready");
for (var round = 0; round < 40; round++) {
  step(45, RIGHT, "walk" + round);
  step(30, JUMPR, "jump" + round);
  step(20, RUNR, "run" + round);
  if (errors.length > 6) break;
}
console.log("after lvl0: levelIndex=", game.levelIndex, "state=", game.state, "x=", (player && player.x.toFixed(1)), "score=", game.score);

/* 逐关强制测试 */
for (var L = 1; L < LEVELS.length; L++) {
  try { loadLevel(L); game.state = "play"; } catch (e) { errors.push("loadLevel" + L + ": " + e.message); }
  for (var r2 = 0; r2 < 60; r2++) {
    step(30, RIGHT, "L" + L + "w" + r2);
    step(25, JUMPR, "L" + L + "j" + r2);
    if (errors.length > 6) break;
  }
  console.log("lvl", L, "state=", game.state, "x=", (player && player.x.toFixed(1)), "enemies=", enemies.length, "bows=", bowser ? bowser.hp : "-");
  if (errors.length > 6) break;
}

/* 死亡 / 通关流程 */
try {
  loadLevel(0); game.state = "play";
  playerDie();
  for (var d = 0; d < 200; d++) { update(); render(); }
  console.log("after death lives=", game.lives, "state=", game.state);
} catch (e) { errors.push("death: " + e.message + " " + e.stack.split("\n")[1]); }

console.log(errors.length ? ("ERRORS(" + errors.length + "):\n" + errors.slice(0, 8).join("\n")) : "=== NO ERRORS ===");
