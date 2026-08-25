import type { Metadata } from "next";
import { I18nProvider } from "../components/i18n/i18n-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "QualityFriend",
  description: "Hotel Operations, einfach organisiert.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full"><I18nProvider>{children}</I18nProvider></body>
    </html>
  );
}
