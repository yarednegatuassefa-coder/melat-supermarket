import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import ProductCreateForm from "./ProductCreateForm";
import { PosScreen, PurchasingScreen, CashScreen, FinanceScreen } from "./Operations";

type User = { id: string; username: string; fullName: string; role: "owner" | "manager" | "cashier" | "inventory_clerk"; mustChangePassword: boolean };
type Product = { id: string; sku: string; barcode: string | null; name_en: string; name_am: string | null; base_unit: string; tracks_expiry: boolean; quantity_on_hand: string; weighted_average_cost: string; selling_price: string | null };
type Movement = { id: string; sku: string; name_en: string; movement_type: string; quantity_delta: string; unit_cost: string; source_type: string; occurred_at: string; username: string };
type Staff = { id: string; username: string; full_name: string; role: string; is_active: boolean; last_login_at: string | null };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body as T;
}

const money = (value: string | null) => value === null ? "—" : new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB" }).format(Number(value));
const dateTime = (value: string) => new Date(value).toLocaleString();
const roles: Record<User["role"], string> = { owner: "Owner", manager: "Manager", cashier: "Cashier", inventory_clerk: "Inventory clerk" };

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [staffForm, setStaffForm] = useState({ username: "", fullName: "", password: "", role: "cashier" });

  const loadData = useCallback(async () => {
    if (!user) return;
    setError("");
    try {
      if (["overview", "inventory"].includes(tab)) {
        const result = await api<{ products: Product[] }>("/api/inventory/products");
        setProducts(result.products);
      }
      if (tab === "movements") {
        const result = await api<{ movements: Movement[] }>("/api/inventory/movements");
        setMovements(result.movements);
      }
      if (tab === "staff" && user.role === "owner") {
        const result = await api<{ users: Staff[] }>("/api/auth/users");
        setStaff(result.users);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load data."); }
  }, [tab, user]);

  useEffect(() => {
    api<{ user: User }>("/api/auth/me").then((result) => setUser(result.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { void loadData(); }, [loadData]);

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await api<{ user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      setUser(result.user); setPassword(""); setTab("overview");
    } catch (e) { setError(e instanceof Error ? e.message : "Sign in failed."); }
    finally { setBusy(false); }
  }

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST" }); } finally { setUser(null); setTab("overview"); }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await api("/api/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: password, newPassword }) });
      setUser((current) => current ? { ...current, mustChangePassword: false } : current);
      setPassword(""); setNewPassword("");
    } catch (e) { setError(e instanceof Error ? e.message : "Password update failed."); }
    finally { setBusy(false); }
  }

  async function createStaff(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await api("/api/auth/users", { method: "POST", body: JSON.stringify(staffForm) });
      setStaffForm({ username: "", fullName: "", password: "", role: "cashier" });
      setError("Staff account created."); await loadData();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create staff account."); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="loading-screen">MELAT <span>Loading secure workspace…</span></div>;

  if (!user) return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand-mark">M</div><p className="eyebrow">MELAT SUPERMARKET · ADDIS ABABA</p>
        <h1>Store operations,<br />under control.</h1>
        <p className="login-copy">Sign in with your staff account to access the store workspace.</p>
        <form onSubmit={login} className="form-stack">
          <label>Username<input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {error && <p className="form-error">{error}</p>}
          <button disabled={busy}>{busy ? "Signing in…" : "Sign in securely"}</button>
        </form>
        <p className="login-foot">PRIVATE STORE SYSTEM · ETB</p>
      </section>
    </main>
  );

  if (user.mustChangePassword) return (
    <main className="login-screen"><section className="login-panel">
      <p className="eyebrow">ACCOUNT SECURITY</p><h1>Set your password.</h1>
      <p className="login-copy">Your initial password must be replaced before using the system.</p>
      <form onSubmit={changePassword} className="form-stack">
        <label>Current password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <label>New password (12+ characters)<input type="password" minLength={12} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></label>
        {error && <p className="form-error">{error}</p>}
        <button disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
      </form>
    </section></main>
  );

  const nav = [{ id: "overview", label: "Overview" }, ...(user.role !== "inventory_clerk" ? [{ id: "pos", label: "Point of sale" }] : []), { id: "inventory", label: "Inventory" }, { id: "movements", label: "Stock movements" }, ...(user.role === "owner" || user.role === "manager" || user.role === "inventory_clerk" ? [{ id: "purchasing", label: "Purchasing" }] : []), ...(user.role !== "inventory_clerk" ? [{ id: "cash", label: "Cash drawer" }] : []), ...(user.role === "owner" || user.role === "manager" ? [{ id: "finance", label: "Finance & reports" }] : []), ...(user.role === "owner" ? [{ id: "staff", label: "Staff access" }] : [])];
  const stockValue = products.reduce((sum, product) => sum + Number(product.quantity_on_hand) * Number(product.weighted_average_cost), 0);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-mark">M</div><div className="brand-name">MELAT<span>SUPERMARKET</span></div></div>
        <div className="nav-label">STORE WORKSPACE</div>
        {nav.map((item) => <button key={item.id} className={`nav-item ${tab === item.id ? "active" : ""}`} onClick={() => setTab(item.id)}>{item.label}</button>)}
        <div className="sidebar-foot"><span>ADDIS ABABA · ETB</span><div className="user-mini"><b>{user.fullName}</b><small>{roles[user.role]}</small></div><button className="logout-button" onClick={logout}>Sign out ↗</button></div>
      </aside>
      <section className="main">
        <header className="topbar"><div><span className="eyebrow">STORE MANAGEMENT SYSTEM</span><h1>{nav.find((item) => item.id === tab)?.label ?? "Overview"}</h1></div><div className="top-user"><span className="online-dot" /> SECURE SESSION <b>{user.username}</b></div></header>
        {error && <div className={`notice ${error.includes("created") ? "success" : ""}`}>{error}<button onClick={() => setError("")}>×</button></div>}
        {tab === "overview" && <>
          <section className="welcome"><div><span className="eyebrow light">MELAT · STORE OPERATIONS</span><h2>Clarity in every<br />transaction.</h2><p>Operational visibility for stock, purchasing and financial discipline.</p></div><div className="welcome-seal">M</div></section>
          <div className="section-heading"><div><span className="eyebrow">LIVE STORE DATA</span><h2>Inventory position</h2></div><button className="quiet-button" onClick={() => void loadData()}>Refresh data ↻</button></div>
          <section className="stat-grid"><article className="stat-card"><span>ACTIVE PRODUCTS</span><strong>{products.length}</strong><small>Catalog records</small></article><article className="stat-card"><span>UNITS ON HAND</span><strong>{products.reduce((sum,p) => sum + Number(p.quantity_on_hand),0).toLocaleString()}</strong><small>Current stock projection</small></article><article className="stat-card"><span>INVENTORY AT WAC</span><strong>{money(stockValue.toFixed(2))}</strong><small>Estimated carrying value</small></article></section>
          <div className="section-heading"><div><span className="eyebrow">CONTROL CENTRE</span><h2>Operational modules</h2></div></div>
          <section className="module-grid">{[{id:"inventory",code:"INV",name:"Inventory",detail:"Products, stock balances and WAC"},{id:"movements",code:"LEDGER",name:"Stock movements",detail:"Traceable inventory ledger"},{id:"staff",code:"ACCESS",name:"Staff access",detail:"Role-controlled accounts"}].filter((m) => m.id !== "staff" || user.role === "owner").map((m) => <button className="module-card" key={m.id} onClick={() => setTab(m.id)}><span className="module-code">{m.code}</span><h3>{m.name}</h3><p>{m.detail}</p><span className="module-state">OPEN MODULE →</span></button>)}</section>
        </>}
        {tab === "pos" && <PosScreen />}{tab === "purchasing" && <PurchasingScreen />}{tab === "cash" && <CashScreen />}{tab === "finance" && <FinanceScreen />}{tab === "inventory" && <><div className="section-heading"><div><span className="eyebrow">INVENTORY CONTROL</span><h2>Product balances</h2></div><button className="quiet-button" onClick={() => void loadData()}>Refresh ↻</button></div><ProductCreateForm onCreated={loadData} onError={setError} /><div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>SKU / BARCODE</th><th>ON HAND</th><th>WAC / UNIT</th><th>SELLING PRICE</th><th>EXPIRY</th></tr></thead><tbody>{products.map((p) => <tr key={p.id}><td><b>{p.name_en}</b><small>{p.name_am ?? ""}</small></td><td>{p.sku}<small>{p.barcode ?? "No barcode"}</small></td><td className="numeric">{Number(p.quantity_on_hand).toLocaleString()} {p.base_unit}</td><td className="numeric">{money(p.weighted_average_cost)}</td><td className="numeric">{money(p.selling_price)}</td><td>{p.tracks_expiry ? "Tracked" : "—"}</td></tr>)}{products.length === 0 && <tr><td colSpan={6} className="empty-cell">No products have been entered yet.</td></tr>}</tbody></table></div></>}
        {tab === "movements" && <><div className="section-heading"><div><span className="eyebrow">AUDITABLE STOCK LEDGER</span><h2>Recent movements</h2></div><button className="quiet-button" onClick={() => void loadData()}>Refresh ↻</button></div><div className="table-wrap"><table><thead><tr><th>DATE</th><th>PRODUCT</th><th>TYPE</th><th>QUANTITY</th><th>UNIT COST</th><th>RECORDED BY</th></tr></thead><tbody>{movements.map((m) => <tr key={m.id}><td>{dateTime(m.occurred_at)}</td><td><b>{m.name_en}</b><small>{m.sku}</small></td><td>{m.movement_type.replaceAll("_"," ")}</td><td className="numeric">{m.quantity_delta}</td><td className="numeric">{money(m.unit_cost)}</td><td>{m.username}</td></tr>)}{movements.length === 0 && <tr><td colSpan={6} className="empty-cell">No inventory movements recorded.</td></tr>}</tbody></table></div></>}
        {tab === "staff" && user.role === "owner" && <><div className="section-heading"><div><span className="eyebrow">ACCESS GOVERNANCE</span><h2>Staff accounts</h2></div></div><section className="staff-layout"><form className="staff-form form-stack" onSubmit={createStaff}><h3>Create staff account</h3><label>Full name<input value={staffForm.fullName} onChange={(e) => setStaffForm({...staffForm,fullName:e.target.value})} required /></label><label>Username<input value={staffForm.username} onChange={(e) => setStaffForm({...staffForm,username:e.target.value})} required /></label><label>Temporary password (12+ characters)<input type="password" minLength={12} value={staffForm.password} onChange={(e) => setStaffForm({...staffForm,password:e.target.value})} required /></label><label>Role<select value={staffForm.role} onChange={(e) => setStaffForm({...staffForm,role:e.target.value})}><option value="manager">Manager</option><option value="cashier">Cashier</option><option value="inventory_clerk">Inventory clerk</option></select></label><button disabled={busy}>Create account</button></form><div className="staff-note"><span className="eyebrow">SECURITY POLICY</span><h3>Least privilege by default.</h3><p>New staff accounts must change their temporary password at first sign-in. Only the owner can create staff accounts. Access to each operation is checked by the API.</p></div></section><div className="table-wrap staff-table"><table><thead><tr><th>STAFF MEMBER</th><th>USERNAME</th><th>ROLE</th><th>STATUS</th><th>LAST SIGN-IN</th></tr></thead><tbody>{staff.map((member) => <tr key={member.id}><td><b>{member.full_name}</b></td><td>{member.username}</td><td>{member.role.replaceAll("_"," ")}</td><td>{member.is_active ? "Active" : "Disabled"}</td><td>{member.last_login_at ? dateTime(member.last_login_at) : "Never"}</td></tr>)}{staff.length === 0 && <tr><td colSpan={5} className="empty-cell">No staff accounts found.</td></tr>}</tbody></table></div></>}
        <footer>MELAT SUPERMARKET MANAGEMENT SYSTEM <span>V1.0 FOUNDATION · LOCAL STORE WORKSPACE</span></footer>
      </section>
    </main>
  );
}
