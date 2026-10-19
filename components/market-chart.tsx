"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, LineSeries,
  createChart, createSeriesMarkers,
  type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi,
  type LineData, type Time, type UTCTimestamp, type WhitespaceData,
} from "lightweight-charts";
import type { MarketAnalysis } from "@/lib/market-analysis";
import type { MarketCandle } from "@/lib/binance";
import type { StrategySettings } from "@/lib/strategy";

interface ChartState {
  charts: IChartApi[];
  candles: ISeriesApi<"Candlestick">;
  volume: ISeriesApi<"Histogram">;
  emaFast?: ISeriesApi<"Line">;
  emaSlow?: ISeriesApi<"Line">;
  macd?: ISeriesApi<"Line">;
  macdSignal?: ISeriesApi<"Line">;
  histogram?: ISeriesApi<"Histogram">;
  rsi?: ISeriesApi<"Line">;
  markers: ISeriesMarkersPluginApi<Time>;
  previous: MarketCandle[];
  indicatorKey: string;
}

export function MarketChart({
  analysis, datasetKey, strategy, theme, showEma, showMacd, showRsi, resetKey,
}: {
  analysis: MarketAnalysis;
  datasetKey: string;
  strategy: StrategySettings;
  theme: "dark" | "light";
  showEma: boolean;
  showMacd: boolean;
  showRsi: boolean;
  resetKey: number;
}) {
  const priceRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<ChartState | null>(null);

  // Chart instances survive streaming updates, retaining the user's zoom and pan.
  useEffect(() => {
    if (!priceRef.current) return;
    const dark = theme === "dark";
    const text = dark ? "#8999b0" : "#69788c";
    const grid = dark ? "#172335" : "#e8edf4";
    const charts: IChartApi[] = [];
    const containers: HTMLDivElement[] = [];
    const makeChart = (element: HTMLDivElement, height: number) => {
      const chart = createChart(element, {
        width: element.clientWidth, height,
        layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: text, fontSize: 10, fontFamily: "Inter, Arial, sans-serif", attributionLogo: true },
        grid: { vertLines: { color: grid }, horzLines: { color: grid } },
        crosshair: { mode: CrosshairMode.Normal, vertLine: { color: "#607694", labelBackgroundColor: "#273c60" }, horzLine: { color: "#607694", labelBackgroundColor: "#273c60" } },
        rightPriceScale: { borderColor: grid, minimumWidth: 72 },
        timeScale: { borderColor: grid, timeVisible: true, secondsVisible: false, rightOffset: 7, barSpacing: 7 },
        handleScroll: true, handleScale: true,
      });
      charts.push(chart); containers.push(element);
      return chart;
    };
    const main = makeChart(priceRef.current, 370);
    const candles = main.addSeries(CandlestickSeries, { upColor: "#10cf9b", downColor: "#f35d71", borderVisible: false, wickUpColor: "#10cf9b", wickDownColor: "#f35d71" });
    main.priceScale("right").applyOptions({ scaleMargins: { top: 0.08, bottom: 0.22 } });
    const volume = main.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "volume", lastValueVisible: false, priceLineVisible: false });
    main.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });
    const state: ChartState = { charts, candles, volume, markers: createSeriesMarkers(candles, []), previous: [], indicatorKey: "" };
    const lineOptions = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
    if (showEma) {
      state.emaFast = main.addSeries(LineSeries, { ...lineOptions, color: "#f1b94b" });
      state.emaSlow = main.addSeries(LineSeries, { ...lineOptions, color: "#aa75ff" });
    }
    if (showMacd && macdRef.current) {
      const chart = makeChart(macdRef.current, 110);
      state.histogram = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
      state.macd = chart.addSeries(LineSeries, { ...lineOptions, color: "#4b8dff" });
      state.macdSignal = chart.addSeries(LineSeries, { ...lineOptions, color: "#f1b94b" });
    }
    if (showRsi && rsiRef.current) {
      const chart = makeChart(rsiRef.current, 110);
      state.rsi = chart.addSeries(LineSeries, { ...lineOptions, color: "#aa75ff", autoscaleInfoProvider: () => ({ priceRange: { minValue: 10, maxValue: 90 } }) });
      [30, 70].forEach(price => state.rsi?.createPriceLine({ price, color: "#69788c80", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "" }));
    }
    let syncing = false;
    charts.forEach(chart => chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (!range || syncing) return;
      syncing = true;
      charts.forEach(other => { if (other !== chart) other.timeScale().setVisibleLogicalRange(range); });
      syncing = false;
    }));
    const observer = new ResizeObserver(() => charts.forEach((chart, index) => chart.applyOptions({ width: containers[index].clientWidth })));
    containers.forEach(container => observer.observe(container));
    stateRef.current = state;
    return () => { stateRef.current = null; observer.disconnect(); charts.forEach(chart => chart.remove()); };
  }, [theme, showEma, showMacd, showRsi, datasetKey]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state || !analysis.candles.length) return;
    const next = analysis.candles;
    const previous = state.previous;
    const sameCandle = (a: MarketCandle, b: MarketCandle) => a.time === b.time && a.open === b.open && a.high === b.high && a.low === b.low && a.close === b.close && a.volume === b.volume;
    const prefixStable = previous.length > 0 && next.length >= previous.length && next[0].time === previous[0].time && previous.slice(0, -1).every((candle, index) => sameCandle(candle, next[index]));
    const volumePoint = (candle: MarketCandle) => ({ time: candle.time, value: candle.volume, color: candle.close >= candle.open ? "#10cf9b28" : "#f35d7128" });
    if (prefixStable) {
      next.slice(previous.length - 1).forEach(candle => { state.candles.update(candle); state.volume.update(volumePoint(candle)); });
    } else {
      state.candles.setData(next);
      state.volume.setData(next.map(volumePoint));
    }
    const price = next[0].close;
    state.candles.applyOptions({ priceFormat: { type: "price", precision: price < 1 ? 5 : 2, minMove: price < 1 ? 0.00001 : 0.01 } });
    const pad = <T extends LineData<UTCTimestamp>>(values: T[]): (T | WhitespaceData<UTCTimestamp>)[] => [
      ...next.filter(candle => !values.length || candle.time < values[0].time).map(candle => ({ time: candle.time })), ...values,
    ];
    // Open-candle ticks update price/volume only. Indicator lines and markers
    // change only when their closed-candle analysis changes.
    const indicatorKey = JSON.stringify([analysis.strategyVersion, analysis.closedCandle?.time, next[0].time, analysis.ema50.at(-1)?.value, analysis.ema200.at(-1)?.value, analysis.macd.at(-1)?.value, analysis.macdSignal.at(-1)?.value, analysis.rsi.at(-1)?.value]);
    if (state.indicatorKey !== indicatorKey) {
      state.emaFast?.setData(analysis.ema50); state.emaSlow?.setData(analysis.ema200);
      state.histogram?.setData(pad(analysis.histogram.map(point => ({ ...point, color: point.value >= 0 ? "#10cf9b8c" : "#f35d718c" }))));
      state.macd?.setData(pad(analysis.macd)); state.macdSignal?.setData(pad(analysis.macdSignal)); state.rsi?.setData(pad(analysis.rsi));
      state.markers.setMarkers(next.flatMap((candle, index) => {
        const signal = analysis.signals[index];
        if (!candle.closed || !signal || signal === "WAIT") return [];
        return [{ time: candle.time, position: signal === "BUY" ? "belowBar" as const : "aboveBar" as const, color: signal === "BUY" ? "#10cf9b" : "#f35d71", shape: signal === "BUY" ? "arrowUp" as const : "arrowDown" as const, text: signal }];
      }));
      state.indicatorKey = indicatorKey;
    }
    if (!previous.length) state.charts.forEach(chart => chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, next.length - 110), to: next.length + 7 }));
    state.previous = next;
  }, [analysis, datasetKey, theme, showEma, showMacd, showRsi]);

  useEffect(() => {
    if (!resetKey) return;
    const state = stateRef.current;
    if (state) state.charts.forEach(chart => chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, state.previous.length - 110), to: state.previous.length + 7 }));
  }, [resetKey]);

  return (
    <div className="market-chart-stack" aria-label="Interactive Binance price and closed-candle indicator charts">
      <div className="chart-main" ref={priceRef} role="img" aria-label="Binance candlestick chart with signals from completed candles. Drag to pan and scroll to zoom." />
      {showMacd && <div className="chart-indicator"><div className="chart-indicator-label">MACD <span>{strategy.macdFast}, {strategy.macdSlow}, {strategy.macdSignal}</span><strong style={{ color: "#4b8dff" }}>{analysis.macd.at(-1)?.value.toFixed(2) ?? "—"}</strong><strong style={{ color: "#f1b94b" }}>{analysis.macdSignal.at(-1)?.value.toFixed(2) ?? "—"}</strong></div><div ref={macdRef} /></div>}
      {showRsi && <div className="chart-indicator"><div className="chart-indicator-label">RSI <span>{strategy.rsiPeriod}</span><strong style={{ color: "#aa75ff" }}>{analysis.rsi.at(-1)?.value.toFixed(1) ?? "—"}</strong></div><div ref={rsiRef} /></div>}
    </div>
  );
}
