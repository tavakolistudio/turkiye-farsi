import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "بازیابی رمز عبور", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-background px-4 py-10"
    >
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>بازیابی رمز عبور</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              ایمیل حساب خود را وارد کنید تا لینک بازیابی برای شما ارسال شود.
            </p>
            <ForgotForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
