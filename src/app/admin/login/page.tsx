import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { safeRedirect } from "@/lib/safe-redirect";
import { siteConfig } from "@/lib/site-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "ورود به پنل مدیریت", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; changed?: string }>;
}) {
  const sp = await searchParams;
  const next = safeRedirect(sp.next, "/admin");

  // Already signed in → skip the form.
  const user = await getCurrentUser();
  if (user) redirect(next);

  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-background px-4 py-10"
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold">{siteConfig.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">پنل مدیریت تحریریه</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ورود</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sp.reset && (
              <Alert variant="success">رمز عبور شما بازنشانی شد. اکنون وارد شوید.</Alert>
            )}
            {sp.changed && (
              <Alert variant="success">رمز عبور تغییر کرد. لطفاً دوباره وارد شوید.</Alert>
            )}
            <LoginForm next={sp.next ? next : undefined} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
