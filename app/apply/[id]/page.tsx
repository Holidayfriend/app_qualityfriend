"use client";

import { use } from "react";
import { ClassicApplyPage } from "../../../components/recruiting/classic-apply-page";
import { useI18n } from "../../../components/i18n/i18n-provider";
import { getRecruitingMessages } from "../../../lib/i18n/recruiting-messages";
import { jobsSeed } from "../../../lib/recruiting/preview-data";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { locale } = useI18n();
  const t = getRecruitingMessages(locale);
  const seed = jobsSeed.find((item) => item.id === id);
  if (!seed) return <p className="job-apply-missing">Job not found.</p>;
  return (
    <ClassicApplyPage t={t} job={{
        title: seed.title, dept: seed.dept, type: seed.type, start: seed.start, notes: seed.notes,
        description: seed.description, autoMessage: seed.autoMessage, location: seed.location,
        cvRequired: seed.cvRequired, image: true, logo: true,
      }} />
  );
}
