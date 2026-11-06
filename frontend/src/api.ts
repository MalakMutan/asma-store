
import { useEffect, useState } from "react";

// Backend API URL
export const BASE = (
  import.meta.env.VITE_API_URL ||
  "https://asma-store.onrender.com"
).replace(/\/+$/, "");

// Currency formatter
export const money = (n: number) => `${Number(n).toFixed(2)} ₪`;

// Types
export type Cat = {
  id: number;
  name_ar: string;
  name_en: string;
  slug: string;
  description_ar: string;
  image_url: string | null;
  sort_order: number;
  is_visible: boolean;
};

export type Prod = {
  id: number;
  category_id: number;
  name_ar: string;
  slug: string;
  description_ar: string;
  usage_ar: string;
  price: number;
  sale_price: number | null;
  requires_pharmacist: boolean;
  is_featured: boolean;
  images: string[];
  in_stock: boolean;
};

export type AProd = Omit<Prod, "in_stock"> & {
  stock_qty: number;
  is_visible: boolean;
};

export type Order = {
  id: number;
  order_number: string;
  status: string;
  customer_name: string;
  phone: string;
  zone_name: string;
  address: string;
  notes: string;
  subtotal: number;
  delivery_fee: number | null;
  total: number | null;
  items: {
    name_ar: string;
    unit_price: number;
    quantity: number;
  }[];
};

// API request handler
export async function api<T>(
  path: string,
  o: {
    method?: string;
    body?: any;
    token?: boolean;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (o.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const token = localStorage.getItem("tk");

  if (o.token && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const response = await fetch(url, {
    method: o.method || "GET",
    headers,
    body:
      o.body !== undefined
        ? JSON.stringify(o.body)
        : undefined,
  });

  if (response.status === 401 && o.token) {
    localStorage.removeItem("tk");
    window.location.href = "/admin/login";
    throw new Error("انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجددًا");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    throw new Error(
      typeof error.detail === "string"
        ? error.detail
        : `حدث خطأ أثناء الاتصال بالخادم (${response.status})`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Fetch hook
export function useFetch<T>(path: string, token = false) {
  const [d, setD] = useState<T | null>(null);
  const [e, setE] = useState("");

  const load = () => {
    setE("");

    return api<T>(path, { token })
      .then(setD)
      .catch((error) => setE(error.message));
  };

  useEffect(() => {
    setD(null);
    setE("");
    load();
  }, [path]);

  return {
    d,
    e,
    reload: load,
  };
}
