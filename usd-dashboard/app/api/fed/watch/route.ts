import { NextResponse } from 'next/server'
import { fredLatest } from '@/lib/fredApi'
import type { FedWatchData, FomcEntry, HawkDoveScore } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/*
 * Fed Watch — FOMC statement timeline, speeches, hawk/dove tracking
 *
 * Data approach:
 * 1. FOMC meeting dates and key rate decisions → maintained manually + FRED
 * 2. Official speeches and hawk/dove scoring → curated timeline
 * 3. Dot plot and rate path → FRED fed funds target
 *
 * Since real-time Fed speech scraping requires external APIs,
 * we maintain a structured timeline that is periodically updated.
 * In production, this would connect to a news API or Fed RSS feed.
 */

// ── FOMC Timeline Data (curated, update periodically) ─────────────────────

const FOMC_TIMELINE: FomcEntry[] = [
  {
    date: '2026-03-19',
    type: 'meeting',
    title: 'FOMC 3月会议 — 维持利率不变',
    summary: '联邦基金利率目标区间维持在4.25%-4.50%。声明删除"进一步降息"措辞，强调"在有更大信心通胀持续向2%回归之前，委员会不认为适宜降低目标区间"。经济预测摘要(SEP)将2026年核心PCE预测上调至2.8%，GDP下调至1.7%。点阵图中位数暗示年内仅有一次25bp降息。',
    hawkdove: 1 as HawkDoveScore,
    has_vote: true,
    key_quotes: [
      '"We do not need to be in a hurry to adjust our policy stance."',
      '"Uncertainty around the economic outlook has increased."',
    ],
  },
  {
    date: '2026-03-21',
    type: 'speech',
    speaker: 'Jerome Powell (主席)',
    title: 'Powell 新闻发布会后记者会补充',
    summary: 'Powell重申耐心立场，指出劳动力市场仍然强劲，通胀回到2%的最后一英里"需要时间"。提及关税政策增加了经济前景的不确定性，但不急于做出判断。',
    hawkdove: 1 as HawkDoveScore,
    has_vote: true,
  },
  {
    date: '2026-03-25',
    type: 'speech',
    speaker: 'Christopher Waller (理事)',
    title: 'Waller: 通胀数据令人失望',
    summary: 'Waller表示近期通胀数据"令人失望"，支持在更长时间内维持限制性政策。但也指出如果关税冲击带来经济放缓，可能需要重新评估立场。',
    hawkdove: 2 as HawkDoveScore,
    has_vote: true,
  },
  {
    date: '2026-03-27',
    type: 'speech',
    speaker: 'Mary Daly (旧金山联储)',
    title: 'Daly: 政策处于良好位置',
    summary: 'Daly认为当前政策利率是限制性的，有时间观察数据。强调劳动力市场再平衡正在进行，但不愿过早降息导致通胀反弹。',
    hawkdove: 0 as HawkDoveScore,
    has_vote: true,
  },
  {
    date: '2026-04-01',
    type: 'speech',
    speaker: 'Raphael Bostic (亚特兰大联储)',
    title: 'Bostic: 年内可能仅需一次降息',
    summary: 'Bostic重申其基准预测是2026年仅降息一次，时间在年底。指出服务业通胀粘性仍然较高，住房成本回落速度慢于预期。',
    hawkdove: 1 as HawkDoveScore,
    has_vote: false,
  },
  {
    date: '2026-04-03',
    type: 'speech',
    speaker: 'Austan Goolsbee (芝加哥联储)',
    title: 'Goolsbee: 关税风险不容忽视',
    summary: 'Goolsbee警告关税政策可能造成"滞胀式"冲击，主张保持政策灵活性。他认为如果经济数据明显恶化，应迅速行动降息。对比其他官员，立场明显偏鸽。',
    hawkdove: -1 as HawkDoveScore,
    has_vote: true,
  },
  {
    date: '2026-04-04',
    type: 'speech',
    speaker: 'Lisa Cook (理事)',
    title: 'Cook: 需关注就业市场变化',
    summary: 'Cook表示虽然目前就业市场总体稳健，但领先指标出现放缓迹象。支持维持利率不变的同时保持警惕，如果就业数据走弱可能需要提前行动。',
    hawkdove: -1 as HawkDoveScore,
    has_vote: true,
  },
]

