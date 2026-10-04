/* 校验："精灵可见下沿" 是否贴住站立面（碰撞盒下沿）。防止敌人悬空。 */
var fs = require("fs");
var bin = fs.readFileSync("_render.js", "utf8").split("/* ---------- 精灵总览图 ---------- */")[0];
eval(bin);   /* 得到 MCanvas/MCtx 与游戏全局（SPR/LEVELS/loadLevel/update/enemies...） */

/* 精灵最后一个不透明行 */
function lastRow(img) {
  for (var y = img.height - 1; y >= 0; y--)
    for (var x = 0; x < img.width; x++)
      if (img.data[(y * img.width + x) * 4 + 3] !== 0) return y;
  return -1;
}
var DRAW_DY = -2;   /* drawEnemies 统一 y 偏移 */
/* 尸体（squash）改成了以碰撞盒底边对齐绘制，这里跟随实际实现 */
function visualBottomOf(e, sp) {
  if (e.kind === "goomba" && e.state === "squash")
    return e.y + e.h - sp.r.height + lastRow(sp.r);
  return e.y + DRAW_DY + lastRow(sp.r);
}
function spriteOf(e) {
  if (e.kind === "goomba") return e.state === "squash" ? SPR.goombaFlat : SPR.goomba[Math.floor(e.anim) % 2];
  if (e.kind === "koopa") return (e.state === "walk") ? (e.red ? SPR.koopaR : SPR.koopa)[Math.floor(e.anim) % 2]
                                                      : (e.red ? SPR.shellR[0] : SPR.shell[0]);
  return null;
}
var bad = [], sampled = 0;
LEVELS.forEach(function (def, li) {
  loadLevel(li);
  game.state = "play";
  enemies.forEach(function (e) { e.active = true; });
  for (var f = 0; f < 240; f++) { try { update(); } catch (err) { } }
  enemies.forEach(function (e) {
    if (e.kind === "piranha" || e.dead || e.flip) return;
    var sp = spriteOf(e); if (!sp) return;
    sampled++;
    var visualBottom = visualBottomOf(e, sp);           /* 可见下沿所在行 */
    var boxBottom = e.y + e.h - 1;                      /* 碰撞盒最后一行 */
    var gap = boxBottom - visualBottom;
    var falling = Math.abs(e.vy) > 0.5 || !e.onGround;
    var onSurface = solidAt(game.level, Math.floor((e.x + e.w / 2) / TS), Math.floor((e.y + e.h + 1) / TS));
    if (gap !== 0) bad.push(def.name + " " + e.kind + "/" + e.state + " 离地 " + gap + "px (x=" + e.x.toFixed(0) + " 盒高" + e.h + " 图高" + sp.r.height + ")");
    if (!onSurface && !falling) bad.push(def.name + " " + e.kind + "/" + e.state + " 脚下无地面 (x=" + e.x.toFixed(0) + ", y=" + e.y.toFixed(0) + ")");
  });
  console.log(def.name, "敌人", enemies.length, "检查完成");
});

loadLevel(0); game.state = "play";
var k = enemies.filter(function (e) { return e.kind === "koopa"; })[0];
if (k) {
  var a = lastRow(SPR.koopa[0].r), b = lastRow(SPR.koopa[1].r);
  console.log("乌龟两帧: 高", SPR.koopa[0].r.height + "/" + SPR.koopa[1].r.height,
              "可见下沿行", a + "/" + b,
              (a === b && SPR.koopa[0].r.height === SPR.koopa[1].r.height) ? "一致" : "★不一致");
  stompEnemy(k);
  console.log("踩踏后 state=" + k.state + " h=" + k.h,
              "盒子下沿=" + (k.y + k.h).toFixed(0),
              "龟壳可见下沿=" + (k.y + DRAW_DY + lastRow(SPR.shell[0].r)).toFixed(0));
}
console.log("样本 " + sampled + " 个 | " + (bad.length ? ("问题 " + bad.length + " 处:\n" + bad.slice(0, 12).join("\n")) : "=== 所有敌人均贴合地面 ==="));
