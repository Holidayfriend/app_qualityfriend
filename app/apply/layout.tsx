import { Suspense, type ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return <Suspense>{children}</Suspense>;
}
