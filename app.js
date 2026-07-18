// ---- 重い計算はAlpineのリアクティブ管理の外(プレーンなJS)に置いてパフォーマンスを確保 ----
const CHANNEL_MAX = 255; // RGB各チャンネルの差分の最大値
const MAX_DIST = CHANNEL_MAX * Math.sqrt(3); // 白(255,255,255)から黒(0,0,0)までの距離=色空間全体を覆う最大値
// LIMITは整数のまま持つ(MAX_DISTを2乗して求めると浮動小数点誤差で黒が1色だけ漏れることがある)
const LIMIT = 3 * CHANNEL_MAX * CHANNEL_MAX;

// d2(距離の2乗)ごとの件数をヒストグラム化してからオフセットを割り出し、
// 各点をソート済み位置に直接書き込む(カウンティングソート)。
// 通常のArray.sort(比較関数)だと対象が数百万件規模になり数秒かかるため採用。
let total = 0;
const hist = new Uint32Array(LIMIT + 1);
for (let dr = 0; dr <= CHANNEL_MAX; dr++) {
  const dr2 = dr * dr;
  if (dr2 > LIMIT) break;
  for (let dg = 0; dg <= CHANNEL_MAX; dg++) {
    const dg2 = dg * dg;
    if (dr2 + dg2 > LIMIT) break;
    for (let db = 0; db <= CHANNEL_MAX; db++) {
      const d2 = dr2 + dg2 + db * db;
      if (d2 > LIMIT) break;
      hist[d2]++;
      total++;
    }
  }
}

const offset = new Uint32Array(LIMIT + 2);
for (let i = 0; i <= LIMIT; i++) offset[i + 1] = offset[i] + hist[i];

const pointsR = new Uint8Array(total);
const pointsG = new Uint8Array(total);
const pointsB = new Uint8Array(total);
const pointsD2 = new Uint32Array(total);

const cursor = offset.slice(0, LIMIT + 1);
for (let dr = 0; dr <= CHANNEL_MAX; dr++) {
  const dr2 = dr * dr;
  if (dr2 > LIMIT) break;
  for (let dg = 0; dg <= CHANNEL_MAX; dg++) {
    const dg2 = dg * dg;
    if (dr2 + dg2 > LIMIT) break;
    for (let db = 0; db <= CHANNEL_MAX; db++) {
      const d2 = dr2 + dg2 + db * db;
      if (d2 > LIMIT) break;
      const pos = cursor[d2]++;
      pointsR[pos] = 255 - dr;
      pointsG[pos] = 255 - dg;
      pointsB[pos] = 255 - db;
      pointsD2[pos] = d2;
    }
  }
}
const pointsLength = total;

const TOTAL_COLORS = 256 * 256 * 256;
const MAX_RENDER = 400;

function countAt(d) {
  const target = d * d + 1e-9;
  let lo = 0, hi = pointsLength;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pointsD2[mid] <= target) lo = mid + 1; else hi = mid;
  }
  return lo;
}

function findMinDistForTarget(target) {
  let lo = 0, hi = MAX_DIST;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (countAt(mid) < target) lo = mid; else hi = mid;
  }
  return Math.min(hi, MAX_DIST);
}

// ---- Alpineコンポーネント ----
function whiteApp() {
  return {
    dist: 6.5,
    maxDist: MAX_DIST,
    count: 0,
    counterFontSize: 56,
    percentText: '0',
    cells: [],
    displayCells: [],
    renderNote: '',
    targetInput: 200,
    findResult: '',

    init() {
      this.setDist(findMinDistForTarget(200));
      this.$nextTick(() => this.drawChart());
      window.addEventListener('resize', () => this.drawChart());
    },

    setDist(d) {
      this.dist = Math.round(d * 100) / 100;
      this.update();
    },

    update() {
      const d = this.dist;
      const count = countAt(d);
      this.count = count;

      // 桁数に応じてフォントサイズを縮め、300px幅の枠からはみ出さないようにする
      const digits = count.toLocaleString('ja-JP').length;
      this.counterFontSize = Math.max(28, Math.min(88, Math.floor(280 / (digits * 0.62))));

      const pct = (count / TOTAL_COLORS) * 100;
      this.percentText = pct.toFixed(pct < 0.001 ? 7 : 4);

      if (count === 0) {
        this.cells = [];
        this.renderNote = '該当する色がありません';
      } else if (count <= MAX_RENDER) {
        this.cells = [];
        for (let i = 0; i < count; i++) {
          this.cells.push({ r: pointsR[i], g: pointsG[i], b: pointsB[i], d: Math.sqrt(pointsD2[i]) });
        }
        this.renderNote = `${count.toLocaleString('ja-JP')}色すべてを表示中`;
      } else {
        const sampled = [];
        for (let i = 0; i < MAX_RENDER; i++) {
          const idx = Math.floor((i / (MAX_RENDER - 1)) * (count - 1));
          sampled.push({ r: pointsR[idx], g: pointsG[idx], b: pointsB[idx], d: Math.sqrt(pointsD2[idx]) });
        }
        this.cells = sampled;
        this.renderNote = `${MAX_RENDER}色に間引いて表示中`;
      }

      this.displayCells = Array.from({ length: MAX_RENDER }, (_, i) => this.cells[i] || null);

      this.drawChart();
    },

    jumpToTarget(target) {
      this.setDist(findMinDistForTarget(target));
    },

    find() {
      const target = Math.max(1, Math.min(50000, parseInt(this.targetInput || 200, 10)));
      this.setDist(findMinDistForTarget(target));
      this.findResult = `距離 <b>${this.dist.toFixed(2)}</b> で <b>${this.count.toLocaleString('ja-JP')}</b> 色（目標 ${target} 色）`;
    },

    drawChart() {
      const canvas = this.$refs.chart;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const W = rect.width, H = rect.height;
      const pad = { l: 44, r: 14, t: 14, b: 28 };
      ctx.clearRect(0, 0, W, H);

      const chartMaxD = MAX_DIST;
      const chartMaxCount = countAt(chartMaxD);

      const xPix = d => pad.l + (d / chartMaxD) * (W - pad.l - pad.r);
      const yPix = c => H - pad.b - (c / chartMaxCount) * (H - pad.t - pad.b);

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#9a9ca3';
      for (let i = 0; i <= 4; i++) {
        const c = (chartMaxCount / 4) * i;
        const y = yPix(c);
        ctx.beginPath();
        ctx.moveTo(pad.l, y);
        ctx.lineTo(W - pad.r, y);
        ctx.stroke();
        ctx.fillText(Math.round(c).toLocaleString('ja-JP'), 4, y + 3);
      }

      ctx.strokeStyle = '#ecece6';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      let started = false;
      const step = Math.max(1, Math.floor(pointsLength / 600));
      for (let i = 0; i < pointsLength; i += step) {
        const d = Math.sqrt(pointsD2[i]);
        if (d > chartMaxD) break;
        const x = xPix(d);
        const y = yPix(i + 1);
        if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
      }
      ctx.stroke();

      const curCount = this.count;
      const cx = xPix(this.dist);
      const cy = yPix(curCount);
      ctx.strokeStyle = 'rgba(193,39,45,0.6)';
      ctx.beginPath();
      ctx.moveTo(cx, pad.t);
      ctx.lineTo(cx, H - pad.b);
      ctx.stroke();

      ctx.fillStyle = '#c1272d';
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#9a9ca3';
      ctx.fillText('0', pad.l - 3, H - 8);
      ctx.fillText(chartMaxD.toString(), W - pad.r - 14, H - 8);
    }
  };
}
