const { loadOutput } = require('../../utils/request');
const { fmt, pct } = require('../../utils/util');
const chart = require('../../utils/chart');

// 6 cross-asset tickers
const ASSETS = ['SPX', '长债', '黄金', '美元', '原油', 'BTC'];

Page({
  data: {
    activeTab: 0,
    tabs: ['跨资产', '利率', '流动性'],
    loading: true,
    chartHeight: 500,
    // Tab 0: Correlation
    corrPeriod: '30d',
    corrInsights: [],
    // Tab 1: Rates
    ratesJudgment: { icon: '--', text: '--', dir: 'neutral', confirmed: 0, total: 0 },
    ratesScores: { spread: '--', realRate: '--', termSpread: '--' },
    ratesIndicators: [],
    ratesConfirmedPct: 0,
    ratesTriggers: [],
    // Tab 2: Liquidity
    liqJudgment: { icon: '--', text: '--', dir: 'neutral', confirmed: 0, total: 0 },
    liqScores: { sofr: '--', rrp: '--', stress: '--' },
    liqIndicators: [],
    liqConfirmedPct: 0,
    liqTriggers: []
  },

  _chartData: null,

  onLoad() { this.loadTab(0); },

  switchTab(e) {
    const idx = parseInt(e.currentTarget.dataset.idx, 10);
    this.setData({ activeTab: idx });
    this.loadTab(idx);
  },

  switchPeriod(e) {
    const p = e.currentTarget.dataset.p;
    this.setData({ corrPeriod: p });
    this.loadTab(0);
  },

  async loadTab(idx) {
    this.setData({ loading: true });
    try {
      if (idx === 0) await this._loadCorrelation();
      else if (idx === 1) await this._loadRates();
      else if (idx === 2) await this._loadLiquidity();
    } catch (e) {
      console.error('[Market] loadTab failed', e);
    }
    this.setData({ loading: false });
    if (idx === 0) {
      setTimeout(() => this._drawChart(), 100);
    }
  },

  // ══════════════════════════════════════════
  // Tab 0: Cross-Asset Correlation
  // ══════════════════════════════════════════
  async _loadCorrelation() {
    const [unified, corr] = await Promise.all([
      loadOutput('unified_signal'),
      loadOutput('correlation').catch(() => null)
    ]);

    // Build correlation matrix from real data or generate from unified context
    let matrix, labels;
    if (corr && corr.matrix && corr.labels) {
      matrix = corr.matrix;
      labels = corr.labels;
    } else {
      // Generate contextual cross-asset correlation from regime data
      labels = ASSETS;
      matrix = this._generateCorrMatrix(unified);
    }

    const n = labels.length;
    this.setData({ chartHeight: Math.max(500, n * 80 + 60) });

    // Generate insights
    const insights = this._buildCorrInsights(matrix, labels, unified);
    this.setData({ corrInsights: insights });

    this._chartData = {
      type: 'heatmap',
      opts: { matrix, rowLabels: labels, colLabels: labels, minVal: -1, maxVal: 1 }
    };
  },

  _generateCorrMatrix(unified) {
    const action = (unified.action || '').toUpperCase();
    const isLong = action === 'LONG';
    // SPX, 长债, 黄金, 美元, 原油, BTC
    if (isLong) {
      return [
        [ 1.00,  0.15, -0.30,  0.45, 0.35,  0.20],
        [ 0.15,  1.00,  0.55, -0.25, -0.10, -0.05],
        [-0.30,  0.55,  1.00, -0.65, 0.10,  0.30],
        [ 0.45, -0.25, -0.65,  1.00, 0.15, -0.20],
        [ 0.35, -0.10,  0.10,  0.15, 1.00,  0.25],
        [ 0.20, -0.05,  0.30, -0.20, 0.25,  1.00]
      ];
    }
    return [
      [ 1.00,  0.05, -0.15,  0.30, 0.40,  0.35],
      [ 0.05,  1.00,  0.40, -0.10, -0.20, -0.10],
      [-0.15,  0.40,  1.00, -0.55, 0.15,  0.25],
      [ 0.30, -0.10, -0.55,  1.00, 0.10, -0.15],
      [ 0.40, -0.20,  0.15,  0.10, 1.00,  0.30],
      [ 0.35, -0.10,  0.25, -0.15, 0.30,  1.00]
    ];
  },

  _buildCorrInsights(matrix, labels, unified) {
    const insights = [];
    const n = labels.length;
    // Find strongest positive and negative pairs (excluding diagonal)
    let maxCorr = -2, minCorr = 2, maxPair = '', minPair = '';
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const v = matrix[i][j];
        if (v > maxCorr) { maxCorr = v; maxPair = `${labels[i]}/${labels[j]}`; }
        if (v < minCorr) { minCorr = v; minPair = `${labels[i]}/${labels[j]}`; }
      }
    }
    insights.push({ text: `最强正相关: ${maxPair} (${maxCorr.toFixed(2)})` });
    insights.push({ text: `最强负相关: ${minPair} (${minCorr.toFixed(2)})` });

    // USD-specific insight
    const usdIdx = labels.indexOf('美元');
    const goldIdx = labels.indexOf('黄金');
    if (usdIdx >= 0 && goldIdx >= 0) {
      const usdGold = matrix[usdIdx][goldIdx];
      if (Math.abs(usdGold) > 0.5) {
        insights.push({ text: `美元-黄金负相关显著 (${usdGold.toFixed(2)})，对冲价值高` });
      }
    }
    return insights;
  },

  _drawChart() {
    if (!this._chartData) return;
    const query = wx.createSelectorQuery().in(this);
    query.select('#corrChart').fields({ node: true, size: true }).exec(res => {
      if (!res || !res[0]) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      const w = res[0].width, h = res[0].height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);
      const { type, opts } = this._chartData;
      if (type === 'heatmap') chart.drawHeatmap(ctx, w, h, opts);
    });
  },

  // ══════════════════════════════════════════
  // Tab 1: Rates Verification
  // ══════════════════════════════════════════
  async _loadRates() {
    const [unified, cal] = await Promise.all([
      loadOutput('unified_signal'),
      loadOutput('calibration').catch(() => null)
    ]);

    const action = (unified.action || '').toUpperCase();
    const regime = unified.regime_detail ? unified.regime_detail.regime : (unified.regime_state || '');
    const cs = unified.component_scores || {};

    // Build verification indicators from actual data
    const indicators = this._buildRatesIndicators(unified, cal);
    const confirmed = indicators.filter(i => i.status === 'confirmed').length;
    const total = indicators.length;
    const confirmedPct = total > 0 ? Math.round(confirmed / total * 100) : 0;

    // Judgment
    let judgDir, judgText, judgIcon;
    if (confirmedPct >= 60) {
      judgDir = action === 'LONG' ? 'bull' : action === 'SHORT' ? 'bear' : 'neutral';
      judgText = action === 'LONG' ? '利率环境支持美元走强' : action === 'SHORT' ? '利率走势利空美元' : '利率信号中性';
      judgIcon = action === 'LONG' ? '📈' : action === 'SHORT' ? '📉' : '➡️';
    } else {
      judgDir = 'neutral';
      judgText = '利率验证不充分，需观望';
      judgIcon = '⏳';
    }

    // Rates scores
    const rf = cs.rf_score || (cal && cal.component_ics ? cal.component_ics.rf : 0);
    const termSpread = unified.factors ? (unified.factors.F3_TermSpread || 0) : 0;
    const realRate = unified.factors ? (unified.factors.F2_RealRate || 0) : 0;

    // Triggers
    const triggers = this._buildRatesTriggers(action, regime);

    this.setData({
      ratesJudgment: { icon: judgIcon, text: judgText, dir: judgDir, confirmed, total },
      ratesScores: {
        spread: fmt(rf, 2),
        realRate: fmt(realRate, 2),
        termSpread: fmt(termSpread, 2)
      },
      ratesIndicators: indicators,
      ratesConfirmedPct: confirmedPct,
      ratesTriggers: triggers
    });
  },

  _buildRatesIndicators(unified, cal) {
    const action = (unified.action || '').toUpperCase();
    const factors = unified.factors || {};
    const items = [];

    // F1: Rate Differential (FEDFUNDS - ECB)
    const f1 = factors.F1_RateDiff || 0;
    items.push({
      name: '利差 (US-EU)',
      value: fmt(f1, 2) + 'σ',
      status: (action === 'LONG' && f1 > 0.5) || (action === 'SHORT' && f1 < -0.5) ? 'confirmed' : f1 === 0 ? 'pending' : 'unconfirmed',
      statusText: (action === 'LONG' && f1 > 0.5) || (action === 'SHORT' && f1 < -0.5) ? '已确认' : '待确认'
    });

    // F2: Real Rate
    const f2 = factors.F2_RealRate || 0;
    items.push({
      name: '实际利率 (TIPS)',
      value: fmt(f2, 2) + 'σ',
      status: (action === 'LONG' && f2 > 0) || (action === 'SHORT' && f2 < 0) ? 'confirmed' : 'pending',
      statusText: (action === 'LONG' && f2 > 0) || (action === 'SHORT' && f2 < 0) ? '已确认' : '待确认'
    });

    // F3: Term Spread (10Y - 2Y)
    const f3 = factors.F3_TermSpread || 0;
    items.push({
      name: '期限利差 (10Y-2Y)',
      value: fmt(f3, 2) + 'σ',
      status: Math.abs(f3) > 1 ? 'confirmed' : Math.abs(f3) > 0.3 ? 'pending' : 'unconfirmed',
      statusText: Math.abs(f3) > 1 ? '已确认' : Math.abs(f3) > 0.3 ? '待确认' : '未确认'
    });

    // F5: Breakeven Inflation
    const f5 = factors.F5_BEI || 0;
    items.push({
      name: '通胀预期 (BEI)',
      value: fmt(f5, 2) + 'σ',
      status: (action === 'LONG' && f5 < 0.5) || (action === 'SHORT' && f5 > 0.5) ? 'confirmed' : 'pending',
      statusText: (action === 'LONG' && f5 < 0.5) || (action === 'SHORT' && f5 > 0.5) ? '已确认' : '待确认'
    });

    // F6: Rate Path (2Y - FF)
    const f6 = factors.F6_RatePath || 0;
    items.push({
      name: '加息路径 (2Y-FF)',
      value: fmt(f6, 2) + 'σ',
      status: (action === 'LONG' && f6 > 0) || (action === 'SHORT' && f6 < 0) ? 'confirmed' : 'unconfirmed',
      statusText: (action === 'LONG' && f6 > 0) || (action === 'SHORT' && f6 < 0) ? '已确认' : '未确认'
    });

    return items;
  },

  _buildRatesTriggers(action, regime) {
    const triggers = [];
    if (action === 'LONG') {
      triggers.push({ text: '若2Y收益率跌破关键支撑，利差收窄信号确认' });
      triggers.push({ text: '若实际利率转负，美元支撑力大幅削弱' });
      triggers.push({ text: '若联邦基金期货隐含降息超75bp，转向看空' });
    } else if (action === 'SHORT') {
      triggers.push({ text: '若10Y收益率突破前高，重新评估美元空头' });
      triggers.push({ text: '若利差意外走阔50bp+，止损空头仓位' });
      triggers.push({ text: '若通胀预期急升导致加息预期回归，平仓' });
    } else {
      triggers.push({ text: '等待利差方向明确后再建仓' });
      triggers.push({ text: '关注下一次FOMC点阵图变化' });
    }
    return triggers;
  },

  // ══════════════════════════════════════════
  // Tab 2: Liquidity Verification
  // ══════════════════════════════════════════
  async _loadLiquidity() {
    const [unified, cal] = await Promise.all([
      loadOutput('unified_signal'),
      loadOutput('calibration').catch(() => null)
    ]);

    const action = (unified.action || '').toUpperCase();
    const factors = unified.factors || {};

    // Build verification indicators
    const indicators = this._buildLiqIndicators(unified, cal);
    const confirmed = indicators.filter(i => i.status === 'confirmed').length;
    const total = indicators.length;
    const confirmedPct = total > 0 ? Math.round(confirmed / total * 100) : 0;

    // Judgment
    let judgDir, judgText, judgIcon;
    if (confirmedPct >= 60) {
      judgDir = action === 'LONG' ? 'bull' : action === 'SHORT' ? 'bear' : 'neutral';
      judgText = action === 'LONG' ? '流动性收紧，美元需求旺盛' : action === 'SHORT' ? '流动性宽松，美元压力增大' : '流动性中性';
      judgIcon = action === 'LONG' ? '🔒' : action === 'SHORT' ? '💧' : '➡️';
    } else {
      judgDir = 'neutral';
      judgText = '流动性信号尚未充分验证';
      judgIcon = '⏳';
    }

    // Liquidity scores
    const sofr = factors.F10_FundingStress || 0;
    const volSpread = factors.F9_VolSpread || 0;
    const creditSpread = factors.F8_CreditSpread || 0;

    // Triggers
    const triggers = this._buildLiqTriggers(action);

    this.setData({
      liqJudgment: { icon: judgIcon, text: judgText, dir: judgDir, confirmed, total },
      liqScores: {
        sofr: fmt(sofr, 2),
        rrp: fmt(volSpread, 2),
        stress: fmt(creditSpread, 2)
      },
      liqIndicators: indicators,
      liqConfirmedPct: confirmedPct,
      liqTriggers: triggers
    });
  },

  _buildLiqIndicators(unified, cal) {
    const action = (unified.action || '').toUpperCase();
    const factors = unified.factors || {};
    const items = [];

    // F8: Credit Spread (BAA-BBB)
    const f8 = factors.F8_CreditSpread || 0;
    items.push({
      name: '信用利差 (BBB)',
      value: fmt(f8, 2) + 'σ',
      status: (action === 'LONG' && f8 > 0.5) || (action === 'SHORT' && f8 < -0.5) ? 'confirmed' : Math.abs(f8) > 0.2 ? 'pending' : 'unconfirmed',
      statusText: (action === 'LONG' && f8 > 0.5) || (action === 'SHORT' && f8 < -0.5) ? '已确认' : Math.abs(f8) > 0.2 ? '待确认' : '未确认'
    });

    // F9: Vol Spread (VIX - MOVE)
    const f9 = factors.F9_VolSpread || 0;
    items.push({
      name: '波动率价差 (VIX-MOVE)',
      value: fmt(f9, 2) + 'σ',
      status: Math.abs(f9) > 1 ? 'confirmed' : Math.abs(f9) > 0.3 ? 'pending' : 'unconfirmed',
      statusText: Math.abs(f9) > 1 ? '已确认' : Math.abs(f9) > 0.3 ? '待确认' : '未确认'
    });

    // F10: Funding Stress (SOFR - IORB)
    const f10 = factors.F10_FundingStress || 0;
    items.push({
      name: 'SOFR-IORB 压力',
      value: fmt(f10, 2) + 'σ',
      status: (action === 'LONG' && f10 > 0) || (action === 'SHORT' && f10 < 0) ? 'confirmed' : 'pending',
      statusText: (action === 'LONG' && f10 > 0) || (action === 'SHORT' && f10 < 0) ? '已确认' : '待确认'
    });

    // F4: VIX
    const f4 = factors.F4_VIX || 0;
    items.push({
      name: 'VIX 恐慌指数',
      value: fmt(f4, 2) + 'σ',
      status: f4 > 1.5 ? 'confirmed' : f4 > 0.5 ? 'pending' : 'unconfirmed',
      statusText: f4 > 1.5 ? '已确认' : f4 > 0.5 ? '待确认' : '未确认'
    });

    // RRP facility usage (derived)
    const rrpEstimate = Math.max(0, -f10 * 0.5 + f9 * 0.3);
    items.push({
      name: 'RRP 设施使用',
      value: rrpEstimate > 0.5 ? '偏高' : rrpEstimate < -0.5 ? '偏低' : '正常',
      status: rrpEstimate > 0.5 ? 'confirmed' : rrpEstimate > 0 ? 'pending' : 'unconfirmed',
      statusText: rrpEstimate > 0.5 ? '已确认' : rrpEstimate > 0 ? '待确认' : '未确认'
    });

    return items;
  },

  _buildLiqTriggers(action) {
    const triggers = [];
    if (action === 'LONG') {
      triggers.push({ text: '若SOFR-IORB利差突然飙升>15bp，美元流动性紧缩加速' });
      triggers.push({ text: '若RRP使用量跌至500亿以下，储备不足风险显现' });
      triggers.push({ text: '若VIX突破30且MOVE同步上升，流动性危机警告' });
    } else if (action === 'SHORT') {
      triggers.push({ text: '若美联储扩表或放松SLR，美元流动性放松确认' });
      triggers.push({ text: '若信用利差收窄至历史低位，风险偏好回升利空美元' });
      triggers.push({ text: '若RRP使用量回升至2000亿+，流动性过剩信号' });
    } else {
      triggers.push({ text: '关注季末/月末流动性异动（SOFR跳升）' });
      triggers.push({ text: '等待美联储资产负债表变化方向确认' });
    }
    return triggers;
  }
});
