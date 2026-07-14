import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "دسترسی غیرمجاز", robots: { index: false } };

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-md py-10">
      <Card>
        <CardHeader>
          <CardTitle>دسترسی غیرمجاز</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            شما مجوز لازم برای مشاهده این بخش را ندارید. اگر فکر می‌کنید اشتباهی رخ داده،
            با مدیر ارشد تماس بگیرید.
          </p>
          <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
            بازگشت به داشبورد
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
