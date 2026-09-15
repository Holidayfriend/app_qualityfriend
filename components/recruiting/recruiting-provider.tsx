"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  type Applicant, type Employee, type Job,
} from "../../lib/recruiting/preview-data";

type Store = {
  jobs: Job[]; setJobs: (jobs: Job[]) => void;
  applicants: Applicant[]; setApplicants: (applicants: Applicant[]) => void;
  employees: Employee[]; setEmployees: (employees: Employee[]) => void;
};

const RecruitingContext = createContext<Store | null>(null);

export function RecruitingProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const value = useMemo(() => ({ jobs, setJobs, applicants, setApplicants, employees, setEmployees }), [jobs, applicants, employees]);
  return <RecruitingContext.Provider value={value}>{children}</RecruitingContext.Provider>;
}

export function useRecruiting() {
  const context = useContext(RecruitingContext);
  if (!context) throw new Error("useRecruiting must be used inside RecruitingProvider");
  return context;
}
