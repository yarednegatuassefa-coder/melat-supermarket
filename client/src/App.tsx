const modules = [
  { name: "Point of sale", detail: "Sales, split payments and receipts", code: "POS" },
  { name: "Inventory", detail: "Stock ledger, batches and adjustments", code: "INV" },
  { name: "Purchasing", detail: "Suppliers, receiving and invoices", code: "PUR" },
  { name: "Cash & expenses", detail: "Cash sessions and expense control", code: "CASH" },
  { name: "Accounting", detail: "Journals and reconciliations", code: "ACC" },
  { name: "Reports", detail: "Sales, margins and stock performance", code: "RPT" }
];

export default function App() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand-mark">M</div>
        <div className="brand-name">MELAT<span>SUPERMARKET</span></div>
        <div className="nav-label">WORKSPACE</div>
        <div className="nav-item active">Overview</div>
        <div className="nav-item">Operations</div>
        <div className="nav-item">Administration</div>
        <div className="sidebar-foot">ADDIS ABABA · ETB</div>
      </aside>
      <section className="main">
        <header className="topbar">
          <div><span className="eyebrow">STORE MANAGEMENT</span><h1>Overview</h1></div>
          <div className="status"><i /> SYSTEM FOUNDATION</div>
        </header>
        <section className="welcome">
          <div>
            <span className="eyebrow light">MELAT · STORE OPERATIONS</span>
            <h2>Clarity in every<br />transaction.</h2>
            <p>Your operational control centre for sales, stock and financial discipline.</p>
          </div>
          <div className="welcome-seal">M</div>
        </section>
        <div className="section-heading"><div><span className="eyebrow">V1.0 WORKSPACE</span><h2>Business modules</h2></div><span className="muted">Foundation stage</span></div>
        <section className="module-grid">
          {modules.map((item) => (
            <article className="module-card" key={item.code}>
              <span className="module-code">{item.code}</span>
              <h3>{item.name}</h3>
              <p>{item.detail}</p>
              <span className="module-state">IN DEVELOPMENT</span>
            </article>
          ))}
        </section>
        <footer> MELAT SUPERMARKET MANAGEMENT SYSTEM <span>VERSION 0.1.0 · FOUNDATION</span></footer>
      </section>
    </main>
  );
}