// 2026 FOMC meeting dates (approximate)
const FOMC_DATES = [
  '2026-01-29', '2026-03-19', '2026-05-07',
  '2026-06-18', '2026-07-29', '2026-09-17',
  '2026-11-05', '2026-12-16',
]

function getNextMeeting(today: string): string {
  for (const d of FOMC_DATES) {
    if (d > today) return d
  }
  return FOMC_DATES[FOMC_DATES.length - 1]
}

function buildHawkDoveTrend(timeline: FomcEntry[]): { date: string; score: number; ma5: number }[] {
  const sorted = [...timeline].sort((a, b) => a.date.localeCompare(b.date))
  const trend: { date: string; score: number; ma5: number }[] = []
  const window = 5

  for (let i = 0; i < sorted.length; i++) {
    const score = sorted[i].hawkdove
    const windowSlice = sorted.slice(Math.max(0, i - window + 1), i + 1)
    const ma5 = windowSlice.reduce((sum, e) => sum + e.hawkdove, 0) / windowSlice.length
    trend.push({
      date: sorted[i].date,
      score,
      ma5: +ma5.toFixed(2),
    })
  }
  return trend
}

export async function GET() {
  try {
    // Fetch current rate from FRED
    const fedfunds = await fredLatest('FEDFUNDS')
    const currentRate = isNaN(fedfunds) ? 4.375 : fedfunds
    const today = new Date().toISOString().slice(0, 10)
    const nextMeeting = getNextMeeting(today)

    // Build hawk/dove trend
    const hawkdove_trend = buildHawkDoveTrend(FOMC_TIMELINE)

    // Recent average hawk/dove
    const recentAvg = hawkdove_trend.length > 0
      ? hawkdove_trend[hawkdove_trend.length - 1].ma5
      : 0

    let assessment: string
    if (recentAvg > 0.5) {
      assessment = `联储整体立场偏鹰（鹰鸽指数均值 ${recentAvg > 0 ? '+' : ''}${recentAvg.toFixed(1)}），多数有投票权官员支持维持限制性利率更长时间。市场定价应反映降息预期延后。下次会议 ${nextMeeting}。`
    } else if (recentAvg < -0.5) {
      assessment = `联储整体立场偏鸽（鹰鸽指数均值 ${recentAvg.toFixed(1)}），预防性降息讨论增多。下次会议 ${nextMeeting}。`
    } else {
      assessment = `联储内部分歧加大（鹰鸽指数均值 ${recentAvg > 0 ? '+' : ''}${recentAvg.toFixed(1)}），鹰鸽阵营势均力敌。关注经济数据变化对分歧的打破。下次会议 ${nextMeeting}。`
    }

    const result: FedWatchData = {
      timeline: FOMC_TIMELINE.sort((a, b) => b.date.localeCompare(a.date)), // newest first
      hawkdove_trend,
      current_rate: currentRate,
      next_meeting: nextMeeting,
      dot_plot_median: 4.125,  // From March 2026 SEP
      assessment,
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('[fed-watch]', e)
    return NextResponse.json(mockFedWatch())
  }
}

function mockFedWatch(): FedWatchData {
  return {
    timeline: FOMC_TIMELINE.sort((a, b) => b.date.localeCompare(a.date)),
    hawkdove_trend: buildHawkDoveTrend(FOMC_TIMELINE),
    current_rate: 4.375,
    next_meeting: '2026-05-07',
    dot_plot_median: 4.125,
    assessment: '联储整体立场偏鹰，多数官员支持维持利率不变。',
  }
}
