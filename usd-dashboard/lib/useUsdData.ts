'use client'
import useSWR from 'swr'
import { useState } from 'react'
import type {
  ScoreData, RfData, PiRiskData, CyData,
  VolAlertData, DxyData, FxData, YieldDecompData,
  HedgeData, CftcData, SignalHistoryEntry,
  IcTrackingData, ShapData, RegimeIcData, CorrelationData, NavCurveData,
  DcaSignalData, MultiAssetSignalData,
} from '@/types'
import {
  mockData, volAlertHistory,
  mockIcTracking, mockShap, mockRegimeIc, mockCorrelation, mockNavCurve,
} from '@/data/mockData'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const REFRESH = 5 * 60 * 1000   // 5 min polling

// ─── Data validators ──────────────────────────────────────────────────────────
// Guard against partial API responses where Yahoo Finance failed (null prices).
// The ?? operator only falls back on null/undefined, not {price: null} objects.

function validDxy(d: DxyData | undefined): boolean {
  return d != null && d.price != null && isFinite(d.price as unknown as number)
}

function validFx(d: FxData | undefined): boolean {
  return d != null && Array.isArray(d.pairs) && d.pairs.length > 0 &&
    d.pairs[0].price != null && isFinite(d.pairs[0].price as unknown as number)
}

function validScore(d: ScoreData | undefined): boolean {
  return d != null && d.gamma != null && isFinite(d.gamma as unknown as number)
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useScore() {
  const { data, error, isLoading } = useSWR<ScoreData>('/api/score', fetcher, { refreshInterval: REFRESH })
  return { data: validScore(data) ? data! : mockData.score, error, isLoading }
}

export function useComponents() {
  const { data, error, isLoading } = useSWR<{ rf: RfData; pi_risk: PiRiskData; cy: CyData }>(
    '/api/components', fetcher, { refreshInterval: REFRESH }
  )
  return {
    rf:      data?.rf      ?? mockData.rf,
    pi_risk: data?.pi_risk ?? mockData.pi_risk,
    cy:      data?.cy      ?? mockData.cy,
    error, isLoading,
  }
}

export function useVolAlert() {
  const { data, error, isLoading } = useSWR<VolAlertData>('/api/vol-alert', fetcher, { refreshInterval: REFRESH })
  return { data: data ?? mockData.vol_alert, error, isLoading }
}

export function useDxy() {
  const { data, error, isLoading } = useSWR<DxyData>('/api/dxy', fetcher, { refreshInterval: REFRESH })
  // Fall back to mock if price is null/NaN (Yahoo Finance unavailable)
  return { data: validDxy(data) ? data! : { ...mockData.dxy, real_rate: data?.real_rate ?? mockData.dxy.real_rate, sofr: data?.sofr ?? mockData.dxy.sofr }, error, isLoading }
}

export function useFxPairs() {
  const { data, error, isLoading } = useSWR<FxData>('/api/fx-pairs', fetcher, { refreshInterval: REFRESH })
  // Fall back to mock if prices are null (Yahoo Finance unavailable)
  return { data: validFx(data) ? data! : mockData.fx, error, isLoading }
}

export function useYieldDecomp() {
  const { data, error, isLoading } = useSWR<YieldDecompData>('/api/yield', fetcher, { refreshInterval: REFRESH })
  return { data: data ?? mockData.yield_decomp, error, isLoading }
}

export function useHedge() {
  const { data, error, isLoading } = useSWR<HedgeData>('/api/hedge', fetcher, { refreshInterval: REFRESH })
  return { data: data ?? mockData.hedge, error, isLoading }
}

export function useSignalHistory() {
  const { data, error, isLoading } = useSWR<SignalHistoryEntry[]>('/api/history', fetcher, { refreshInterval: REFRESH })
  return { data: data ?? mockData.signal_history, error, isLoading }
}

// Vol alert trend history stays static for now (pipeline will append to it later)
export { volAlertHistory }

// ─── Phase 2 hooks ──────────────────────────────────────────────────────────

export function useIcTracking(factor = 'F5') {
  const { data, error, isLoading } = useSWR<IcTrackingData>(
    `/api/ic-tracking?factor=${factor}`, fetcher, { refreshInterval: REFRESH }
  )
  return { data: data ?? mockIcTracking[factor] ?? mockIcTracking['F5'], error, isLoading }
}

export function useShap() {
  const { data, error, isLoading } = useSWR<ShapData>('/api/shap', fetcher, { refreshInterval: REFRESH })
  return { data: data ?? mockShap, error, isLoading }
}

export function useRegimeIc() {
  const { data, error, isLoading } = useSWR<RegimeIcData>('/api/regime-ic', fetcher, { refreshInterval: REFRESH })
  return { data: data ?? mockRegimeIc, error, isLoading }
}

export function useCorrelation() {
  const { data, error, isLoading } = useSWR<CorrelationData>('/api/correlation', fetcher, { refreshInterval: REFRESH })
  return { data: data ?? mockCorrelation, error, isLoading }
}

export function useNavCurve() {
  const { data, error, isLoading } = useSWR<NavCurveData>('/api/nav', fetcher, { refreshInterval: REFRESH })
  return { data: data ?? mockNavCurve, error, isLoading }
}

// ─── DCA Signal (定投节奏信号灯) ─────────────────────────────────────────────

const defaultDca: DcaSignalData = {
  rhythm: 'hold',
  label: '维持不变',
  fragility: 50,
  confidence: 3,
  consensus: { bullish: 5, neutral: 4, bearish: 3, total: 12, alignment: 0.42 },
  reason: '数据加载中...',
}

export function useDcaSignal() {
  const { data, error, isLoading } = useSWR<DcaSignalData>('/api/dca-signal', fetcher, { refreshInterval: REFRESH })
  return { data: data ?? defaultDca, error, isLoading }
}

// ─── Multi-Asset Signals (通胀驱动的四资产信号塔) ──────────────────────────

const defaultMultiAsset: MultiAssetSignalData = {
  date: new Date().toISOString().slice(0, 10),
  regime: 'neutral',
  regimeLabel: '中性过渡',
  regimeReason: '数据加载中...',
  inflationAnchor: 2.20,
  wageGrowth: null,
  assets: [
    { asset: 'USD',    label: '美元',  symbol: 'DXY',    direction: 'neutral', confidence: 2, timeWindow: '1-3月',  reason: '数据加载中' },
    { asset: 'Gold',   label: '黄金',  symbol: 'XAU',    direction: 'neutral', confidence: 2, timeWindow: '3-6月',  reason: '数据加载中' },
    { asset: 'Stocks', label: '美股',  symbol: 'SPX',    direction: 'neutral', confidence: 2, timeWindow: '1-3月',  reason: '数据加载中' },
    { asset: 'Bonds',  label: '美债',  symbol: 'UST10Y', direction: 'neutral', confidence: 2, timeWindow: '6-12月', reason: '数据加载中' },
  ],
}

export function useMultiAssetSignals() {
  const { data, error, isLoading } = useSWR<MultiAssetSignalData>('/api/multi-asset-signals', fetcher, { refreshInterval: REFRESH })
  return { data: data ?? defaultMultiAsset, error, isLoading }
}

// Factor selector state — exported so AnalyticsPage and IcTracking share it
export function useFactorSelector(initial = 'F5') {
  return useState<string>(initial)
}
