// src/components/page/ProductionWeekProvider.tsx
// Provides the selected production week to the entire cookbook application.

"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ProductionWeekContextValue = {
  productionWeek: string;
  setProductionWeek: (productionWeek: string) => void;
  productionWeeks: string[];
};

const ProductionWeekContext =
  createContext<ProductionWeekContextValue | null>(null);

type Props = {
  children: ReactNode;
  productionWeeks: string[];
  initialProductionWeek: string;
};

export default function ProductionWeekProvider({
  children,
  productionWeeks,
  initialProductionWeek,
}: Props) {
  const [productionWeek, setProductionWeek] = useState(
    initialProductionWeek,
  );

  const value = useMemo(
    () => ({
      productionWeek,
      setProductionWeek,
      productionWeeks,
    }),
    [productionWeek, productionWeeks],
  );

  return (
    <ProductionWeekContext.Provider value={value}>
      {children}
    </ProductionWeekContext.Provider>
  );
}

export function useProductionWeek(): ProductionWeekContextValue {
  const context = useContext(ProductionWeekContext);

  if (!context) {
    throw new Error(
      "useProductionWeek must be used inside ProductionWeekProvider.",
    );
  }

  return context;
}