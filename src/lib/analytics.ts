export type AnalyticsValue = string | number | boolean;
export type AnalyticsProperties = Record<string, AnalyticsValue | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    plausible?: (event: string, options?: { props?: AnalyticsProperties }) => void;
  }
}

/**
 * Provider-neutral analytics hook. It is deliberately a no-op when neither
 * optional public provider configuration is present.
 */
export function trackEvent(name: string, properties: AnalyticsProperties = {}) {
  if (typeof window === "undefined") return;
  const props = Object.fromEntries(
    Object.entries(properties).filter((entry): entry is [string, AnalyticsValue] => entry[1] !== undefined),
  );
  window.gtag?.("event", name, props);
  window.plausible?.(name, { props });
}
