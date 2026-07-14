import type { Metadata } from "next";
import { validateResetToken } from "@/server/auth/password-reset";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "تنظیم رمز عبور جدید", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = token ? (await validateResetToken(token)) !== null : false;

  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-background px-4 py-10"
    >
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>تنظیم رمز عبور جدید</CardTitle>
          </CardHeader>
          <CardContent>
            {valid && token ? (
              <ResetForm token={token} />
            ) : (
              <div className="space-y-4">
                <Alert variant="error">لینک بازیابی نامعتبر یا منقضی شده است.</Alert>
                <a href="/admin/forgot-password" className="text-sm text-primary hover:underline">
                  درخواست لینک جدید
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
