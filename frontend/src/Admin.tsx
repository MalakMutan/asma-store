import { useState } from "react";
import { Link, Navigate, Outlet, useNavigate } from "react-router-dom";
import { api, AProd, BASE, Cat, money, Order, useFetch } from "./api";

const STATUS: Record<string, string> = { new: "جديد", pending_pharmacist: "بانتظار الصيدلانية", confirmed: "مؤكد", preparing: "قيد التجهيز", out_for_delivery: "في الطريق", delivered: "تم التسليم", cancelled: "ملغي" };
const fail = (e: Error) => alert(e.message);

export function Login() {
  const nav = useNavigate();
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [e, setE] = useState("");
  async function go(ev: React.FormEvent) {
    ev.preventDefault();
    const r = await fetch(BASE + "/api/auth/login", { method: "POST", body: new URLSearchParams({ username: u, password: p }) });
    if (!r.ok) return setE("البريد أو كلمة المرور غير صحيحة");
    localStorage.setItem("tk", (await r.json()).access_token); nav("/admin");
  }
  return (
    <form className="form wrap" style={{ marginTop: 60 }} onSubmit={go}>
      <h2>دخول الصيدلانية</h2>
      <input type="email" required placeholder="البريد الإلكتروني" value={u} onChange={(x) => setU(x.target.value)} />
      <input type="password" required placeholder="كلمة المرور" value={p} onChange={(x) => setP(x.target.value)} />
      {e && <p className="err">{e}</p>}
      <button className="btn">دخول</button>
    </form>
  );
}

export function AdminShell() {
  const nav = useNavigate();
  if (!localStorage.getItem("tk")) return <Navigate to="/admin/login" />;
  return (
    <div className="wrap">
      <div className="tabs">
        <Link className="btn" to="/admin">الطلبات</Link><Link className="btn" to="/admin/products">المنتجات</Link>
        <Link className="btn" to="/admin/categories">الأقسام</Link><Link className="btn alt" to="/">المتجر</Link>
        <button className="btn alt" onClick={() => { localStorage.removeItem("tk"); nav("/admin/login"); }}>خروج</button>
      </div>
      <Outlet />
    </div>
  );
}

function OrderRow({ o, reload }: { o: Order; reload: () => void }) {
  const [fee, setFee] = useState(o.delivery_fee?.toString() ?? "");
  const patch = (b: object) => api(`/api/admin/orders/${o.id}`, { method: "PATCH", body: b, token: true }).then(reload).catch(fail);
  return (
    <details open={o.status === "new" || o.status === "pending_pharmacist"}>
      <summary>{o.order_number} · {o.customer_name} · {STATUS[o.status]} · {money(o.total ?? o.subtotal)}</summary>
      <p><a href={`tel:${o.phone}`}>📞 {o.phone}</a> · {o.zone_name} · {o.address}{o.notes && ` · ملاحظات: ${o.notes}`}</p>
      <ul>{o.items.map((i, k) => <li key={k}>{i.name_ar} × {i.quantity} ({money(i.unit_price)})</li>)}</ul>
      <div className="row">
        <input type="number" min={0} placeholder="سعر التوصيل ₪" value={fee} onChange={(e) => setFee(e.target.value)} style={{ width: 150 }} />
        <button className="btn alt" onClick={() => fee !== "" && patch({ delivery_fee: Number(fee) })}>حفظ التوصيل</button>
        <select value={o.status} onChange={(e) => patch({ status: e.target.value })} style={{ width: 170 }}>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
    </details>
  );
}

export function Orders() {
  const st = useFetch<any>("/api/admin/stats", true);
  const r = useFetch<Order[]>("/api/admin/orders", true);
  const s = st.d;
  return (
    <>
      {s && <div className="stats">
        <div className="stat"><b>{s.orders_need_attention}</b>طلبات تحتاج متابعة</div>
        <div className="stat"><b>{s.low_stock}</b>كمية قليلة</div>
        <div className="stat"><b>{s.expiring_soon}</b>صلاحية قريبة</div>
        <div className="stat"><b>{money(s.delivered_sales)}</b>مبيعات مسلّمة</div>
      </div>}
      <h2>الطلبات</h2>
      {r.d?.length === 0 && <p>لا توجد طلبات بعد.</p>}
      {r.d?.map((o) => <OrderRow key={o.id + o.status + o.total} o={o} reload={() => { r.reload(); st.reload(); }} />)}
    </>
  );
}

