const { loadOutput } = require('../../utils/request');
const { fmt, pct } = require('../../utils/util');

const MATRIX_ACTIONS = {
  '0,0': { emoji: '🟢', action: 'LONG 1.0', desc: '双引擎看多' },
  '0,1': { emoji: '🟡', action: 'LONG 0.5', desc: 'γ多+ML中性' },
  '0,2': { emoji: '🔴', action: 'FLAT', desc: '信号矛盾' },
  '1,0': { emoji: '🟡', action: 'LONG 0.5', desc: 'ML多+γ中性' },
  '1,1': { emoji: '⚪', action: 'FLAT', desc: '双引擎中性' },
  '1,2': { emoji: '🟡', action: 'SHORT 0.5', desc: 'ML空+γ中性' },
  '2,0': { emoji: '🔴', action: 'FLAT', desc: '信号矛盾' },
  '2,1': { emoji: '🟡', action: 'SHORT 0.5', desc: 'γ空+ML中性' },
  '2,2': { emoji: '🟢', action: 'SHORT 1.0', desc: '双引擎看空' }
};

function gammaRow(s) { s = (s||'').toUpperCase(); return s==='BULLISH'||s==='BUY'?0:s==='BEARISH'||s==='SELL'?2:1; }
function mlCol(s) { s = (s||'').toUpperCase(); return s==='BUY'||s==='BULLISH'?0:s==='SELL'||s==='BEARISH'?2:1; }

Page({
  data: {
    loading: true,
    // Core decision
    action: '--', source: '--', confidence: '--', positionSize: '--',
    gammaScore: '--', gammaDir: '', mlPred: '--', mlDir: '',
    conflict: '--', conflictLevel: '', regime: '--',
    // Matrix
    matrixRows: ['γ 看多', 'γ 中性', 'γ 看空'],
    matrixCols: ['ML 看多', 'ML 中性', 'ML 看空'],
    matrixCells: [],
    // Invalidation conditions (NEW)
    invalidations: [],
    // Risk budget (NEW)
    riskBudget: '',
    // P1/P2 toggle
    showP1: false, showP2: false,
    orthoR2: '--', orthoBeta: '--', orthoInfoPct: '--',
    attrStrategies: []
  },

  onLoad() { this.fetchData(); },

  async fetchData() {
    this.setData({ loading: true });
    try {
      const [unified, ortho, attr, mh] = await Promise.all([
        loadOutput('unified_signal'),
        loadOutput('orthogonalization').catch(() => null),
        loadOutput('signal_attribution').catch(() => null),
        loadOutput('model_health').catch(() => null)
      ]);

      const mp = unified.matrix_position || {};
      const gRow = gammaRow(mp.gamma_dir || unified.gamma_signal);
      const mCol = mlCol(mp.ml_dir || unified.ml_signal);

      const cells = [];
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++)
          cells.push({ ...MATRIX_ACTIONS[`${r},${c}`], active: r===gRow && c===mCol });

      const regimeText = unified.regime_detail ? unified.regime_detail.regime : (unified.regime_state || '--');

      // Confidence & sizing
      const confScore = unified.conflict_score || 0;
      let confidence, positionSize;
      if (confScore < 0.2) { confidence = '高确信'; positionSize = '1.0x'; }
      else if (confScore < 0.5) { confidence = '中确信'; positionSize = '0.5x'; }
      else { confidence = '低确信'; positionSize = '0.25x'; }

      // Build invalidation conditions (NEW)
      const invalidations = this._buildInvalidations(unified, mh);

      // Risk budget text
      const riskBudget = `战术仓位为主，总敞口不超过净值${positionSize === '1.0x' ? '30%' : positionSize === '0.5x' ? '20%' : '10%'}。美元仓${positionSize === '0.25x' ? '2.5%' : positionSize === '0.5x' ? '5%' : '10%'}，严格设置止损。`;

      this.setData({
        loading: false,
        action: unified.action || '--',
        source: unified.signal_source || '--',
        confidence, positionSize,
        gammaScore: fmt(unified.gamma_score, 0),
        gammaDir: (unified.gamma_signal || '').toUpperCase(),
        mlPred: pct(unified.ml_prediction, 2, true),
        mlDir: (unified.ml_signal || '').toUpperCase(),
        conflict: fmt(unified.conflict_score, 2),
        conflictLevel: unified.conflict_level || '',
        regime: regimeText,
        matrixCells: cells,
        invalidations, riskBudget
      });

      if (ortho) {
        this.setData({
          orthoR2: fmt(ortho.r_squared, 4),
          orthoBeta: fmt(ortho.beta, 4),
          orthoInfoPct: fmt(ortho.independent_info_pct, 1) + '%'
        });
      }

      if (attr && attr.strategies) {
        this.setData({
          attrStrategies: attr.strategies.map(s => ({
            label: s.label, ret: pct(s.total_return, 2, true),
            sharpe: fmt(s.sharpe, 3), dd: pct(s.max_drawdown*100, 2),
            hit: pct(s.hit_rate*100, 1)
          }))
        });
      }
    } catch (e) {
      console.error('[Signal] fetch failed', e);
      this.setData({ loading: false });
    }
  },

  _buildInvalidations(unified, mh) {
    const action = (unified.action || '').toUpperCase();
    const items = [];

    // Model health based
    if (mh && mh.recent_60d_ic < -0.2) {
      items.push({ icon: '×', text: `模型近60天IC=${fmt(mh.recent_60d_ic,3)}，已触发 circuit breaker 阈值` });
    }

    // Action-specific invalidations
    if (action === 'LONG') {
      items.push({ icon: '×', text: '若美联储意外转鸽，联邦基金期货定价降息超50bp，利差支撑消失' });
      items.push({ icon: '×', text: '若DXY跌破关键支撑位（20日均线下方2%），趋势反转确认' });
      items.push({ icon: '×', text: '若VIX突破35且MOVE同步飙升，避险逻辑转向黄金而非美元' });
    } else if (action === 'SHORT') {
      items.push({ icon: '×', text: '若非农/CPI数据大幅超预期，市场重新定价加息路径' });
      items.push({ icon: '×', text: '若地缘冲突升级导致避险资金涌入美元，短期反弹超2%' });
      items.push({ icon: '×', text: '若美联储官员密集释放鹰派信号，利差走阔' });
    } else {
      items.push({ icon: '×', text: '当前信号矛盾，等待γ与ML方向一致后再入场' });
      items.push({ icon: '×', text: '若冲突分降至0.2以下，可按部分仓位跟随主信号' });
    }
    return items;
  },

  toggleP1() { this.setData({ showP1: !this.data.showP1 }); },
  toggleP2() { this.setData({ showP2: !this.data.showP2 }); }
});
