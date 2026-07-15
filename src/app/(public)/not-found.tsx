import Link from "next/link";
export default function PublicNotFound() {
  return <div className="public-container public-empty"><h1>صفحه پیدا نشد</h1><p>ممکن است این مطلب منتشر نشده، حذف شده یا آدرس آن تغییر کرده باشد.</p><Link href="/">بازگشت به صفحه اصلی</Link></div>;
}
