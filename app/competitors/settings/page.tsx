"use client";

import Link from "next/link";
import { CompetitorSettings } from "../../../components/forecast/competitor-settings";
import { ForecastShell } from "../../../components/forecast/forecast-ui";
import { useI18n } from "../../../components/i18n/i18n-provider";
import { moduleNavigationMessages } from "../../../lib/i18n/dictionaries";

export default function Page() {
  const { locale } = useI18n();
  return (
    <ForecastShell activeItem="competitors">
      <Link href="/competitors" className="mb-3.5 inline-block cursor-pointer text-[12.5px] font-semibold text-[var(--qf-text-muted)] hover:text-[var(--qf-accent)]">← {moduleNavigationMessages[locale].competitors}</Link>
      <CompetitorSettings />
    </ForecastShell>
  );
}
