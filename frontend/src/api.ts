import { useEffect, useState } from "react";

export const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const money = (n: number) => `${Number(n).toFixed(2)} ₪`;

export type Cat = { id: number; name_ar: string; name_en: string; slug: string; description_ar: string; image_url: string | null; sort_order: number; is_visible: boolean };
export type Prod = { id: number; category_id: number; name_ar: string; slug: string; description_ar: string; usage_ar: string; price: number; sale_price: number | null; requires_pharmacist: boolean; is_featured: boolean; images: string[]; in_stock: boolean };
export type AProd = Omit<Prod, "in_stock"> & { stock_qty: number; is_visible: boolean };
export type Order = { id: number; order_number: string; status: string; customer_name: string; phone: string; zone_name: string; address: string; notes: string; subtotal: number; delivery_fee: number | null; total: number | null; items: { name_ar: string; unit_price: number; quantity: number }[] };

export async function api<T>(path: string, o: { method?: string; body?: any; token?: boolean } = {}): Promise<T> {
  const h: Record<string, string> = {};
  if (o.body) h["Content-Type"] = "application/json";
  const t = localStorage.getItem("tk");
  if (o.token && t) h.Authorization = `Bearer ${t}`;
  const r = await fetch(BASE + path, { method: o.method || "GET", headers: h, body: o.body ? JSON.stringify(o.body) : undefined });
  if (r.status === 401 && o.token) { localStorage.removeItem("tk"); location.href = "/admin/login"; }
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(typeof e.detail === "string" ? e.detail : "تحقق من البيانات المدخلة وحاول مرة أخرى");
  }
  return r.status === 204 ? (undefined as T) : r.json();
}

export function useFetch<T>(path: string, token = false) {
  const [d, setD] = useState<T | null>(null);
  const [e, setE] = useState("");
  const load = () => api<T>(path, { token }).then(setD).catch((x) => setE(x.message));
  useEffect(() => { setD(null); setE(""); load(); }, [path]);
  return { d, e, reload: load };
}
