"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type LineData,
  type UTCTimestamp,
  type WhitespaceData,
} from "lightweight-charts";
import type { MarketFixture } from "@/lib/market-fixture";
export { createMarketFixture } from "@/lib/market-fixture";

export function MarketChart({
  fixture,
  theme,
  showEma,
  showMacd,
  showRsi,
  resetKey,
}: {
  fixture: MarketFixture;
  theme: "dark" | "light";
  showEma: boolean;
  showMacd: boolean;
  showRsi: boolean;
  resetKey: number;
}) {
  const priceRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!priceRef.current) return;
    const dark = theme === "dark";
    const text = dark ? "#8999b0" : "#69788c";
    const grid = dark ? "#172335" : "#e8edf4";
    const charts: IChartApi[] = [];
    const pad = <T extends LineData<UTCTimestamp>>(
      values: T[],
    ): (T | WhitespaceData<UTCTimestamp>)[] => [
      ...fixture.candles
        .filter((candle) => candle.time < values[0].time)
        .map((candle) => ({ time: candle.time })),
      ...values,
    ];
    const makeChart = (element: HTMLDivElement, height: number) => {
      const chart = createChart(element, {
        width: element.clientWidth,
        height,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: text,
          fontSize: 10,
          fontFamily: "Inter, Arial, sans-serif",
          attributionLogo: true,
        },
        grid: { vertLines: { color: grid }, horzLines: { color: grid } },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "#607694", labelBackgroundColor: "#273c60" },
          horzLine: { color: "#607694", labelBackgroundColor: "#273c60" },
        },
        rightPriceScale: { borderColor: grid, minimumWidth: 72 },
        timeScale: {
          borderColor: grid,
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 7,
          barSpacing: 7,
        },
        handleScroll: true,
        handleScale: true,
      });
      charts.push(chart);
      return chart;
    };
    const main = makeChart(priceRef.current, 370);
    const candles = main.addSeries(CandlestickSeries, {
      upColor: "#10cf9b",
      downColor: "#f35d71",
      borderVisible: false,
      wickUpColor: "#10cf9b",
      wickDownColor: "#f35d71",
      priceFormat: {
        type: "price",
        precision: fixture.candles[0].close < 1 ? 5 : 2,
        minMove: fixture.candles[0].close < 1 ? 0.00001 : 0.01,
      },
    });
    candles.setData(fixture.candles);
    main
      .priceScale("right")
      .applyOptions({ scaleMargins: { top: 0.08, bottom: 0.22 } });
    const volume = main.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volume.setData(
      fixture.candles.map((candle) => ({
        time: candle.time,
        value: candle.volume,
        color: candle.close >= candle.open ? "#10cf9b28" : "#f35d7128",
      })),
    );
    main
      .priceScale("volume")
      .applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });
    if (showEma) {
      const ema50 = main.addSeries(LineSeries, {
        color: "#f1b94b",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      const ema200 = main.addSeries(LineSeries, {
        color: "#aa75ff",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      ema50.setData(fixture.ema50);
      ema200.setData(fixture.ema200);
    }
    createSeriesMarkers(
      candles,
      fixture.candles.flatMap((candle, index) => {
        const signal = fixture.signals[index];
        if (signal === "WAIT") return [];
        return [
          {
            time: candle.time,
            position:
              signal === "BUY" ? ("belowBar" as const) : ("aboveBar" as const),
            color: signal === "BUY" ? "#10cf9b" : "#f35d71",
            shape:
              signal === "BUY" ? ("arrowUp" as const) : ("arrowDown" as const),
            text: signal,
          },
        ];
      }),
    );
    if (showMacd && macdRef.current) {
      const macdChart = makeChart(macdRef.current, 110);
      const histogram = macdChart.addSeries(HistogramSeries, {
        priceLineVisible: false,
        lastValueVisible: false,
      });
      histogram.setData(
        pad(
          fixture.histogram.map((point) => ({
            ...point,
            color: point.value >= 0 ? "#10cf9b8c" : "#f35d718c",
          })),
        ),
      );
      const macd = macdChart.addSeries(LineSeries, {
        color: "#4b8dff",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const signal = macdChart.addSeries(LineSeries, {
        color: "#f1b94b",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      macd.setData(pad(fixture.macd));
      signal.setData(pad(fixture.macdSignal));
    }
    if (showRsi && rsiRef.current) {
      const rsiChart = makeChart(rsiRef.current, 110);
      const rsi = rsiChart.addSeries(LineSeries, {
        color: "#aa75ff",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        autoscaleInfoProvider: () => ({
          priceRange: { minValue: 10, maxValue: 90 },
        }),
      });
      rsi.setData(pad(fixture.rsi));
      rsi.createPriceLine({
        price: 70,
        color: "#69788c80",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "",
      });
      rsi.createPriceLine({
        price: 30,
        color: "#69788c80",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "",
      });
    }
    const visibleRange = {
      from: fixture.candles.length - 110,
      to: fixture.candles.length + 7,
    };
    charts.forEach((chart) =>
      chart.timeScale().setVisibleLogicalRange(visibleRange),
    );
    let syncing = false;
    charts.forEach((chart) =>
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (!range || syncing) return;
        syncing = true;
        charts.forEach((other) => {
          if (other !== chart) other.timeScale().setVisibleLogicalRange(range);
        });
        syncing = false;
      }),
    );
    const observer = new ResizeObserver(() => {
      if (priceRef.current)
        main.applyOptions({ width: priceRef.current.clientWidth });
      const others = [
        showMacd ? macdRef.current : null,
        showRsi ? rsiRef.current : null,
      ].filter((element): element is HTMLDivElement => element !== null);
      others.forEach((element, index) =>
        charts[index + 1]?.applyOptions({ width: element.clientWidth }),
      );
    });
    observer.observe(priceRef.current);
    return () => {
      observer.disconnect();
      charts.forEach((chart) => chart.remove());
    };
  }, [fixture, theme, showEma, showMacd, showRsi, resetKey]);

  return (
    <div
      className="market-chart-stack"
      aria-label="Interactive fixture price and technical indicator charts"
    >
      <div
        className="chart-main"
        ref={priceRef}
        role="img"
        aria-label="Candlestick chart with default strategy signals calculated from closed fixture candles. Drag to pan and scroll to zoom."
      />
      {showMacd && (
        <div className="chart-indicator">
          <div className="chart-indicator-label">
            MACD <span>12, 26, 9</span>
            <strong style={{ color: "#4b8dff" }}>
              {fixture.macd.at(-1)?.value.toFixed(2)}
            </strong>
            <strong style={{ color: "#f1b94b" }}>
              {fixture.macdSignal.at(-1)?.value.toFixed(2)}
            </strong>
          </div>
          <div ref={macdRef} />
        </div>
      )}
      {showRsi && (
        <div className="chart-indicator">
          <div className="chart-indicator-label">
            RSI <span>14</span>
            <strong style={{ color: "#aa75ff" }}>
              {fixture.rsi.at(-1)?.value.toFixed(1)}
            </strong>
          </div>
          <div ref={rsiRef} />
        </div>
      )}
    </div>
  );
}
