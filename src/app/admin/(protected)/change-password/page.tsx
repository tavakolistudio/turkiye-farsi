import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "./change-form";

export const metadata: Metadata = { title: "تغییر رمز عبور", robots: { index: false } };

export default function ChangePasswordPage() {
  return (
    <div className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>تغییر رمز عبور</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
