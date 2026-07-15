"use client";

export default function PublicError({ unstable_retry }: { error: Error; unstable_retry: () => void }) {
  return <div className="public-container public-empty" role="alert"><h1>بارگذاری صفحه ممکن نشد</h1><p>اتصال را بررسی کنید و دوباره تلاش کنید.</p><button type="button" onClick={unstable_retry}>تلاش دوباره</button></div>;
}
