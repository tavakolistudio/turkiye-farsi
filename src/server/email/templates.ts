import "server-only";
import { siteConfig } from "@/lib/site-config";

/**
 * Transactional email templates. Plain, RTL-safe HTML with inline styles —
 * mail clients strip <style> blocks and do not run scripts.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<body style="margin:0;padding:24px;background:#fdfcf3;font-family:Tahoma,Arial,sans-serif;color:#111;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #d9d9d9;border-top:3px solid #c8102e;">
    <div style="padding:24px;">
      <div style="font-size:20px;font-weight:bold;margin-bottom:4px;">${escapeHtml(siteConfig.name)}</div>
      <div style="font-size:12px;color:#6e6e6e;margin-bottom:20px;">روایت دقیق زندگی و خبر در ترکیه</div>
      <h1 style="font-size:18px;margin:0 0 12px;">${escapeHtml(heading)}</h1>
      ${bodyHtml}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #d9d9d9;font-size:11px;color:#6e6e6e;">
      این پیام به‌صورت خودکار از ${escapeHtml(siteConfig.name)} ارسال شده است.
    </div>
  </div>
</body>
</html>`;
}

/** Password-reset email. The link is valid for one hour and single-use. */
export function passwordResetEmail(link: string) {
  const safeLink = escapeHtml(link);
  return {
    subject: `بازیابی رمز عبور — ${siteConfig.name}`,
    text: [
      "برای تعیین رمز عبور جدید، لینک زیر را باز کنید:",
      link,
      "",
      "این لینک تا یک ساعت معتبر است و فقط یک بار قابل استفاده است.",
      "اگر شما این درخواست را نداده‌اید، این ایمیل را نادیده بگیرید؛ رمز عبور شما تغییر نمی‌کند.",
    ].join("\n"),
    html: layout(
      "بازیابی رمز عبور",
      `<p style="line-height:2;margin:0 0 20px;font-size:14px;">
         برای تعیین رمز عبور جدید روی دکمه زیر بزنید:
       </p>
       <p style="margin:0 0 20px;">
         <a href="${safeLink}"
            style="display:inline-block;background:#c8102e;color:#fff;text-decoration:none;padding:12px 22px;font-weight:bold;font-size:14px;">
           تعیین رمز عبور جدید
         </a>
       </p>
       <p style="line-height:2;margin:0 0 8px;font-size:12px;color:#6e6e6e;">
         اگر دکمه کار نکرد، این نشانی را در مرورگر باز کنید:
       </p>
       <p style="margin:0 0 20px;font-size:12px;direction:ltr;text-align:left;word-break:break-all;color:#6e6e6e;">
         ${safeLink}
       </p>
       <p style="line-height:2;margin:0;font-size:12px;color:#6e6e6e;">
         این لینک تا <strong>یک ساعت</strong> معتبر است و فقط یک بار قابل استفاده است.
         اگر شما این درخواست را نداده‌اید، این ایمیل را نادیده بگیرید — رمز عبور شما تغییر نمی‌کند.
       </p>`,
    ),
  };
}
