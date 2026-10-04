/* 回归测试：踩扁敌人（栗子怪/龟壳）后，尸体不得再对玩家造成伤害 */
var fs = require("fs");
var bin = fs.readFileSync("_render.js", "utf8").split("/* ---------- 精灵总览图 ---------- */")[0];
eval(bin);

var fails = [];
function check(name, ok, extra) {
  console.log((ok ? "  [OK]   " : "  [FAIL] ") + name + (extra ? "  " + extra : ""));
  if (!ok) fails.push(name);
}

/* ---------- 1) 直接验证踩扁后的碰撞盒几何 ---------- */
loadLevel(0); game.state = "play";
var g = enemies.filter(function (e) { return e.kind === "goomba"; })[0];
var boxBottomBefore = g.y + g.h;
stompEnemy(g);
console.log("1) 踩扁栗子怪：盒高 " + 14 + " -> " + g.h + "，底边 " + boxBottomBefore.toFixed(0) + " -> " + (g.y + g.h).toFixed(0));
check("尸体碰撞盒高度已压缩", g.h === 6, "h=" + g.h);
check("尸体底边保持贴地（不变）", Math.abs((g.y + g.h) - boxBottomBefore) < 0.001);

/* ---------- 2) 玩家站在尸体正上方，且盒子完全重叠，不得受伤 ---------- */
function overlapTest(label) {
  loadLevel(0); game.state = "play";
  var enemy = enemies.filter(function (e) { return e.kind === "goomba"; })[0];
  enemy.active = true;
  player.power = "big"; player.h = 30;
  player.x = enemy.x; player.y = enemy.y + enemy.h - player.h;   /* 盒子底边对齐 |
     即玩家正好"站"在尸体所在的这一格地面上，水平完全重叠 */
  player.vy = 1; player.py = player.y - 1; player.invuln = 0; player.star = 0;
  var geom = aabb(player, enemy) ? "盒子重叠" : "盒子不重叠";
  stompEnemy(enemy);
  /* 踩踏后玩家会弹起，模拟他落回原地的过程 */
  var hurt = false;
  for (var f = 0; f < 40; f++) {
    player.py = player.y;
    player.y += player.vy;
    player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
    if (player.y + player.h > enemy.y + enemy.h) { player.y = enemy.y + enemy.h - player.h; player.vy = 0; }
    playerEnemyCollisions();
    if (player.dead || player.power !== "big") { hurt = true; break; }
  }
  check(label, !hurt, "(" + geom + ") 40 帧内" + (hurt ? "被打" : "未受伤"));
}

overlapTest("2) 踩扁后持续站在栗子怪尸体上不掉血");

/* ---------- 3) 完整模拟：真跳上去踩一脚，再落地压过尸体 ---------- */
loadLevel(0); game.state = "play";
var g3 = null;
enemies.forEach(function (e) { if (e.kind === "goomba" && !g3) g3 = e; });
enemies.forEach(function (e) { e.active = true; });
player.power = "big"; player.h = 30;
player.x = g3.x - 2; player.y = g3.y - 30; player.vy = 2.0; player.py = player.y - 2;
player.onGround = false;
game.camX = Math.max(0, g3.x - 120);
var stomped = false, hurt3 = false, logged = "";
for (var f = 0; f < 90; f++) {
  if (!stomped) { KEY.right = 1; } else { KEY.right = 0; }
  KEY.jump = 0;
  update();
  if (g3.state === "squash" && !stomped) {
    stomped = true; logged = "第 " + f + " 帧踩扁，盒子 h=" + g3.h + " 底边=" + (g3.y + g3.h).toFixed(0);
  }
  /* 踩扁后把玩家按回尸体正上方，强制他落下来压过尸体（复现"踩死后还有伤害"） */
  if (stomped) { player.x = g3.x; player.vx = 0; }
  if (player.dead || player.power !== "big") { hurt3 = true; break; }
}
console.log("3) 实跳踩扁：" + (stomped ? logged : "★未踩到（测试无效）"));
check("实跳踩扁成功", stomped);
check("踩扁后 90 帧内未再受伤", stomped && !hurt3);

/* ---------- 4) 乌龟变壳 / 龟壳静止时不应伤人 ---------- */
loadLevel(0); game.state = "play";
var k = enemies.filter(function (e) { return e.kind === "koopa"; })[0];
if (k) {
  var before = k.y + k.h;
  stompEnemy(k);
  check("乌龟踩成壳后底边贴地", k.state === "shell" && Math.abs((k.y + k.h) - before) < 0.001,
        "state=" + k.state + " h=" + k.h);
}

console.log(fails.length ? ("\n★ 失败 " + fails.length + " 项: " + fails.join(" / ")) : "\n=== 踩踏伤害回归全部通过 ===");
