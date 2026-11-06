import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, Cat, money, Prod, useFetch } from "./api";
import { useCart } from "./cart";

const ICON: Record<string, string> = { medicines: "💊", care: "🌿", beauty: "💄", "baby-care": "👶", "health-tools": "🩺" };

export function Layout() {
  const { count } = useCart();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  return (
    <>
      <header>
        <div className="wrap bar">
          <Link to="/"><img src="/logo.jpg" alt="الصيدلانية أسماء" /></Link>
          <form onSubmit={(e) => { e.preventDefault(); nav(`/search?q=${encodeURIComponent(q)}`); }}>
            <input placeholder="ابحث عن منتج…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث" />
          </form>
          <Link to="/cart" className="btn">🛒 {count}</Link>
        </div>
      </header>
      <main className="wrap"><Outlet /></main>
      <footer>الصيدلانية أسماء · Ph. Asma Store — التوصيل لجميع مناطق قطاع غزة</footer>
    </>
  );
}

function Card({ p }: { p: Prod }) {
  const { add } = useCart();
  const price = p.sale_price ?? p.price;
  return (
    <div className="card">
      <Link to={`/p/${p.slug}`}>{p.images[0] ? <img loading="lazy" src={p.images[0]} alt={p.name_ar} /> : <div className="ph">💊</div>}</Link>
      <div className="in">
        <div>
          <Link to={`/p/${p.slug}`}><b>{p.name_ar}</b></Link><br />
          {p.sale_price != null && <span className="tag">عرض</span>}
          {p.requires_pharmacist && <span className="tag">بمراجعة الصيدلانية</span>}
        </div>
        <div className="price">{money(price)}{p.sale_price != null && <span className="old">{money(p.price)}</span>}</div>
        <button className="btn" disabled={!p.in_stock} onClick={() => add(p)}>{p.in_stock ? "أضف للسلة" : "نفد"}</button>
      </div>
    </div>
  );
}
const Grid = ({ items }: { items: Prod[] }) => <div className="grid">{items.map((p) => <Card key={p.id} p={p} />)}</div>;

export function Home() {
  const cats = useFetch<Cat[]>("/api/categories");
  const feat = useFetch<Prod[]>("/api/products?featured=true&limit=8");
  const sale = useFetch<Prod[]>("/api/products?on_sale=true&limit=8");
  return (
    <>
      <section className="hero">
        <h1>صحتك وجمالك بعناية صيدلانية</h1>
        <p>علاجات، منتجات عناية وتجميل، ومستلزمات الأطفال والأدوات الصحية، توصيل لجميع مناطق قطاع غزة.</p>
      </section>
      {cats.e && <p className="err">{cats.e}</p>}
      <div className="cats">
        {cats.d?.map((c) => <Link key={c.id} to={`/c/${c.slug}`} className="cat"><span>{ICON[c.slug] ?? "🌿"}</span>{c.name_ar}</Link>)}
      </div>
      {!!feat.d?.length && <><h2>منتجات مميزة</h2><Grid items={feat.d} /></>}
      {!!sale.d?.length && <><h2>العروض</h2><Grid items={sale.d} /></>}
    </>
  );
}

export function List() {
  const { slug } = useParams();
  const [sp] = useSearchParams();
  const q = sp.get("q") ?? "";
  const r = useFetch<Prod[]>(`/api/products?${slug ? `category=${slug}` : `q=${encodeURIComponent(q)}`}`);
  const cats = useFetch<Cat[]>("/api/categories");
  return (
    <>
      <h2>{slug ? cats.d?.find((c) => c.slug === slug)?.name_ar ?? "" : `نتائج البحث: ${q}`}</h2>
      {r.e && <p className="err">{r.e}</p>}
      {r.d && (r.d.length ? <Grid items={r.d} /> : <p>لا توجد منتجات حاليًا.</p>)}
    </>
  );
}

