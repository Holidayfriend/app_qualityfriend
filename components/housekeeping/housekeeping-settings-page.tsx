"use client";

import { HousekeepingTopTabs } from "./housekeeping-top-tabs";
import {AppShell} from "../dashboard/app-shell";
import {useI18n} from "../i18n/i18n-provider";
import {housekeepingMessages} from "../../lib/i18n/dictionaries";
import {HousekeepingSettingsNav,type HousekeepingSettingsSection} from "./settings-nav";
import {FloorsSettings} from "./settings-sections";
import {DatabaseCategoriesSettings as CategoriesSettings} from "./database-categories-settings";
import {DatabaseExtrasSettings} from "./database-extras-settings";
import {DatabaseRoomsSettings as RoomsSettings} from "./database-rooms-settings";

export function HousekeepingSettingsPage({section="floors"}:{section?:HousekeepingSettingsSection}){
  const {locale}=useI18n();
  const t=housekeepingMessages[locale];
  return <AppShell activeItem="housekeeping" pageTitle={t.housekeeping}><main className="w-full p-4 pb-24 sm:p-5 lg:px-7 lg:py-6"><HousekeepingTopTabs active="settings" t={t} canAdmin={true}/><HousekeepingSettingsNav active={section} t={t}/>{section==="floors"?<FloorsSettings t={t}/>:null}{section==="categories"?<CategoriesSettings t={t} locale={locale}/>:null}{section==="rooms"?<RoomsSettings t={t} locale={locale}/>:null}{section==="extras"?<DatabaseExtrasSettings t={t} locale={locale}/>:null}</main></AppShell>;
}
