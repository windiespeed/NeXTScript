"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

interface MobileMenuCtx {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const Ctx = createContext<MobileMenuCtx>({ open: false, toggle: () => {}, close: () => {} });

export function MobileMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <Ctx.Provider value={{ open, toggle: () => setOpen(p => !p), close: () => setOpen(false) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useMobileMenu = () => useContext(Ctx);
