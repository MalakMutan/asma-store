import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Prod } from "./api";

type Item = { id: number; name: string; price: number; qty: number };
const Ctx = createContext<any>(null);
export const useCart = () => useContext(Ctx) as {
  items: Item[]; count: number; total: number;
  add: (p: Prod, n?: number) => void; setQty: (id: number, n: number) => void; remove: (id: number) => void; clear: () => void;
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>(() => { try { return JSON.parse(localStorage.getItem("cart") || "[]"); } catch { return []; } });
  useEffect(() => localStorage.setItem("cart", JSON.stringify(items)), [items]);
  const add = (p: Prod, n = 1) => setItems((s) => s.some((i) => i.id === p.id)
    ? s.map((i) => (i.id === p.id ? { ...i, qty: i.qty + n } : i))
    : [...s, { id: p.id, name: p.name_ar, price: p.sale_price ?? p.price, qty: n }]);
  const setQty = (id: number, n: number) => setItems((s) => s.map((i) => (i.id === id ? { ...i, qty: Math.max(1, Math.min(50, n || 1)) } : i)));
  const value = {
    items, add, setQty, remove: (id: number) => setItems((s) => s.filter((i) => i.id !== id)), clear: () => setItems([]),
    count: items.reduce((a, i) => a + i.qty, 0), total: items.reduce((a, i) => a + i.qty * i.price, 0),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
