import Script from "next/script";

function plausibleScriptUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL?.trim();
  if (!configured) return "https://plausible.io/js/script.js";
  try {
    const url = new URL(configured);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Loads analytics only when the corresponding public configuration exists. */
export function AnalyticsScripts({ nonce }: { nonce?: string }) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
  const plausibleSrc = plausibleDomain ? plausibleScriptUrl() : null;

  return (
    <>
      {gaId && (
        <>
          <Script
            id="ga-loader"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
            strategy="afterInteractive"
            nonce={nonce}
          />
          <Script id="ga-config" strategy="afterInteractive" nonce={nonce}>
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(gaId)},{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {plausibleDomain && plausibleSrc && (
        <Script
          id="plausible-analytics"
          src={plausibleSrc}
          data-domain={plausibleDomain}
          strategy="afterInteractive"
          nonce={nonce}
          defer
        />
      )}
    </>
  );
}
