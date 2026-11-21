// news-image-20261120: "THE WORLD TODAY" — one image summing up the world news
// of Friday 20 November 2026. Node 22 stdlib only. Renders a 1024x1536
// newspaper-style poster to /output/entry.png with a pure-JS PNG encoder
// (raw RGBA buffer + node:zlib deflate + PNG chunks with CRC32) and a 5x7
// bitmap font drawn as filled rectangles. No network, no dependencies.
import * as fs from "node:fs";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1536;
const OUT = "/output/entry.png";

type RGB = [number, number, number];

// ---------- palette ----------
const PAPER: RGB = [244, 239, 228]; // off-white paper
const INK: RGB = [26, 26, 26]; // near-black ink
const RED: RGB = [178, 34, 34]; // masthead red accent
const GREY: RGB = [92, 88, 80]; // summary grey

// ---------- pixel buffer ----------
const px = new Uint8Array(W * H * 4);

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
  px[i + 3] = 255;
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) setPixel(xx, yy, c);
  }
}

// ---------- 5x7 bitmap font ----------
// Each glyph is 7 rows of 5 cells ("#" = on, "." = off).
const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "'": ["..#..", "..#..", "..#..", ".....", ".....", ".....", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
};

function drawChar(ch: string, x: number, y: number, s: number, c: RGB): void {
  const g = FONT[ch];
  if (!g) return;
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r][col] === "#") fillRect(x + col * s, y + r * s, s, s, c);
    }
  }
}

function textWidth(text: string, s: number): number {
  if (text.length === 0) return 0;
  return text.length * 6 * s - s;
}

function drawText(text: string, x: number, y: number, s: number, c: RGB): void {
  for (let i = 0; i < text.length; i++) {
    drawChar(text[i], x + i * 6 * s, y, s, c);
  }
}

function drawTextCentered(text: string, cx: number, y: number, s: number, c: RGB): void {
  drawText(text, Math.round(cx - textWidth(text, s) / 2), y, s, c);
}

// ---------- CRC32 + PNG encoder ----------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function writePng(file: string): void {
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: none
    Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (1 + W * 4) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
}

// ---------- draw the poster ----------
// paper
fillRect(0, 0, W, H, PAPER);
// outer border
fillRect(24, 24, W - 48, 6, INK);
fillRect(24, H - 30, W - 48, 6, INK);
fillRect(24, 24, 6, H - 48, INK);
fillRect(W - 30, 24, 6, H - 48, INK);

// masthead
drawTextCentered("THE WORLD TODAY", W / 2, 70, 9, INK);
fillRect(48, 190, W - 96, 10, RED);
drawTextCentered("FRIDAY 20 NOVEMBER 2026", W / 2, 220, 4, RED);
fillRect(48, 262, W - 96, 3, INK);

// the six stories of the day
type Story = { num: string; head: string; l1: string; l2: string };
const stories: Story[] = [
  {
    num: "1",
    head: "RUSSIA BOMBARDS UKRAINE",
    l1: "400 DRONES AND 110 MISSILES HIT",
    l2: "KYIV; 8 DEAD, 30 INJURED; TWO LAND IN POLAND",
  },
  {
    num: "2",
    head: "ICJ: MYANMAR GUILTY",
    l1: "COURT FINDS MYANMAR RESPONSIBLE",
    l2: "FOR ROHINGYA GENOCIDE, A FIRST",
  },
  {
    num: "3",
    head: "TRUMP, XI, PUTIN SIGN PACT",
    l1: "FIRST THREE-WAY SUMMIT ENDS IN",
    l2: "JOINT PEACE DECLARATION, SHENZHEN",
  },
  {
    num: "4",
    head: "AI ROUT SINKS STOCKS",
    l1: "S AND P 500 FALLS 3.7 PERCENT AS",
    l2: "CHIP SELL-OFF PUSHES IT TO CORRECTION",
  },
  {
    num: "5",
    head: "QUAKE SHAKES PERU",
    l1: "MAGNITUDE 6.7 TREMOR HITS THE",
    l2: "ANDES; ROADS DAMAGED, ONE INJURED",
  },
  {
    num: "6",
    head: "MISSILES DOWN OVER RIYADH",
    l1: "THREE HOUTHI MISSILES SHOT DOWN;",
    l2: "TANKER HIT AND BURNING IN HORMUZ",
  },
];

let y = 300;
const blockH = 190;
for (const st of stories) {
  // number square
  fillRect(48, y + 8, 56, 56, INK);
  drawTextCentered(st.num, 48 + 28, y + 8 + 10, 5, PAPER);
  // headline
  drawText(st.head, 124, y + 8, 5, INK);
  // summary lines
  drawText(st.l1, 124, y + 8 + 52, 3, GREY);
  drawText(st.l2, 124, y + 8 + 52 + 28, 3, GREY);
  // divider
  fillRect(48, y + blockH - 24, W - 96, 2, INK);
  y += blockH;
}

// footer
drawTextCentered("SIX STORIES, ONE DAY", W / 2, y + 6, 3, GREY);

// ---------- write ----------
fs.mkdirSync("/output", { recursive: true });
writePng(OUT);
console.log("wrote " + OUT);
