const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    loading: true,
    activeTab: 0,
    tabs: ['r_f 利率差', 'pi 风险溢价', 'cy 便利收益', 'sigma 波动率'],
    // Component data
    rf: null,
    piRisk: null,
    cy: null,
    volAlert: null,
    // Formatted vol alert factors
    volFactors: []
  },

  onLoad() {
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh())
  },

  switchTab(e) {
    this.setData({ activeTab: parseInt(e.currentTarget.dataset.idx) })
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const [components, volAlert] = await Promise.all([
        api.fetchComponents(),
        api.fetchVolAlert()
      ])

      const updates = { loading: false }

      if (components) {
        updates.rf = components.rf
        updates.piRisk = components.pi_risk
        updates.cy = components.cy
      }

      if (volAlert) {
        updates.volAlert = volAlert
        updates.volFactors = this.formatVolFactors(volAlert)
      }

      this.setData(updates)
    } catch (err) {
      console.error('Factors load error:', err)
      this.setData({ loading: false })
      wx.showToast({ title: '数据加载失败', icon: 'none' })
    }
  },

  formatVolFactors(va) {
    var factors = []

    // F1: RR
    if (va.f1_rr) {
      factors.push({
        id: 'F1', name: '3M 25D Risk Reversal',
        subtitle: '期权偏斜',
        value: util.formatChange(va.f1_rr.value),
        detail: '2Y分位: ' + util.formatNumber(va.f1_rr.percentile, 0) + '%',
        score: util.formatNumber(va.f1_rr.score, 0),
        direction: va.f1_rr.direction,
        dirIcon: util.getDirectionIcon(va.f1_rr.direction),
        dirClass: util.getDirectionClass(va.f1_rr.direction),
        category: 'direct'
      })
    }

    // F2: Residual
    if (va.f2_residual) {
      factors.push({
        id: 'F2', name: '汇率-利差残差',
        subtitle: '现金保护溢价',
        value: util.formatChange(va.f2_residual.value) + ' pts',
        detail: 'Z-Score: ' + util.formatChange(va.f2_residual.zscore),
        score: util.formatNumber(va.f2_residual.score, 0),
        direction: va.f2_residual.direction,
        dirIcon: util.getDirectionIcon(va.f2_residual.direction),
        dirClass: util.getDirectionClass(va.f2_residual.direction),
        category: 'direct'
      })
    }

    // F3: OVX
    if (va.f3_ovx) {
      factors.push({
        id: 'F3', name: 'OVX 原油波动率',
        subtitle: '能源波动率',
        value: util.formatNumber(va.f3_ovx.value),
        detail: '52W分位: ' + util.formatNumber(va.f3_ovx.percentile, 0) + '%',
        score: util.formatNumber(va.f3_ovx.score, 0),
        direction: va.f3_ovx.direction,
        dirIcon: util.getDirectionIcon(va.f3_ovx.direction),
        dirClass: util.getDirectionClass(va.f3_ovx.direction),
        category: 'cross_asset'
      })
    }

    // F4: VVIX/VIX
    if (va.f4_vvix_vix) {
      factors.push({
        id: 'F4', name: 'VVIX/VIX 比值',
        subtitle: '波动率的波动率',
        value: util.formatNumber(va.f4_vvix_vix.value),
        detail: '正常范围: 3.5-5.0',
        score: util.formatNumber(va.f4_vvix_vix.score, 0),
        direction: va.f4_vvix_vix.direction,
        dirIcon: util.getDirectionIcon(va.f4_vvix_vix.direction),
        dirClass: util.getDirectionClass(va.f4_vvix_vix.direction),
        category: 'cross_asset'
      })
    }

    // F5: VXN/VIX
    if (va.f5_vxn_vix) {
      factors.push({
        id: 'F5', name: 'VIX vs VXN 分化',
        subtitle: '科技板块波动率溢价',
        value: 'Gap ' + util.formatChange(va.f5_vxn_vix.gap),
        detail: 'VIX ' + util.formatNumber(va.f5_vxn_vix.vix) + ' / VXN ' + util.formatNumber(va.f5_vxn_vix.vxn),
        score: util.formatNumber(va.f5_vxn_vix.score, 0),
        direction: va.f5_vxn_vix.direction,
        dirIcon: util.getDirectionIcon(va.f5_vxn_vix.direction),
        dirClass: util.getDirectionClass(va.f5_vxn_vix.direction),
        category: 'cross_asset'
      })
    }

    // F6: VXHYG
    if (va.f6_vxhyg) {
      factors.push({
        id: 'F6', name: 'VXHYG 高收益债波动率',
        subtitle: '信用波动率',
        value: util.formatNumber(va.f6_vxhyg.value),
        detail: '变化: ' + util.formatPercent(va.f6_vxhyg.change_pct),
        score: util.formatNumber(va.f6_vxhyg.score, 0),
        direction: va.f6_vxhyg.direction,
        dirIcon: util.getDirectionIcon(va.f6_vxhyg.direction),
        dirClass: util.getDirectionClass(va.f6_vxhyg.direction),
        category: 'cross_asset'
      })
    }

    // F7: GVZ
    if (va.f7_gvz) {
      factors.push({
        id: 'F7', name: 'GVZ 黄金波动率',
        subtitle: '贵金属波动率',
        value: util.formatNumber(va.f7_gvz.value),
        detail: '变化: ' + util.formatPercent(va.f7_gvz.change_pct),
        score: util.formatNumber(va.f7_gvz.score, 0),
        direction: va.f7_gvz.direction,
        dirIcon: util.getDirectionIcon(va.f7_gvz.direction),
        dirClass: util.getDirectionClass(va.f7_gvz.direction),
        category: 'cross_asset'
      })
    }

    // F8: RR x Residual
    if (va.f8_rr_residual) {
      factors.push({
        id: 'F8', name: 'RR x 残差共振',
        subtitle: '情绪-估值共振',
        value: util.formatChange(va.f8_rr_residual.composite_z) + 'sigma',
        detail: va.f8_rr_residual.is_resonance ? '双因子共振' : '未共振',
        score: util.formatNumber(va.f8_rr_residual.score, 0),
        direction: va.f8_rr_residual.is_resonance ? 'push' : 'neutral',
        dirIcon: va.f8_rr_residual.is_resonance ? '▲' : '○',
        dirClass: va.f8_rr_residual.is_resonance ? 'dir-push' : 'dir-neutral',
        category: 'composite'
      })
    }

    // F9: Stagflation
    if (va.f9_stagflation) {
      factors.push({
        id: 'F9', name: 'OVX x TIPS 滞胀',
        subtitle: '滞胀压力',
        value: 'OVX ' + util.formatNumber(va.f9_stagflation.ovx, 0),
        detail: 'TIPS ' + util.formatNumber(va.f9_stagflation.tips) + '%',
        score: util.formatNumber(va.f9_stagflation.score, 0),
        direction: va.f9_stagflation.direction,
        dirIcon: util.getDirectionIcon(va.f9_stagflation.direction),
        dirClass: util.getDirectionClass(va.f9_stagflation.direction),
        category: 'composite'
      })
    }

    // F10: Tail directional
    if (va.f10_tail_directional) {
      factors.push({
        id: 'F10', name: 'VVIX/VIX x RR',
        subtitle: '尾部风险x方向偏斜',
        value: util.formatNumber(va.f10_tail_directional.value),
        detail: '警戒线: 4.0',
        score: util.formatNumber(va.f10_tail_directional.score, 0),
        direction: va.f10_tail_directional.direction,
        dirIcon: util.getDirectionIcon(va.f10_tail_directional.direction),
        dirClass: util.getDirectionClass(va.f10_tail_directional.direction),
        category: 'composite'
      })
    }

    // F11: Tech spillover
    if (va.f11_tech_spillover) {
      factors.push({
        id: 'F11', name: 'VXN-VIX 科技溢出',
        subtitle: '科技板块传导',
        value: 'Gap ' + util.formatChange(va.f11_tech_spillover.gap),
        detail: va.f11_tech_spillover.trigger ? '已触发传导' : '未触发',
        score: util.formatNumber(va.f11_tech_spillover.score, 0),
        direction: va.f11_tech_spillover.direction,
        dirIcon: util.getDirectionIcon(va.f11_tech_spillover.direction),
        dirClass: util.getDirectionClass(va.f11_tech_spillover.direction),
        category: 'composite'
      })
    }

    // F12: Credit repair
    if (va.f12_credit_repair) {
      factors.push({
        id: 'F12', name: 'VXHYG x CDS 信用修复',
        subtitle: '信用修复因子',
        value: 'CDS ' + util.formatNumber(va.f12_credit_repair.cds) + 'bps',
        detail: 'VXHYG变化: ' + util.formatPercent(va.f12_credit_repair.vxhyg_chg),
        score: util.formatNumber(va.f12_credit_repair.score, 0),
        direction: va.f12_credit_repair.direction,
        dirIcon: util.getDirectionIcon(va.f12_credit_repair.direction),
        dirClass: util.getDirectionClass(va.f12_credit_repair.direction),
        category: 'composite'
      })
    }

    return factors
  }
})
