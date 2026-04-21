/**
 * 通胀-资产看板 (Inflation → Asset Dashboard)
 *
 * 实时数据来自已部署的 Vercel API:
 *   - GET /api/event-window         FOMC/CPI 事件窗口
 *   - GET /api/multi-asset-signals  通胀 regime + 四资产信号
 *   - GET /api/inflation-diagnosis  Blanchard 6型通胀诊断
 */
const { request } = require('../../utils/request');

const API_BASE = 'https://usd-dashboard.vercel.app';

// ── Direction → UI config ──────────────────────────────────────────────────
const DIR_CONFIG = {
  strong_bullish:  { label: '强看多', color: '#34d399', arrow: '▲▲' },
  bullish:         { label: '看多',   color: '#10b981', arrow: '▲'  },
  neutral:         { label: '中性',   color: '#94a3b8', arrow: '●'  },
  bearish:         { label: '看空',   color: '#f87171', arrow: '▼'  },
  strong_bearish:  { label: '强看空', color: '#ef4444', arrow: '▼▼' },
};

// ── Zone (component hot/elevated/normal/cool) ──────────────────────────────
const ZONE_CONFIG = {
  hot:      { color: '#ef4444', label: '偏热' },
  elevated: { color: '#f59e0b', label: '偏高' },
  normal:   { color: '#94a3b8', label: '正常' },
  cool:     { color: '#10b981', label: '回落' },
};

// ── Inflation type → badge color ───────────────────────────────────────────
const TYPE_COLOR = {
  energy_driven:  '#fb923c',
  wage_spiral:    '#ef4444',
  monetary:       '#a78bfa',
  demand_pull:    '#f59e0b',
  supply_chain:   '#38bdf8',
  shelter_driven: '#818cf8',
  mixed:          '#94a3b8',
  cooling:        '#10b981',
};

// ── Event window status config ─────────────────────────────────────────────
const EVENT_STATUS = {
  imminent:    { color: '#f87171', bg: 'rgba(239,68,68,0.15)', icon: '⚠', label: '观察模式' },
  approaching: { color: '#fbbf24', bg: 'rgba(245,158,11,0.10)', icon: '⏰', label: '事件临近' },
  post:        { color: '#38bdf8', bg: 'rgba(56,189,248,0.10)', icon: '↻', label: '信号恢复' },
  clear:       { color: '#94a3b8', bg: 'rgba(30,41,59,0.40)',  icon: '📅', label: '日历' },
};

// ── Event type color ───────────────────────────────────────────────────────
const EVENT_TYPE_COLOR = {
  FOMC: '#a78bfa',
  CPI:  '#f87171',
  PCE:  '#fb923c',
  NFP:  '#10b981',
  GDP:  '#38bdf8',
};

Page({
  data: {
    loading: true,
    lastUpdate: '',

    // Event window
    event: null,
    eventCfg: null,

    // Regime + assets
    regime: '',
    regimeLabel: '',
    regimeReason: '',
    inflationAnchor: null,
    wageGrowth: null,
    fiscal: null,
    assets: [],

    // Inflation diagnosis
    diagnosis: null,
    typeColor: '#94a3b8',
  },

  onLoad() {
    this.loadAll();
  },

  onPullDownRefresh() {
    this.loadAll().finally(() => wx.stopPullDownRefresh());
  },

  async loadAll() {
    this.setData({ loading: true });
    try {
      const [eventRes, multiRes, diagRes] = await Promise.all([
        request({ url: `${API_BASE}/api/event-window` }).catch(() => null),
        request({ url: `${API_BASE}/api/multi-asset-signals` }).catch(() => null),
        request({ url: `${API_BASE}/api/inflation-diagnosis` }).catch(() => null),
      ]);

      const update = {
        loading: false,
        lastUpdate: this._fmtTime(new Date()),
      };

      // Event window
      if (eventRes) {
        update.event = eventRes;
        update.eventCfg = EVENT_STATUS[eventRes.status] || EVENT_STATUS.clear;
        if (eventRes.upcoming) {
          update.event.upcoming = eventRes.upcoming.map(e => ({
            ...e,
            color: EVENT_TYPE_COLOR[e.type] || '#94a3b8',
            dayText: this._dayText(e.daysUntil),
          }));
        }
      }

      // Multi-asset signals
      if (multiRes) {
        update.regime = multiRes.regime;
        update.regimeLabel = multiRes.regimeLabel;
        update.regimeReason = multiRes.regimeReason;
        update.inflationAnchor = multiRes.inflationAnchor;
        update.wageGrowth = multiRes.wageGrowth;
        update.fiscal = multiRes.fiscal;
        update.assets = (multiRes.assets || []).map(a => {
          const cfg = DIR_CONFIG[a.direction] || DIR_CONFIG.neutral;
          return {
            ...a,
            dirLabel: cfg.label,
            dirColor: cfg.color,
            dirArrow: cfg.arrow,
            priceDisplay: a.price != null
              ? (a.asset === 'Bonds' ? a.price.toFixed(2) + '%' : a.price.toFixed(2))
              : '—',
            changeColor: (a.change_1d_pct || 0) > 0 ? '#10b981' : '#ef4444',
            stars: [1, 2, 3, 4, 5].map(i => ({
              filled: i <= (a.confidence || 0),
              color: cfg.color,
            })),
          };
        });
      }

      // Inflation diagnosis
      if (diagRes) {
        const components = (diagRes.components || []).map(c => {
          const zCfg = ZONE_CONFIG[c.zone] || ZONE_CONFIG.normal;
          // Bar width: 0-8% YoY maps to 0-100%
          const barPct = Math.min(100, Math.max(0, (c.yoy / 8) * 100));
          return {
            ...c,
            zoneColor: zCfg.color,
            zoneLabel: zCfg.label,
            barPct,
            yoyDisplay: (c.yoy > 0 ? '+' : '') + c.yoy.toFixed(2),
          };
        });
        update.diagnosis = {
          ...diagRes,
          components,
        };
        update.typeColor = TYPE_COLOR[diagRes.type] || '#94a3b8';
      }

      this.setData(update);
    } catch (e) {
      console.error('[Inflation] loadAll failed', e);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  _fmtTime(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  _dayText(d) {
    if (d === 0) return '今天';
    if (d === 1) return '明天';
    if (d === -1) return '昨天';
    if (d < 0) return `${-d}天前`;
    return `${d}天后`;
  },
});
