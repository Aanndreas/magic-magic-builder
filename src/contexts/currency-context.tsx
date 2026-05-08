"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type Currency = "USD" | "SEK";
export const SEK_RATE = 10.5;

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatPrice: (usd: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "SEK",
  setCurrency: () => {},
  formatPrice: (usd) => `${Math.round(usd * SEK_RATE)} kr`,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("SEK");

  useEffect(() => {
    const stored = localStorage.getItem("magic-builder-currency") as Currency | null;
    if (stored === "USD" || stored === "SEK") setCurrencyState(stored);
  }, []);

  function setCurrency(c: Currency) {
    setCurrencyState(c);
    localStorage.setItem("magic-builder-currency", c);
  }

  function formatPrice(usd: number): string {
    if (currency === "SEK") return `${Math.round(usd * SEK_RATE)} kr`;
    return `$${usd.toFixed(2)}`;
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
