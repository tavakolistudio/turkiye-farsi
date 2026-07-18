"use client";

import { useEffect, useState } from "react";

const TZ = "Europe/Istanbul";

type Rates = { usdTry: number | null; usdToman: number | null };

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
  const [now, setNow] = useState<Date | null>(null);
  const [rates, setRates] = useState<Rates | null>(null);

  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 30_000);
    fetch("/api/rates")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Rates | null) => d && setRates(d))
      .catch(() => {});
    return () => clearInterval(tick);
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
