// ---- 重い計算はAlpineのリアクティブ管理の外(プレーンなJS)に置いてパフォーマンスを確保 ----
const MAX_DIFF = 40;
const MAX_DIST = 30;

const points = [];
for (let dr = 0; dr <= MAX_DIFF; dr++) {
  for (let dg = 0; dg <= MAX_DIFF; dg++) {
    for (let db = 0; db <= MAX_DIFF; db++) {
      const d2 = dr * dr + dg * dg + db * db;
      if (d2 <= MAX_DIST * MAX_DIST) {
        points.push({ r: 255 - dr, g: 255 - dg, b: 255 - db, d2 });
      }
    }
  }
}
points.sort((a, b) => a.d2 - b.d2);

const TOTAL_COLORS = 256 * 256 * 256;
const MAX_RENDER = 480;

function countAt(d) {
  const target = d * d + 1e-9;
  let lo = 0, hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].d2 <= target) lo = mid + 1; else hi = mid;
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
    percentText: '0',
    cells: [],
    displayCells: [],
    renderNote: '',
    moreNote: '',
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

      const pct = (count / TOTAL_COLORS) * 100;
      this.percentText = pct.toFixed(pct < 0.001 ? 7 : 4);

      if (count === 0) {
        this.cells = [];
        this.renderNote = '該当する色がありません';
        this.moreNote = '';
      } else if (count <= MAX_RENDER) {
        this.cells = points.slice(0, count).map(p => ({ r: p.r, g: p.g, b: p.b, d: Math.sqrt(p.d2) }));
        this.renderNote = `${count.toLocaleString('ja-JP')}色すべてを表示中`;
        this.moreNote = '';
      } else {
        const sampled = [];
        for (let i = 0; i < MAX_RENDER; i++) {
          const idx = Math.floor((i / (MAX_RENDER - 1)) * (count - 1));
          const p = points[idx];
          sampled.push({ r: p.r, g: p.g, b: p.b, d: Math.sqrt(p.d2) });
        }
        this.cells = sampled;
        this.renderNote = `${MAX_RENDER}色を間引いて表示中`;
        this.moreNote = `※ 実際は ${count.toLocaleString('ja-JP')} 色あります(表示負荷軽減のため間引いています)`;
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
      const step = Math.max(1, Math.floor(points.length / 600));
      for (let i = 0; i < points.length; i += step) {
        const d = Math.sqrt(points[i].d2);
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
