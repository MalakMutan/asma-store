import { useState } from "react";
import { Link, Navigate, Outlet, useNavigate } from "react-router-dom";
import { api, AProd, BASE, Cat, money, Order, useFetch } from "./api";

const STATUS: Record<string, string> = { new: "جديد", pending_pharmacist: "بانتظار الصيدلانية", confirmed: "مؤكد", preparing: "قيد التجهيز", out_for_delivery: "في الطريق", delivered: "تم التسليم", cancelled: "ملغي" };
const fail = (e: Error) => alert(e.message);
const CLOUD = "ddyjag5s";
const PRESET = "asma_store"; // اسم الـ Upload preset (Unsigned) في Cloudinary

async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 800000) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("x"))), "image/jpeg", 0.85));
  } catch { return file; }
}

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

type PF = { category_id: string; name_ar: string; name_en: string; price: string; sale_price: string; stock_qty: string; description_ar: string; usage_ar: string; images: string[]; requires_pharmacist: boolean; is_featured: boolean };
const BLANK: PF = { category_id: "", name_ar: "", name_en: "", price: "", sale_price: "", stock_qty: "0", description_ar: "", usage_ar: "", images: [], requires_pharmacist: false, is_featured: false };
const toInit = (p: AProd): PF => ({
  category_id: String(p.category_id), name_ar: p.name_ar, name_en: (p as any).name_en ?? "", price: String(p.price),
  sale_price: p.sale_price == null ? "" : String(p.sale_price), stock_qty: String(p.stock_qty),
  description_ar: p.description_ar ?? "", usage_ar: p.usage_ar ?? "", images: p.images ?? [],
  requires_pharmacist: p.requires_pharmacist, is_featured: p.is_featured,
});

function ProductForm({ init, cats, label, onSave, onCancel }: { init: PF; cats: Cat[] | null; label: string; onSave: (b: any) => Promise<unknown>; onCancel?: () => void }) {
  const [f, setF] = useState<PF>(init);
  const [up, setUp] = useState(false);
  const [prog, setProg] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof PF) => (e: any) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function upload(files: FileList | null) {
    if (!files || !files.length) return;
    const list = Array.from(files);
    setUp(true); setProg(`0/${list.length}`);
    try {
      const urls: string[] = new Array(list.length);
      let next = 0, done = 0;
      const worker = async () => {
        while (next < list.length) {
          const i = next++;
          const fd = new FormData();
          fd.append("file", await shrink(list[i]));
          fd.append("upload_preset", PRESET);
          const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: "POST", body: fd });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j?.error?.message || "فشل رفع الصورة");
          urls[i] = j.secure_url;
          setProg(`${++done}/${list.length}`);
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      setF((x) => ({ ...x, images: [...x.images, ...urls] }));
    } catch (x: any) { fail(x); } finally { setUp(false); setProg(""); }
  }

  const first = (k: number) => setF((x) => ({ ...x, images: [x.images[k], ...x.images.filter((_, i) => i !== k)] }));
  const drop = (k: number) => setF((x) => ({ ...x, images: x.images.filter((_, i) => i !== k) }));
  const addLink = () => { const u = link.trim(); if (u) { setF((x) => ({ ...x, images: [...x.images, u] })); setLink(""); } };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    onSave({
      category_id: Number(f.category_id), name_ar: f.name_ar, name_en: f.name_en, price: Number(f.price),
      sale_price: f.sale_price === "" ? null : Number(f.sale_price), stock_qty: Number(f.stock_qty),
      description_ar: f.description_ar, usage_ar: f.usage_ar, images: f.images,
      requires_pharmacist: f.requires_pharmacist, is_featured: f.is_featured,
    }).finally(() => setBusy(false));
  };

  return (
    <form className="form" onSubmit={submit}>
      <select required value={f.category_id} onChange={set("category_id")}><option value="">القسم</option>{cats?.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}</select>
      <input required placeholder="الاسم بالعربي" value={f.name_ar} onChange={set("name_ar")} />
      <input placeholder="الاسم بالإنجليزي (اختياري)" value={f.name_en} onChange={set("name_en")} />
      <div className="row"><input required type="number" step="0.01" placeholder="السعر ₪" value={f.price} onChange={set("price")} style={{ flex: 1 }} /><input type="number" step="0.01" placeholder="سعر العرض" value={f.sale_price} onChange={set("sale_price")} style={{ flex: 1 }} /><input type="number" placeholder="الكمية" value={f.stock_qty} onChange={set("stock_qty")} style={{ flex: 1 }} /></div>
      <textarea placeholder="الوصف" value={f.description_ar} onChange={set("description_ar")} />
      <textarea placeholder="طريقة الاستخدام" value={f.usage_ar} onChange={set("usage_ar")} />
      <label className="btn alt" style={{ textAlign: "center", opacity: up ? 0.6 : 1 }}>
        {up ? `جارٍ رفع الصور ${prog}` : "📷 رفع صور من الجهاز (يمكن اختيار أكثر من صورة)"}
        <input type="file" accept="image/*" multiple hidden disabled={up} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
      </label>
      {!!f.images.length && <div className="row">{f.images.map((u, k) => (
        <div key={u + k} style={{ position: "relative" }}>
          <img src={u} alt="" width={72} height={72} style={{ borderRadius: 8, objectFit: "cover", border: k === 0 ? "2px solid var(--gold)" : "1px solid #ddd" }} />
          <button type="button" className="btn alt" aria-label="حذف الصورة" onClick={() => drop(k)} style={{ position: "absolute", top: -6, insetInlineEnd: -6, padding: "0 7px", borderRadius: 999 }}>✕</button>
          {k > 0 && <button type="button" className="btn alt" onClick={() => first(k)} style={{ display: "block", margin: "4px auto 0", padding: "0 8px", fontSize: 12 }}>رئيسية</button>}
        </div>
      ))}</div>}
      {!!f.images.length && <small>الصورة بالإطار الذهبي هي الصورة الرئيسية للمنتج.</small>}
      <div className="row"><input placeholder="أو الصقي رابط صورة" value={link} onChange={(e) => setLink(e.target.value)} style={{ flex: 1 }} /><button type="button" className="btn alt" onClick={addLink}>إضافة الرابط</button></div>
      <label><input type="checkbox" checked={f.requires_pharmacist} onChange={set("requires_pharmacist")} /> يتطلب مراجعة الصيدلانية قبل التأكيد</label>
      <label><input type="checkbox" checked={f.is_featured} onChange={set("is_featured")} /> منتج مميز (يظهر بالصفحة الرئيسية)</label>
      <div className="row">
        <button className="btn" disabled={up || busy}>{busy ? "جارٍ الحفظ…" : label}</button>
        {onCancel && <button type="button" className="btn alt" onClick={onCancel}>إلغاء</button>}
      </div>
    </form>
  );
}

