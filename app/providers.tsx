"use client";

import { SessionProvider } from "next-auth/react";
import IdleLogout from "@/components/IdleLogout";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <IdleLogout />
      {children}
    </SessionProvider>
  );
}
