'use client'
import useSWR from 'swr'
import { useState } from 'react'
import type {
  ScoreData, RfData, PiRiskData, CyData,
  VolAlertData, DxyData, FxData, YieldDecompData,
  HedgeData, CftcData, SignalHistoryEntry,
  IcTrackingData, ShapData, RegimeIcData, CorrelationData, NavCurveData,
} from '@/types'
import {
  mockData, volAlertHistory,
  mockIcTracking, mockShap, mockRegimeIc, mockCorrelation, mockNavCurve,
} from '@/data/mockData'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const REFRESH = 5 * 60 * 1000   // 5 min polling

export function useScore() {
  const { data, error, isLoading } = useSWR<ScoreData>('/api/score', fetcher, { refreshInterval: REFRESH })
  return { data: data ?? mockData.score, error, isLoading }
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
  return { data: data ?? mockData.dxy, error, isLoading }
}

export function useFxPairs() {
  const { data, error, isLoading } = useSWR<FxData>('/api/fx-pairs', fetcher, { refreshInterval: REFRESH })
  return { data: data ?? mockData.fx, error, isLoading }
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

// Factor selector state — exported so AnalyticsPage and IcTracking share it
export function useFactorSelector(initial = 'F5') {
  return useState<string>(initial)
}
