/* 回归：马里奥的变身体型
   期望逻辑：小 --吃蘑菇--> 大 --受伤--> 小(短暂无敌) --再受伤--> 死(小体型) */
var fs = require("fs");
var bin = fs.readFileSync("_render.js", "utf8").split("/* ---------- 精灵总览图 ---------- */")[0];
eval(bin);

var fails = [];
function check(name, ok, extra) {
  console.log((ok ? "  [OK]   " : "  [FAIL] ") + name + (extra ? "  " + extra : ""));
  if (!ok) fails.push(name);
}
/* 复刻 drawPlayer 的体型选择，用于断言"画出来是高是矮" */
function drawnBig() {
  var big = player.h > 20;
  if (player.transform > 0) {
    var showTarget = Math.floor(player.transform / 4) % 2 === 0;
    big = showTarget ? (player.transformTo === "big") : (player.transformTo !== "big");
  }
  return big;
}
function snap(tag) {
  console.log("  " + tag + "  power=" + player.power + "  h=" + player.h +
    "  画面=" + (drawnBig() ? "大" : "小") + "  底边=" + (player.y + player.h).toFixed(0) +
    "  crouch=" + !!player.crouch + "  invuln=" + player.invuln + "  dead=" + player.dead);
}
function reset() {
  loadLevel(0); game.state = "play";
  player.power = "small"; player.h = 15; player.y = 13 * TS - 15;
  player.crouch = false; player.transform = 0; player.invuln = 0; player.dead = false;
  player.vx = 0; player.vy = 0; player.onGround = true;
  KEY.left = KEY.right = KEY.down = KEY.run = KEY.jump = 0;
}
function run(n) { for (var i = 0; i < n; i++) update(); }

console.log("=== A) 小马里奥吃蘑菇 -> 变大 ===");
reset(); snap("初始");
growPlayer("big"); run(50); snap("动画结束后");
check("吃蘑菇后变大", player.power === "big" && player.h === 30 && drawnBig());
check("变大过程脚底不穿地", Math.abs(player.y + player.h - 13 * TS) < 0.01);

console.log("\n=== B) 变大后第一次受伤 -> 变小（不再变回大的） ===");
hurtPlayer();
var hAtHit = player.h, bigAtHit = drawnBig();
snap("受伤瞬间");
var grewBack = -1;
for (var f = 0; f < 60; f++) { update(); if (grewBack < 0 && player.h > 20 && f > 2) grewBack = f; }
snap("动画结束后");
check("受伤瞬间变成小体型", hAtHit === 15 && !bigAtHit, "h=" + hAtHit);
check("★ 受伤后不会再变回大 Mario", grewBack < 0, grewBack >= 0 ? ("第 " + grewBack + " 帧变回 h=" + player.h) : "");
check("受伤后不会被顶成 h=30", player.h !== 30, "h=" + player.h);
check("受伤后落地贴地", Math.abs(player.y + player.h - 13 * TS) < 0.01);

console.log("\n=== C) 变小后第二次受伤 -> 死亡（小体型死亡图） ===");
player.invuln = 0;
hurtPlayer(); run(6); snap("死亡动画中");
check("第二次受伤即死亡", player.dead === true);
check("死亡时仍是小体型", player.h === 15 && !drawnBig());

console.log("\n=== D) 大马里奥蹲下时受伤 ===");
reset();
player.power = "big"; player.h = 30; player.y = 13 * TS - 30;
KEY.down = 1; run(3);
snap("蹲下");
check("蹲下时身高 16", player.h === 16);
check("蹲下时脚底仍贴地", Math.abs(player.y + player.h - 13 * TS) < 0.01);
KEY.down = 0;
hurtPlayer(); run(50); snap("受伤后");
check("蹲着受伤后变小而不是被顶回 30", player.h === 15, "h=" + player.h);
check("蹲姿标记已清除", !player.crouch);
check("蹲着受伤不穿地", Math.abs(player.y + player.h - 13 * TS) < 0.01);

console.log("\n=== E) 站起来仍然正常（蹲下功能没被改坏） ===");
reset();
player.power = "big"; player.h = 30; player.y = 13 * TS - 30;
KEY.down = 1; run(3);
var crouchH = player.h;
KEY.down = 0; run(3);
snap("站起");
check("按下蹲下", crouchH === 16);
check("松开恢复 30", player.h === 30, "h=" + player.h);
check("站起后脚底贴地", Math.abs(player.y + player.h - 13 * TS) < 0.01);

console.log("\n=== F) 受伤变小后再吃蘑菇 -> 再次变大 ===");
reset();
player.power = "big"; player.h = 30; player.y = 13 * TS - 30;
hurtPlayer(); run(50);
player.invuln = 0;
growPlayer("big"); run(50); snap("再吃蘑菇");
check("重新变大", player.power === "big" && player.h === 30 && drawnBig());

console.log("\n=== G) 闪烁过渡：变大/变小过程两种体型都出现过，且脚底一致 ===");
reset();
growPlayer("big");
var seenG = {}, bottomG = {};
for (f = 0; f < 44; f++) { seenG[drawnBig() ? "b" : "s"] = 1; bottomG[(player.y + player.h).toFixed(1)] = 1; update(); }
check("变大过程有大有小两帧", seenG.b && seenG.s);
check("变大过程脚底高度始终一致", Object.keys(bottomG).length === 1, Object.keys(bottomG).join(","));
reset();
player.power = "big"; player.h = 30; player.y = 13 * TS - 30;
hurtPlayer();
var seenS = {}, bottomS = {};
for (f = 0; f < 40; f++) { seenS[drawnBig() ? "b" : "s"] = 1; bottomS[(player.y + player.h).toFixed(1)] = 1; update(); }
check("变小过程有大有小两帧", seenS.b && seenS.s);
check("变小过程脚底高度始终一致", Object.keys(bottomS).length === 1, Object.keys(bottomS).join(","));

console.log(fails.length ? ("\n★ 失败 " + fails.length + " 项: " + fails.join(" / ")) : "\n=== 变身体型回归全部通过 ===");
