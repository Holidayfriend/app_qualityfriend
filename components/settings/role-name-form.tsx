"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "../dashboard/app-shell";
import { useI18n } from "../i18n/i18n-provider";
import { Button } from "../ui/button";
import { BrandLoader } from "../ui/brand-loader";
import { Input } from "../ui/input";
import { customRoleMessages, requestMessages } from "../../lib/i18n/dictionaries";

import { hotelRoleName, type HotelRoleOption } from "../../lib/auth/role-policy";

type Names = Record<"en" | "de" | "it", string>;

export function RoleNameForm({ role }: { role?: HotelRoleOption }) {
  const { locale } = useI18n();
  return <RoleNameFields key={`${role?.key ?? "new"}:${locale}`} role={role} />;
}

function RoleNameFields({ role }: { role?: HotelRoleOption }) {
  const { locale } = useI18n();
  const router = useRouter();
  const t = customRoleMessages[locale];
  const request = requestMessages[locale];
  const [name, setName] = useState(role ? hotelRoleName(role, locale) : "");
  const [nameError, setNameError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!name.trim() || name.trim().length > 180) {
      setNameError(t.required);
      return;
    }
    setNameError("");
    setBusy(true);
    try {
      let response: Response;
      if (role) {
        response = await fetch(`/api/settings/roles/${encodeURIComponent(role.key)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), locale }) });
      } else {
        const translated = await fetch("/api/settings/roles/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), locale }) });
        if (!translated.ok) throw new Error();
        const names = await translated.json() as Names;
        response = await fetch("/api/settings/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nameEn: names.en, nameDe: names.de, nameIt: names.it }) });
      }
      if (!response.ok) throw new Error();
      router.push("/settings/roles");
    } catch {
      setError(request.failed);
      setBusy(false);
    }
  }

  return <AppShell activeItem="settings"><main className="p-4 sm:p-5 lg:p-7">
    <Link href="/settings/roles" className="mb-4 inline-block text-sm font-semibold text-[var(--qf-text-muted)]">← {t.back}</Link>
    <section className="max-w-2xl rounded-xl border border-[var(--qf-border)] bg-white p-5 sm:p-6">
      <h1 className="text-xl font-bold">{role ? t.edit : t.create}</h1>
      <p className="mt-2 text-sm text-[var(--qf-text-muted)]">{role ? t.editDescription : t.description}</p>
      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        {error ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
          <Input id="role-name" label={t.name} value={name} requiredMark error={nameError} maxLength={180} onChange={(event) => { setName(event.target.value); if (event.target.value.trim()) setNameError(""); }} />
        </fieldset>
        <p className="text-sm text-[var(--qf-text-muted)]">{role ? t.editAccess : t.access}</p>
        <div className="flex justify-end"><Button type="submit" disabled={busy}>{t.save}</Button></div>
      </form>
    </section>
    {busy ? <BrandLoader label={request.loading} overlay /> : null}
  </main></AppShell>;
}
