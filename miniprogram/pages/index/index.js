const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    loading: true,
    score: null,
    dxy: null,
    volAlert: null,
    // Formatted display values
    gammaScore: '--',
    gammaScoreClass: 'score-mid',
    signalText: '中性',
    signalClass: 'badge-neutral',
    dxyPrice: '--',
    dxyChange: '--',
    dxyChangeClass: '',
    rfScore: '--',
    piScore: '--',
    cyScore: '--',
    sigmaScore: '--',
    alertText: '平静',
    alertClass: 'badge-calm',
    dataDate: '--',
    dataTime: '--',
    realRate: '--',
    sofr: '--',
    pushCount: 0,
    suppressCount: 0,
    netDirection: '--'
  },

  onLoad() {
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh())
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const [score, dxy, volAlert] = await Promise.all([
        api.fetchScore(),
        api.fetchDxy(),
        api.fetchVolAlert()
      ])

      const updates = {
        loading: false,
        score,
        dxy,
        volAlert
      }

      // Score
      if (score) {
        updates.gammaScore = util.formatNumber(score.gamma, 0)
        updates.gammaScoreClass = util.getScoreClass(score.gamma)
        updates.signalText = util.getSignalText(score.signal)
        updates.signalClass = util.getSignalClass(score.signal)
        updates.rfScore = util.formatNumber(score.rf_score, 0)
        updates.piScore = util.formatNumber(score.pi_risk_score, 0)
        updates.cyScore = util.formatNumber(score.cy_score, 0)
        updates.sigmaScore = util.formatNumber(score.sigma_score, 0)
        updates.dataDate = score.data_date || '--'
        updates.dataTime = score.data_time || '--'
      }

      // DXY
      if (dxy) {
        updates.dxyPrice = util.formatNumber(dxy.price, 2)
        updates.dxyChange = util.formatPercent(dxy.change_1d_pct)
        updates.dxyChangeClass = dxy.change_1d_pct >= 0 ? 'text-green' : 'text-red'
        updates.realRate = util.formatNumber(dxy.real_rate, 2) + '%'
        updates.sofr = util.formatNumber(dxy.sofr, 2) + '%'
      }

      // Vol alert
      if (volAlert) {
        updates.alertText = util.getAlertText(volAlert.alert_level)
        updates.alertClass = util.getAlertClass(volAlert.alert_level)
        updates.pushCount = volAlert.push_count || 0
        updates.suppressCount = volAlert.suppress_count || 0
        updates.netDirection = volAlert.net_direction === 'expansion' ? '扩张' : '收缩'
      }

      this.setData(updates)

      // Draw gauge after data loaded
      setTimeout(() => this.drawGauge(score ? score.gamma : 50), 100)
    } catch (err) {
      console.error('Load data error:', err)
      this.setData({ loading: false })
      wx.showToast({ title: '数据加载失败', icon: 'none' })
    }
  },

  drawGauge(score) {
    const query = wx.createSelectorQuery()
    query.select('#gaugeCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getWindowInfo().pixelRatio
        const width = res[0].width
        const height = res[0].height

        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)

        const cx = width / 2
        const cy = height / 2 + 10
        const radius = Math.min(width, height) / 2 - 15
        const startAngle = Math.PI * 0.75
        const endAngle = Math.PI * 2.25
        const totalAngle = endAngle - startAngle

        // Clear
        ctx.clearRect(0, 0, width, height)

        // Background arc
        ctx.beginPath()
        ctx.arc(cx, cy, radius, startAngle, endAngle)
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'
        ctx.lineWidth = 10
        ctx.lineCap = 'round'
        ctx.stroke()

        // Red zone (0-35)
        const redEnd = startAngle + totalAngle * 0.35
        ctx.beginPath()
        ctx.arc(cx, cy, radius, startAngle, redEnd)
        ctx.strokeStyle = 'rgba(239,68,68,0.4)'
        ctx.lineWidth = 10
        ctx.lineCap = 'round'
        ctx.stroke()

        // Amber zone (35-65)
        const amberEnd = startAngle + totalAngle * 0.65
        ctx.beginPath()
        ctx.arc(cx, cy, radius - 0.5, redEnd, amberEnd)
        ctx.strokeStyle = 'rgba(245,158,11,0.4)'
        ctx.lineWidth = 10
        ctx.lineCap = 'butt'
        ctx.stroke()

        // Green zone (65-100)
        ctx.beginPath()
        ctx.arc(cx, cy, radius, amberEnd, endAngle)
        ctx.strokeStyle = 'rgba(34,197,94,0.4)'
        ctx.lineWidth = 10
        ctx.lineCap = 'round'
        ctx.stroke()

        // Score arc (filled)
        const scoreAngle = startAngle + totalAngle * (Math.min(100, Math.max(0, score)) / 100)
        var color = '#F59E0B'
        if (score >= 65) color = '#22C55E'
        else if (score < 35) color = '#EF4444'

        ctx.beginPath()
        ctx.arc(cx, cy, radius, startAngle, scoreAngle)
        ctx.strokeStyle = color
        ctx.lineWidth = 10
        ctx.lineCap = 'round'
        ctx.stroke()

        // Needle dot
        const nx = cx + (radius - 2) * Math.cos(scoreAngle)
        const ny = cy + (radius - 2) * Math.sin(scoreAngle)
        ctx.beginPath()
        ctx.arc(nx, ny, 6, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        ctx.beginPath()
        ctx.arc(nx, ny, 3, 0, Math.PI * 2)
        ctx.fillStyle = '#0A0E1A'
        ctx.fill()

        // Center score text
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = color
        ctx.font = 'bold 32px JetBrains Mono, monospace'
        ctx.fillText(Math.round(score), cx, cy - 8)

        ctx.fillStyle = '#9CA3AF'
        ctx.font = '12px sans-serif'
        ctx.fillText('综合评分', cx, cy + 14)

        // Labels
        ctx.font = '10px sans-serif'
        ctx.fillStyle = '#EF4444'
        ctx.textAlign = 'left'
        ctx.fillText('看空', cx - radius + 5, cy + 30)
        ctx.fillStyle = '#22C55E'
        ctx.textAlign = 'right'
        ctx.fillText('看多', cx + radius - 5, cy + 30)
      })
  }
})