export function Products() {
  const r = useFetch<AProd[]>("/api/admin/products", true);
  const cats = useFetch<Cat[]>("/api/admin/categories", true);
  const patch = (id: number, b: object) => api(`/api/admin/products/${id}`, { method: "PATCH", body: b, token: true }).then(r.reload).catch(fail);
  const blank = { category_id: "", name_ar: "", name_en: "", price: "", sale_price: "", stock_qty: "0", description_ar: "", usage_ar: "", images: "", requires_pharmacist: false };
  const [f, setF] = useState<any>(blank);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    api("/api/admin/products", { method: "POST", token: true, body: {
      ...f, category_id: Number(f.category_id), price: Number(f.price), stock_qty: Number(f.stock_qty),
      sale_price: f.sale_price === "" ? null : Number(f.sale_price), images: f.images.split(",").map((x: string) => x.trim()).filter(Boolean),
    } }).then(() => { setF(blank); r.reload(); }).catch(fail);
  };
  return (
    <>
      <h2>المنتجات</h2>
      <div className="scroll"><table>
        <thead><tr><th>المنتج</th><th>السعر ₪</th><th>الكمية</th><th>ظاهر</th><th></th></tr></thead>
        <tbody>{r.d?.map((p) => (
          <tr key={p.id}>
            <td>{p.name_ar}</td>
            <td><input key={p.price} type="number" defaultValue={p.price} style={{ width: 90 }} onBlur={(e) => Number(e.target.value) !== p.price && patch(p.id, { price: Number(e.target.value) })} /></td>
            <td><input key={p.stock_qty} type="number" defaultValue={p.stock_qty} style={{ width: 80 }} onBlur={(e) => Number(e.target.value) !== p.stock_qty && patch(p.id, { stock_qty: Number(e.target.value) })} /></td>
            <td><input type="checkbox" checked={p.is_visible} onChange={(e) => patch(p.id, { is_visible: e.target.checked })} /></td>
            <td><button className="btn alt" onClick={() => confirm("حذف المنتج؟") && api(`/api/admin/products/${p.id}`, { method: "DELETE", token: true }).then(r.reload).catch(fail)}>حذف</button></td>
          </tr>
        ))}</tbody>
      </table></div>
      <h2>إضافة منتج</h2>
      <form className="form" onSubmit={add}>
        <select required value={f.category_id} onChange={set("category_id")}><option value="">القسم</option>{cats.d?.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}</select>
        <input required placeholder="الاسم بالعربي" value={f.name_ar} onChange={set("name_ar")} />
        <input placeholder="الاسم بالإنجليزي (اختياري)" value={f.name_en} onChange={set("name_en")} />
        <div className="row"><input required type="number" step="0.01" placeholder="السعر ₪" value={f.price} onChange={set("price")} style={{ flex: 1 }} /><input type="number" step="0.01" placeholder="سعر العرض" value={f.sale_price} onChange={set("sale_price")} style={{ flex: 1 }} /><input type="number" placeholder="الكمية" value={f.stock_qty} onChange={set("stock_qty")} style={{ flex: 1 }} /></div>
        <textarea placeholder="الوصف" value={f.description_ar} onChange={set("description_ar")} />
        <textarea placeholder="طريقة الاستخدام" value={f.usage_ar} onChange={set("usage_ar")} />
        <input placeholder="روابط الصور (افصل بينها بفاصلة)" value={f.images} onChange={set("images")} />
        <label><input type="checkbox" checked={f.requires_pharmacist} onChange={set("requires_pharmacist")} /> يتطلب مراجعة الصيدلانية قبل التأكيد</label>
        <button className="btn">إضافة المنتج</button>
      </form>
    </>
  );
}

export function Categories() {
  const r = useFetch<Cat[]>("/api/admin/categories", true);
  const patch = (id: number, b: object) => api(`/api/admin/categories/${id}`, { method: "PATCH", body: b, token: true }).then(r.reload).catch(fail);
  const [n, setN] = useState({ name_ar: "", name_en: "" });
  return (
    <>
      <h2>الأقسام</h2>
      {r.d?.map((c) => (
        <div className="row" key={c.id} style={{ marginBottom: 8 }}>
          <input key={c.name_ar} defaultValue={c.name_ar} style={{ maxWidth: 260 }} onBlur={(e) => e.target.value !== c.name_ar && patch(c.id, { name_ar: e.target.value })} />
          <label><input type="checkbox" checked={c.is_visible} onChange={(e) => patch(c.id, { is_visible: e.target.checked })} /> ظاهر</label>
        </div>
      ))}
      <h2>قسم جديد</h2>
      <form className="form" onSubmit={(e) => { e.preventDefault(); api("/api/admin/categories", { method: "POST", body: { ...n, sort_order: (r.d?.length ?? 0) }, token: true }).then(() => { setN({ name_ar: "", name_en: "" }); r.reload(); }).catch(fail); }}>
        <input required placeholder="الاسم بالعربي" value={n.name_ar} onChange={(e) => setN({ ...n, name_ar: e.target.value })} />
        <input placeholder="الاسم بالإنجليزي" value={n.name_en} onChange={(e) => setN({ ...n, name_en: e.target.value })} />
        <button className="btn">إضافة القسم</button>
      </form>
    </>
  );
}
