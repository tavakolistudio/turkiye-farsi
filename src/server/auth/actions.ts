"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword, hashPassword } from "./password";
import { createSession, destroyCurrentSession, revokeAllUserSessions } from "./session";
import { getCurrentUser } from "./current-user";
import { getRequestMeta } from "./request-meta";
import {
  isLoginRateLimited,
  recordLoginAttempt,
  clearFailedAttempts,
} from "./rate-limit";
import { createResetToken, consumeResetToken } from "./password-reset";
import { auditLog } from "@/server/audit/log";
import { assertSameOrigin } from "@/server/security/csrf";
import { safeRedirect } from "@/lib/safe-redirect";
import { siteConfig } from "@/lib/site-config";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "@/lib/validations/auth";

export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** Dev-only convenience: reset link when email delivery is not configured. */
  devResetLink?: string;
}

const CSRF_MESSAGE =
  "درخواست نامعتبر است. لطفاً صفحه را تازه کنید و دوباره تلاش کنید.";

/** Login. On success, redirects to a validated same-site target. */
export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertSameOrigin();
  } catch {
    return { error: CSRF_MESSAGE };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { error: "اطلاعات واردشده معتبر نیست.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, password, next } = parsed.data;
  const { ip, userAgent } = await getRequestMeta();

  if (await isLoginRateLimited(email, ip)) {
    await recordLoginAttempt(email, ip, false);
    await auditLog({ action: "auth.login.rate_limited", entityType: "auth", ip, userAgent, after: { email } });
    return { error: "تلاش‌های ورود بیش از حد مجاز است. چند دقیقه بعد دوباره تلاش کنید." };
  }

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });

  const valid =
    !!user && !!user.passwordHash && (await verifyPassword(password, user.passwordHash));

  if (!valid || !user.isActive) {
    await recordLoginAttempt(email, ip, false);
    await auditLog({
      action: "auth.login.failed",
      entityType: "auth",
      entityId: user?.id,
      ip,
      userAgent,
      after: { email, reason: !user ? "no_user" : !user.isActive ? "inactive" : "bad_password" },
    });
    return { error: "ایمیل یا رمز عبور نادرست است." };
  }

  await createSession(user.id, { ip, userAgent });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordLoginAttempt(email, ip, true);
  await clearFailedAttempts(email, ip);
  await auditLog({ action: "auth.login.success", entityType: "auth", entityId: user.id, ip, userAgent });

  redirect(safeRedirect(next, "/admin"));
}

/** Logout the current session. */
export async function logoutAction(): Promise<void> {
  await assertSameOrigin();
  const user = await getCurrentUser();
  const { ip, userAgent } = await getRequestMeta();
  await destroyCurrentSession();
  if (user) {
    await auditLog({ action: "auth.logout", entityType: "auth", entityId: user.id, ip, userAgent });
  }
  redirect("/admin/login");
}

/**
 * Forgot password. Always returns a generic success to avoid user enumeration.
 * If the account exists, a reset token is created; without email configured we
 * surface the link in dev only.
 */
export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertSameOrigin();
  } catch {
    return { error: CSRF_MESSAGE };
  }

  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: "ایمیل معتبر نیست.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { email } = parsed.data;
  const { ip, userAgent } = await getRequestMeta();

  const user = await prisma.user.findFirst({ where: { email, deletedAt: null, isActive: true } });
  let devResetLink: string | undefined;
  if (user) {
    const token = await createResetToken(user.id);
    const link = `${siteConfig.url}/admin/reset-password?token=${token}`;
    await auditLog({ action: "auth.password.reset_requested", entityType: "auth", entityId: user.id, ip, userAgent });
    // TODO(email): send `link` via Resend once configured (Phase 8).
    if (process.env.NODE_ENV !== "production") {
      console.log(`[password-reset] ${email}: ${link}`);
      devResetLink = link;
    }
  }

  return {
    ok: true,
    message: "اگر این ایمیل در سیستم موجود باشد، لینک بازیابی برای آن ارسال می‌شود.",
    devResetLink,
  };
}

/** Reset password using a token. Redirects to login on success. */
export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertSameOrigin();
  } catch {
    return { error: CSRF_MESSAGE };
  }

  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: "اطلاعات واردشده معتبر نیست.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const userId = await consumeResetToken(parsed.data.token, parsed.data.password);
  const { ip, userAgent } = await getRequestMeta();
  if (!userId) {
    return { error: "لینک بازیابی نامعتبر یا منقضی شده است." };
  }
  await auditLog({ action: "auth.password.reset", entityType: "auth", entityId: userId, ip, userAgent });
  redirect("/admin/login?reset=1");
}

/** Change password for the current user; revokes all other sessions. */
export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertSameOrigin();
  } catch {
    return { error: CSRF_MESSAGE };
  }

  const user = await getCurrentUser();
  if (!user) return { error: "برای این عملیات باید وارد شوید." };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: "اطلاعات واردشده معتبر نیست.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  const ok =
    !!dbUser?.passwordHash &&
    (await verifyPassword(parsed.data.currentPassword, dbUser.passwordHash));
  if (!ok) return { error: "رمز عبور فعلی نادرست است." };

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  // Revoke all sessions, then the caller will need to sign in again.
  await revokeAllUserSessions(user.id);
  await destroyCurrentSession();

  const { ip, userAgent } = await getRequestMeta();
  await auditLog({ action: "auth.password.changed", entityType: "auth", entityId: user.id, ip, userAgent });

  redirect("/admin/login?changed=1");
}
