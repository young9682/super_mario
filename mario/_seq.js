/* 把"吃蘑菇变大 / 受伤变小"的每一帧渲染成连环画，用于目视检查体型 */
var fs = require("fs");
var bin = fs.readFileSync("_render.js", "utf8").split("/* ---------- 精灵总览图 ---------- */")[0];
eval(bin);

var CELL_W = 64, CELL_H = 112, Z = 3, COLS = 7;
/* CROP_* 是"渲染后帧"上的屏幕坐标（render 内部已经减过 camX），
   CAM_X 用来把马里奥摆到屏幕 x = 32 处 */
var CROP_X = 4, CROP_Y = 118, CAM_X = 190;

var sheet = new MCanvas(COLS * CELL_W * Z, 2 * CELL_H * Z);

function frameShot() {
  game.camX = CAM_X;                  /* 固定取景，抵消镜头跟随 */
  var inv = player ? player.invuln : 0;
  if (player) player.invuln = 0;      /* 关掉无敌闪烁，否则会拍到"看不见"的那一帧 */
  var tmp = new MCanvas(256, 240);
  var oc = ctx, ov = cv, ovw = VW, os = S;
  cv = tmp; ctx = tmp.getContext("2d"); VW = 256; S = 1;
  try { render(); } catch (e) { console.log("render err", e.message); }
  ctx = oc; cv = ov; VW = ovw; S = os;
  if (player) player.invuln = inv;
  return tmp;
}
function blit(grid, row, col) {
  for (var y = 0; y < CELL_H; y++) {
    for (var x = 0; x < CELL_W; x++) {
      var si = ((CROP_Y + y) * grid.width + (CROP_X + x)) * 4;
      if (grid.data[si + 3] === 0) continue;
      for (var yy = 0; yy < Z; yy++) {
        for (var xx = 0; xx < Z; xx++) {
          var px = (col * CELL_W + x) * Z + xx, py = (row * CELL_H + y) * Z + yy;
          var di = (py * sheet.width + px) * 4;
          sheet.data[di] = grid.data[si];
          sheet.data[di + 1] = grid.data[si + 1];
          sheet.data[di + 2] = grid.data[si + 2];
          sheet.data[di + 3] = 255;
        }
      }
    }
  }
}
/* 单元格边框 */
function border(row, col, rgb) {
  var x0 = col * CELL_W * Z, y0 = row * CELL_H * Z, w = CELL_W * Z, h = CELL_H * Z;
  ctx2 = null;
  for (var i = 0; i < w; i++) {
    put(x0 + i, y0, rgb); put(x0 + i, y0 + h - 1, rgb);
  }
  for (var j = 0; j < h; j++) {
    put(x0, y0 + j, rgb); put(x0 + w - 1, y0 + j, rgb);
  }
}
function put(px, py, rgb) {
  if (px < 0 || py < 0 || px >= sheet.width || py >= sheet.height) return;
  var i = (py * sheet.width + px) * 4;
  sheet.data[i] = rgb[0]; sheet.data[i + 1] = rgb[1]; sheet.data[i + 2] = rgb[2]; sheet.data[i + 3] = 255;
}

/* ---------- 摆到一段平地上 ---------- */
function setup() {
  loadLevel(0); game.state = "play";
  player.x = CAM_X + 32; player.y = 13 * TS - 15; player.h = 15;
  player.power = "small"; player.vx = 0; player.vy = 0; player.onGround = true;
  player.crouch = false; player.transform = 0; player.invuln = 0; player.dead = false;
  player.animTimer = 0; player.faceLeft = false;
  KEY.left = KEY.right = KEY.down = KEY.run = KEY.jump = 0;
  game.camX = CAM_X; game.tick = 20;
  enemies.forEach(function (e) { e.active = false; });
}

function step(n) { for (var i = 0; i < n; i++) update(); }

/* ---------- 第 1 行：吃蘑菇变大 ---------- */
setup();
blit(frameShot(), 0, 0);                       /* 小马里奥 */
growPlayer("big");
var wantG = [40, 30, 20, 10];
var t = 44, col = 1;
for (var i = 0; i < wantG.length; i++) {
  step(t - wantG[i]); t = wantG[i];
  blit(frameShot(), 0, col++);
}
step(t + 2);                                   /* 动画结束 */
blit(frameShot(), 0, 5);                       /* 大马里奥 */
console.log("行1(吃蘑菇变大) 结束时 h=" + player.h + " power=" + player.power);

/* ---------- 第 2 行：受伤变小 -> 再受伤死亡 ---------- */
blit(frameShot(), 1, 0);                       /* 大马里奥 */
hurtPlayer();
blit(frameShot(), 1, 1);                       /* 受伤瞬间（闪烁帧） */
var wantS = [30, 20, 10];
t = 40; col = 2;
for (i = 0; i < wantS.length; i++) {
  step(t - wantS[i]); t = wantS[i];
  blit(frameShot(), 1, col++);
}
step(t + 2);
blit(frameShot(), 1, 5);                       /* 小马里奥 */
console.log("行2(受伤变小) 结束时 h=" + player.h + " power=" + player.power);
player.invuln = 0;
hurtPlayer();
step(6);
blit(frameShot(), 1, 6);                       /* 死亡 */
console.log("第二次受伤 dead=" + player.dead + " h=" + player.h);

for (var r = 0; r < 2; r++) for (var c = 0; c < COLS; c++) border(r, c, [90, 90, 110]);

savePNG(sheet, "shot_grow_shrink.png");
console.log("saved shot_grow_shrink.png " + sheet.width + "x" + sheet.height);
