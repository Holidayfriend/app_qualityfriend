import type { Metadata } from "next";
import { I18nProvider } from "../components/i18n/i18n-provider";
import { ToastProvider } from "../components/ui/toast-provider";
import { localeBootScript } from "../lib/i18n/locale";
import { resolveRequestLocale } from "../lib/i18n/request-locale";
import "./globals.css";

export const metadata: Metadata = {
  title: "QualityFriend",
  description: "Hotel Operations, einfach organisiert.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale, source } = await resolveRequestLocale();
  return (
    <html lang={locale} data-locale-source={source} className="h-full antialiased">
      <body className="min-h-full">
        <script id="qualityfriend-locale-boot" dangerouslySetInnerHTML={{ __html: localeBootScript() }} />
        <I18nProvider initialLocale={locale}><ToastProvider>{children}</ToastProvider></I18nProvider>
      </body>
    </html>
  );
}