export function ProductPage() {
  const { slug } = useParams();
  const r = useFetch<Prod>(`/api/products/${slug}`);
  const { add } = useCart();
  const [n, setN] = useState(1);
  const [i, setI] = useState(0);
  const p = r.d;
  if (r.e) return <p className="err">{r.e}</p>;
  if (!p) return <p>جارٍ التحميل…</p>;
  return (
    <div className="cols" style={{ marginTop: 20 }}>
      <div>
        {p.images[i] ? <img src={p.images[i]} alt={p.name_ar} style={{ width: "100%", borderRadius: 14 }} /> : <div className="ph" style={{ borderRadius: 14 }}>💊</div>}
        <div className="row" style={{ marginTop: 8 }}>{p.images.map((u, k) => <img key={k} src={u} alt="" width={56} height={56} style={{ borderRadius: 8, objectFit: "cover", cursor: "pointer" }} onClick={() => setI(k)} />)}</div>
      </div>
      <div>
        <h1 style={{ color: "var(--g)", marginTop: 0 }}>{p.name_ar}</h1>
        <div className="price" style={{ fontSize: 22 }}>{money(p.sale_price ?? p.price)}{p.sale_price != null && <span className="old">{money(p.price)}</span>}</div>
        {p.requires_pharmacist && <div className="note">هذا المنتج يحتاج مراجعة الصيدلانية، وسنتواصل معك قبل تأكيد الطلب.</div>}
        <p>{p.description_ar}</p>
        {p.usage_ar && <><b>طريقة الاستخدام</b><p>{p.usage_ar}</p></>}
        <div className="row">
          <input type="number" min={1} max={50} value={n} onChange={(e) => setN(Number(e.target.value))} style={{ width: 90 }} aria-label="الكمية" />
          <button className="btn" disabled={!p.in_stock} onClick={() => add(p, n)}>{p.in_stock ? "أضف للسلة" : "نفد"}</button>
        </div>
      </div>
    </div>
  );
}

export function Cart() {
  const { items, total, setQty, remove } = useCart();
  if (!items.length) return <><h2>السلة</h2><p>السلة فارغة. <Link to="/" className="btn">تصفح الأقسام</Link></p></>;
  return (
    <>
      <h2>السلة</h2>
      <div className="scroll"><table>
        <tbody>{items.map((i) => (
          <tr key={i.id}>
            <td>{i.name}</td><td>{money(i.price)}</td>
            <td><input type="number" min={1} max={50} value={i.qty} onChange={(e) => setQty(i.id, Number(e.target.value))} style={{ width: 80 }} aria-label="الكمية" /></td>
            <td>{money(i.price * i.qty)}</td>
            <td><button className="btn alt" onClick={() => remove(i.id)} aria-label="حذف">✕</button></td>
          </tr>
        ))}</tbody>
      </table></div>
      <p><b>مجموع المنتجات: {money(total)}</b></p>
      <div className="note">سعر التوصيل نحدده معك حسب ظروف اليوم قبل تأكيد الطلب.</div>
      <Link to="/checkout" className="btn">إتمام الطلب</Link>
    </>
  );
}

export function Checkout() {
  const { items, total, clear } = useCart();
  const nav = useNavigate();
  const zones = useFetch<{ id: number; name_ar: string }[]>("/api/zones");
  const [f, setF] = useState({ customer_name: "", phone: "", zone_id: "", address: "", notes: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  if (!items.length) return <p>السلة فارغة.</p>;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const o = await api<{ order_number: string; status: string }>("/api/orders", {
        method: "POST", body: { ...f, zone_id: Number(f.zone_id), items: items.map((i) => ({ product_id: i.id, quantity: i.qty })) },
      });
      clear();
      nav(`/done/${o.order_number}`, { state: { review: o.status === "pending_pharmacist" } });
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <>
      <h2>إتمام الطلب</h2>
      <form className="form" onSubmit={submit}>
        <input required placeholder="الاسم" value={f.customer_name} onChange={set("customer_name")} />
        <input required type="tel" placeholder="رقم الجوال" value={f.phone} onChange={set("phone")} />
        <select required value={f.zone_id} onChange={set("zone_id")}>
          <option value="">اختر المنطقة</option>
          {zones.d?.map((z) => <option key={z.id} value={z.id}>{z.name_ar}</option>)}
        </select>
        <textarea required placeholder="العنوان بالتفصيل" value={f.address} onChange={set("address")} />
        <textarea placeholder="ملاحظات (اختياري)" value={f.notes} onChange={set("notes")} />
        <b>مجموع المنتجات: {money(total)} + التوصيل (يُحدد لاحقًا)</b>
        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? "جارٍ الإرسال…" : "أرسل الطلب"}</button>
      </form>
    </>
  );
}

export function Done() {
  const { num } = useParams();
  const review = (useLocation().state as any)?.review;
  return (
    <div style={{ textAlign: "center", marginTop: 40 }}>
      <h2 style={{ border: 0 }}>وصلنا طلبك</h2>
      <p style={{ fontSize: 32, fontWeight: 800, color: "var(--g)", margin: 0 }}>{num}</p>
      <p>احتفظ برقم الطلب. ستتواصل معك الصيدلانية أسماء لتأكيد الطلب وتحديد سعر التوصيل.</p>
      {review && <div className="note">طلبك يتضمن منتجًا يحتاج مراجعة الصيدلانية قبل التأكيد.</div>}
      <Link to="/" className="btn">العودة للمتجر</Link>
    </div>
  );
}