export function Products() {
  const r = useFetch<AProd[]>("/api/admin/products", true);
  const cats = useFetch<Cat[]>("/api/admin/categories", true);
  const patch = (id: number, b: object) => api(`/api/admin/products/${id}`, { method: "PATCH", body: b, token: true }).then(r.reload).catch(fail);
  const [editing, setEditing] = useState<AProd | null>(null);
  const [fk, setFk] = useState(0);
  return (
    <>
      {editing && <>
        <h2>تعديل: {editing.name_ar}</h2>
        <ProductForm key={editing.id} init={toInit(editing)} cats={cats.d} label="حفظ التعديلات" onCancel={() => setEditing(null)}
          onSave={(b) => api(`/api/admin/products/${editing.id}`, { method: "PATCH", body: b, token: true }).then(() => { setEditing(null); r.reload(); }).catch(fail)} />
      </>}
      <h2>المنتجات</h2>
      <div className="scroll"><table>
        <thead><tr><th>المنتج</th><th>السعر ₪</th><th>الكمية</th><th>ظاهر</th><th></th></tr></thead>
        <tbody>{r.d?.map((p) => (
          <tr key={p.id}>
            <td>{p.name_ar}</td>
            <td><input key={p.price} type="number" defaultValue={p.price} style={{ width: 90 }} onBlur={(e) => Number(e.target.value) !== p.price && patch(p.id, { price: Number(e.target.value) })} /></td>
            <td><input key={p.stock_qty} type="number" defaultValue={p.stock_qty} style={{ width: 80 }} onBlur={(e) => Number(e.target.value) !== p.stock_qty && patch(p.id, { stock_qty: Number(e.target.value) })} /></td>
            <td><input type="checkbox" checked={p.is_visible} onChange={(e) => patch(p.id, { is_visible: e.target.checked })} /></td>
            <td className="row">
              <button className="btn" onClick={() => { setEditing(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}>تعديل</button>
              <button className="btn alt" onClick={() => confirm("حذف المنتج؟") && api(`/api/admin/products/${p.id}`, { method: "DELETE", token: true }).then(r.reload).catch(fail)}>حذف</button>
            </td>
          </tr>
        ))}</tbody>
      </table></div>
      <h2>إضافة منتج</h2>
      <ProductForm key={fk} init={BLANK} cats={cats.d} label="إضافة المنتج"
        onSave={(b) => api("/api/admin/products", { method: "POST", token: true, body: b }).then(() => { setFk(fk + 1); r.reload(); }).catch(fail)} />
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
