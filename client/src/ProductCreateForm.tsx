import { useState, type FormEvent } from "react";

interface Props { onCreated: () => Promise<void>; onError: (message: string) => void; }

export default function ProductCreateForm({ onCreated, onError }: Props) {
  const [form, setForm] = useState({ sku: "", barcode: "", nameEn: "", nameAm: "", baseUnit: "each", tracksExpiry: false, sellingPrice: "" });
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); onError("");
    try {
      const response = await fetch("/api/inventory/products", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not create product.");
      setForm({ sku: "", barcode: "", nameEn: "", nameAm: "", baseUnit: "each", tracksExpiry: false, sellingPrice: "" });
      onError("Product created."); await onCreated();
    } catch (error) { onError(error instanceof Error ? error.message : "Could not create product."); }
    finally { setBusy(false); }
  }
  return <form className="product-form" onSubmit={submit}>
    <div className="product-form-heading"><b>Add product</b><span>New catalog record · ETB</span></div>
    <div className="product-form-grid">
      <label>SKU<input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required /></label>
      <label>Barcode (optional)<input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></label>
      <label>Product name (English)<input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} required /></label>
      <label>Product name (Amharic)<input value={form.nameAm} onChange={(e) => setForm({ ...form, nameAm: e.target.value })} /></label>
      <label>Unit<input value={form.baseUnit} onChange={(e) => setForm({ ...form, baseUnit: e.target.value })} required /></label>
      <label>Selling price (ETB)<input inputMode="decimal" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} required /></label>
    </div>
    <label className="expiry-toggle"><input type="checkbox" checked={form.tracksExpiry} onChange={(e) => setForm({ ...form, tracksExpiry: e.target.checked })} /> Track expiry dates</label>
    <button disabled={busy}>{busy ? "Saving…" : "Save product"}</button>
  </form>;
}
