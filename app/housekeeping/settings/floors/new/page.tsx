"use client";
import Link from "next/link";
import { useActionState } from "react";
import {AppShell} from "../../../../../components/dashboard/app-shell";
import {useI18n} from "../../../../../components/i18n/i18n-provider";
import { BrandLoader } from "../../../../../components/ui/brand-loader";
import {housekeepingMessages,requestMessages} from "../../../../../lib/i18n/dictionaries";
import {createFloor} from "./actions";

const initialState={error:null};

export default function Page(){const{locale}=useI18n();const t=housekeepingMessages[locale];const[state,formAction,isPending]=useActionState(createFloor,initialState);return <AppShell activeItem="housekeeping" pageTitle={t.housekeeping}><main className="p-4 sm:p-5 lg:p-7"><Link href="/housekeeping/settings/floors" className="mb-4 inline-flex text-[12.5px] font-semibold text-[var(--qf-text-muted)]">← {t.back}</Link><section className="max-w-[420px] overflow-hidden rounded-[10px] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)]"><header className="border-b border-[var(--qf-border)] px-5 py-[14px] text-[14px] font-bold">{t.floor}</header><form className="space-y-3 p-5" action={formAction}><label className="block text-[12px] font-semibold text-[var(--qf-text-muted)]"><span className="mb-[5px] block">Code</span><input name="code" className="qf-field text-[13.5px]" placeholder="3" maxLength={40} required autoFocus/></label>{state.error?<p role="alert" className="text-[12px] text-red-700">{state.error}</p>:null}<button disabled={isPending} className="min-h-[34px] rounded-[7px] bg-[var(--qf-accent)] px-[14px] text-[13px] font-semibold text-white disabled:opacity-60">{t.save}</button></form></section></main>{isPending?<BrandLoader label={requestMessages[locale].loading} overlay/>:null}</AppShell>}
