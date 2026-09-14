"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  applicantsSeed, emailTemplatesSeed, employeesSeed, jobsSeed,
  type Applicant, type EmailTemplates, type Employee, type Job,
} from "../../lib/recruiting/preview-data";

type Store = {
  jobs: Job[]; setJobs: (jobs: Job[]) => void;
  applicants: Applicant[]; setApplicants: (applicants: Applicant[]) => void;
  employees: Employee[]; setEmployees: (employees: Employee[]) => void;
  emails: EmailTemplates; setEmails: (emails: EmailTemplates) => void;
};

const RecruitingContext = createContext<Store | null>(null);

export function RecruitingProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState(jobsSeed);
  const [applicants, setApplicants] = useState(applicantsSeed);
  const [employees, setEmployees] = useState(employeesSeed);
  const [emails, setEmails] = useState(emailTemplatesSeed);
  const value = useMemo(() => ({ jobs, setJobs, applicants, setApplicants, employees, setEmployees, emails, setEmails }), [jobs, applicants, employees, emails]);
  return <RecruitingContext.Provider value={value}>{children}</RecruitingContext.Provider>;
}

export function useRecruiting() {
  const context = useContext(RecruitingContext);
  if (!context) throw new Error("useRecruiting must be used inside RecruitingProvider");
  return context;
}
