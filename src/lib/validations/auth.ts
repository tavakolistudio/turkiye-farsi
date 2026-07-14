import { z } from "zod";
import { AUTH } from "@/server/auth/config";

const email = z
  .string()
  .min(1, "ایمیل را وارد کنید.")
  .email("ایمیل معتبر نیست.")
  .transform((v) => v.trim().toLowerCase());

const password = z
  .string()
  .min(AUTH.minPasswordLength, `رمز عبور باید حداقل ${AUTH.minPasswordLength} کاراکتر باشد.`);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "رمز عبور را وارد کنید."),
  next: z.string().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "تکرار رمز عبور مطابقت ندارد.",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "رمز فعلی را وارد کنید."),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "تکرار رمز عبور مطابقت ندارد.",
    path: ["confirmPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
