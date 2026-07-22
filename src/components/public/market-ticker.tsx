"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const TZ = "Europe/Istanbul";

type Rates = { usdTry: number | null; usdToman: number | null };

/**
 * A live clock as an external store (the pattern React recommends instead of
 * calling setState inside an effect). Server snapshot is 0 (placeholder); the
 * client starts ticking after hydration and updates every 30s. getSnapshot
 * returns a cached number so it stays referentially stable between ticks.
 */
let clockMs = 0;
function subscribeClock(onChange: () => void): () => void {
  clockMs = Date.now();
  const notify = setTimeout(onChange, 0); // publish the initial client value post-hydration
  const tick = setInterval(() => {
    clockMs = Date.now();
    onChange();
  }, 30_000);
  return () => {
    clearTimeout(notify);
    clearInterval(tick);
  };
}
function useClock(): Date | null {
  const ms = useSyncExternalStore(
    subscribeClock,
    () => clockMs,
    () => 0,
  );
  return ms ? new Date(ms) : null;
}

const timeFmt = new Intl.DateTimeFormat("fa-IR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const jalaliFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const gregFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
const tomanFmt = new Intl.NumberFormat("fa-IR");
const liraFmt = new Intl.NumberFormat("fa-IR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Header market ticker: live Istanbul (Turkey) clock, dual Jalali + Gregorian
 * date, and today's USD price in Lira and Toman. Rendered client-side so the
 * clock ticks and there is no server/client time mismatch; rates come from the
 * cached same-origin /api/rates endpoint.
 */
export function MarketTicker() {
  const now = useClock();
  const [rates, setRates] = useState<Rates | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/rates")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Rates | null) => {
        if (active && d) setRates(d);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Placeholder before mount to avoid hydration mismatch on the live values.
  if (!now) return <div className="market-ticker" aria-hidden suppressHydrationWarning />;

  return (
    <div className="market-ticker" suppressHydrationWarning>
      <span className="mt-clock">
        <span className="mt-city">استانبول</span> {timeFmt.format(now)}
      </span>
      <span className="mt-date">{jalaliFmt.format(now)}</span>
      <span className="mt-date mt-greg mt-sm-hide">{gregFmt.format(now)}</span>
      {rates?.usdTry != null && (
        <span className="mt-rate">دلار/لیر {liraFmt.format(rates.usdTry)}</span>
      )}
      {rates?.usdToman != null && (
        <span className="mt-rate mt-sm-hide">دلار/تومان {tomanFmt.format(rates.usdToman)}</span>
      )}
    </div>
  );
}
