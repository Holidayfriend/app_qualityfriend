"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AppShell } from "../../../../components/dashboard/app-shell";
import { useI18n } from "../../../../components/i18n/i18n-provider";
import { BrandLoader } from "../../../../components/ui/brand-loader";
import { Button } from "../../../../components/ui/button";
import { PasswordInput } from "../../../../components/ui/password-input";
import { accountSettingsMessages } from "../../../../lib/i18n/dictionaries";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { dictionary, locale } = useI18n();
  const t = accountSettingsMessages[locale];
  const register = dictionary.register;
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!values.currentPassword) nextErrors.currentPassword = dictionary.common.required;
    if (!values.newPassword) nextErrors.newPassword = dictionary.common.required;
    else if (values.newPassword.length < 8) nextErrors.newPassword = dictionary.common.shortPassword;
    if (!values.confirmPassword) nextErrors.confirmPassword = dictionary.common.required;
    else if (values.confirmPassword !== values.newPassword) nextErrors.confirmPassword = t.passwordMismatch;
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      event.currentTarget.querySelector<HTMLElement>(`[name="${Object.keys(nextErrors)[0]}"]`)?.focus();
      return;
    }
    setErrors({});
    setSuccess(false);
    setBusy(true);
    const response = await fetch("/api/settings/account/password", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }).catch(() => null);
    const result = await response?.json().catch(() => null);
    setBusy(false);
    if (response?.ok) {
      setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSuccess(true);
      return;
    }
    if (response?.status === 401 && result?.error === "UNAUTHENTICATED") {
      router.replace("/login");
      return;
    }
    if (result?.error === "CURRENT_PASSWORD_INCORRECT") setErrors({ currentPassword: t.currentPasswordIncorrect });
    else if (result?.error === "PASSWORD_REUSED") setErrors({ newPassword: t.passwordReused });
    else setErrors({ form: t.passwordChangeError });
  }

  const strength = { low: register.passwordLow, medium: register.passwordMedium, strong: register.passwordStrong };
  return <AppShell activeItem="settings"><main className="p-4 sm:p-5 lg:p-7"><button type="button" onClick={()=>router.push("/settings/account")} className="mb-3.5 cursor-pointer text-[12.5px] font-semibold text-[var(--qf-text-muted)]">← {t.title}</button><h1 className="mb-5 text-xl font-bold">{t.changePassword}</h1><section className="max-w-2xl overflow-hidden rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)]"><header className="border-b border-[var(--qf-border)] px-5 py-4"><h2 className="text-sm font-bold">{t.passwordHeading}</h2><p className="mt-1 text-xs text-[var(--qf-text-muted)]">{t.passwordHelp}</p></header><form onSubmit={submit} noValidate><div className="space-y-4 p-5">{errors.form?<p role="alert" className="rounded-lg bg-[#fee2e2] px-4 py-3 text-[13px] font-medium text-[var(--qf-danger)]">{errors.form}</p>:null}{success?<p role="status" className="rounded-lg bg-[#dcfce7] px-4 py-3 text-[13px] font-medium text-[#166534]">{t.passwordChanged}</p>:null}<PasswordInput id="current-password" name="currentPassword" label={t.currentPassword} requiredMark value={values.currentPassword} error={errors.currentPassword} onChange={e=>setValues({...values,currentPassword:e.target.value})} autoComplete="current-password"/><PasswordInput id="new-password" name="newPassword" label={t.newPassword} requiredMark value={values.newPassword} error={errors.newPassword} onChange={e=>setValues({...values,newPassword:e.target.value})} autoComplete="new-password" strength={strength}/><PasswordInput id="confirm-password" name="confirmPassword" label={t.confirmPassword} requiredMark value={values.confirmPassword} error={errors.confirmPassword} onChange={e=>setValues({...values,confirmPassword:e.target.value})} autoComplete="new-password"/></div><footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--qf-border)] bg-[#fafaf8] p-4"><Button type="button" variant="secondary" onClick={()=>router.push("/settings/account")}>{t.cancel}</Button><Button type="submit" disabled={busy}>{t.updatePassword}</Button></footer></form></section>{busy?<BrandLoader overlay/>:null}</main></AppShell>;
}
