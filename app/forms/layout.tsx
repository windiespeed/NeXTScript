import type { Metadata } from "next";

export const metadata: Metadata = { title: "Forms" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
