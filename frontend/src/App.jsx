import React, { useState, useEffect } from "react";

export default function App() {
  const [tab, setTab] = useState("summary");
  const [apiReady, setApiReady] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data states
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState(null);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState("");

  // Form states
  const [medForm, setMedForm] = useState({
    name: "",
    sku: "",
    description: "",
  });
  const [batchForm, setBatchForm] = useState({
    medicine_id: "",
    batch_no: "",
    expiry_date: "",
    initial_quantity: 0,
  });
  const [moveForm, setMoveForm] = useState({
    batch_id: "",
    type: "SALE",
    quantity: 1,
    reason: "",
    reference: "",
  });

  // Notifications
  const [alert, setAlert] = useState(null); // { type: 'error' | 'success', title: '', desc: '' }

  // Initial check and load
  useEffect(() => {
    checkHealth();
    refreshAll();
  }, []);

  const checkHealth = () => {
    fetch("/ready")
      .then((res) => res.json())
      .then((data) => setApiReady(data.status === "ready"))
      .catch(() => setApiReady(false));
  };

  const refreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchMedicines(),
      fetchBatches(),
      fetchMovements(),
      fetchSummary(),
    ]);
    setTimeout(() => setIsRefreshing(false), 300);
  };

  const fetchMedicines = async () => {
    try {
      const res = await fetch("/api/medicines");
      const d = await res.json();
      setMedicines(d.data || []);
    } catch {
      // ignore
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await fetch("/api/batches");
      const d = await res.json();
      setBatches(d.data || []);
    } catch {
      // ignore
    }
  };

  const fetchMovements = async () => {
    try {
      const res = await fetch("/api/stock-movements");
      const d = await res.json();
      setMovements(d.data || []);
    } catch {
      // ignore
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch("/api/reports/stock-summary");
      const d = await res.json();
      setSummary(d);
    } catch {
      // ignore
    }
  };

  const clearAlert = () => {
    setAlert(null);
  };

  // Submit Medicine
  const handleCreateMedicine = async (e) => {
    e.preventDefault();
    clearAlert();
    try {
      const res = await fetch("/api/medicines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(medForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create medicine");
      }
      setAlert({
        type: "success",
        title: "Medicine Registered Successfully",
        desc: `Created medicine '${data.data.name}' with SKU ${data.data.sku}`,
      });
      setMedForm({ name: "", sku: "", description: "" });
      fetchMedicines();
      fetchSummary();
    } catch (err) {
      setAlert({
        type: "error",
        title: "Registration Failed",
        desc: err.message,
      });
    }
  };

  // Submit Batch
  const handleCreateBatch = async (e) => {
    e.preventDefault();
    clearAlert();
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create batch");
      }
      setAlert({
        type: "success",
        title: "Batch Created Successfully",
        desc: `Batch '${data.data.batch_no}' was provisioned with ${data.data.quantity_on_hand} initial units.`,
      });
      setBatchForm({
        medicine_id: "",
        batch_no: "",
        expiry_date: "",
        initial_quantity: 0,
      });
      fetchBatches();
      fetchMedicines();
      fetchSummary();
    } catch (err) {
      setAlert({
        type: "error",
        title: "Batch Creation Failed",
        desc: err.message,
      });
    }
  };

  // Submit Movement (SALE, PURCHASE, etc.)
  const handleRecordMovement = async (e) => {
    e.preventDefault();
    clearAlert();
    try {
      const res = await fetch("/api/stock-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(moveForm),
      });
      const data = await res.json();
      if (!res.ok) {
        const errCode = data.error?.code;
        const errMsg = data.error?.message || "Transaction rejected";
        if (errCode === "BATCH_EXPIRED") {
          throw new Error(
            `CLINICAL SAFETY RULE VIOLATION (BATCH_EXPIRED): ${errMsg}. Stock was left strictly unchanged.`,
          );
        } else if (errCode === "INSUFFICIENT_STOCK") {
          throw new Error(
            `INVENTORY LIMIT REACHED (INSUFFICIENT_STOCK): ${errMsg}. Stock was left strictly unchanged.`,
          );
        }
        throw new Error(errMsg);
      }
      setAlert({
        type: "success",
        title: "Transaction Committed Successfully",
        desc: `Recorded ${data.data.movement.type} of ${data.data.movement.quantity} unit(s) on batch ${data.data.batch.batch_no}. Updated Stock on Hand: ${data.data.batch.new_quantity}`,
      });
      setMoveForm({ ...moveForm, quantity: 1, reason: "", reference: "" });
      refreshAll();
    } catch (err) {
      setAlert({
        type: "error",
        title: "Transaction Prohibited by Business Logic",
        desc: err.message,
      });
    }
  };

  // Quick action: Select batch for dispensing and open Movements tab
  const handleQuickDispense = (batchId) => {
    setMoveForm({
      ...moveForm,
      batch_id: batchId,
      type: "SALE",
      quantity: 1,
    });
    setTab("movements");
    clearAlert();
  };

  // Filtered lists
  const filteredMedicines = medicines.filter(
    (m) =>
      m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.sku?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredBatches = batches.filter(
    (b) =>
      b.batch_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.medicine_name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="app-container">
      {/* Top Navigation & Brand Header */}
      <header className="navbar">
        <div className="brand-group">
          <div className="brand-icon-wrapper">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <h1 className="brand-title">
              PharmaFlow
              <span className="brand-pill">Enterprise Cloud</span>
            </h1>
            <p className="brand-desc">
              Clinical Batch Tracking, Concurrency Control & Real-time Inventory
            </p>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="btn-refresh"
            onClick={refreshAll}
            title="Refresh inventory state"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isRefreshing ? "rotate(180deg)" : "none",
                transition: "transform 0.3s ease",
              }}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Refresh
          </button>

          <div
            className={`status-pill ${apiReady ? "online" : "offline"}`}
            title="Database and API Service Health"
          >
            <span className="pulse-dot" />
            {apiReady ? "API & DB: HEALTHY" : "API: OFFLINE"}
          </div>
        </div>
      </header>

      {/* Segmented Navigation Bar */}
      <nav className="nav-tabs">
        <button
          className={`nav-tab-btn ${tab === "summary" ? "active" : ""}`}
          onClick={() => {
            clearAlert();
            setTab("summary");
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 3v18h18" />
            <path d="M18 17V9" />
            <path d="M13 17V5" />
            <path d="M8 17v-3" />
          </svg>
          Stock Summary
        </button>

        <button
          className={`nav-tab-btn ${tab === "medicines" ? "active" : ""}`}
          onClick={() => {
            clearAlert();
            setTab("medicines");
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
            <path d="m8.5 8.5 7 7" />
          </svg>
          Medicines Catalog
          <span className="tab-badge">{medicines.length}</span>
        </button>

        <button
          className={`nav-tab-btn ${tab === "batches" ? "active" : ""}`}
          onClick={() => {
            clearAlert();
            setTab("batches");
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
          </svg>
          Batches & Quarantine
          <span className="tab-badge">{batches.length}</span>
        </button>

        <button
          className={`nav-tab-btn ${tab === "movements" ? "active" : ""}`}
          onClick={() => {
            clearAlert();
            setTab("movements");
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M17 3v10M3 13h10M3 7l4-4 4 4M21 17l-4 4-4-4M21 11H11M7 21v-10" />
          </svg>
          Record Movement & Audit
        </button>
      </nav>

      {/* Global Alerts & Notifications */}
      {alert && (
        <div className={`alert-banner ${alert.type}`} role="alert">
          <div style={{ marginTop: 2 }}>
            {alert.type === "error" ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
          </div>
          <div className="alert-content">
            <h4 className="alert-title">{alert.title}</h4>
            <p className="alert-desc">{alert.desc}</p>
          </div>
          <button
            className="alert-close"
            onClick={clearAlert}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}

      {/* TAB 1: STOCK SUMMARY */}
      {tab === "summary" && summary && (
        <div>
          {/* KPI Stat Cards */}
          <div className="metrics-grid">
            <div className="metric-card blue">
              <div className="metric-header">
                <span className="metric-label">Active Units on Hand</span>
                <div className="metric-icon-box">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                  </svg>
                </div>
              </div>
              <div className="metric-val">
                {summary.summary?.activeStock || 0}
              </div>
              <div className="metric-sub">
                Verified safe & ready for patient dispensing
              </div>
            </div>

            <div className="metric-card danger">
              <div className="metric-header">
                <span className="metric-label">Quarantine (Expired)</span>
                <div className="metric-icon-box">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
              </div>
              <div className="metric-val" style={{ color: "var(--danger)" }}>
                {summary.summary?.expiredStock || 0}
              </div>
              <div className="metric-sub">
                Protected by strict rejection constraint (A1)
              </div>
            </div>

            <div className="metric-card warning">
              <div className="metric-header">
                <span className="metric-label">Low Stock Batches</span>
                <div className="metric-icon-box">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
              </div>
              <div className="metric-val" style={{ color: "var(--warning)" }}>
                {summary.summary?.lowStockBatches || 0}
              </div>
              <div className="metric-sub">
                Batches with ≤ 10 units remaining
              </div>
            </div>

            <div className="metric-card indigo">
              <div className="metric-header">
                <span className="metric-label">Registered SKUs</span>
                <div className="metric-icon-box">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect width="20" height="14" x="2" y="5" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </div>
              </div>
              <div className="metric-val">
                {summary.summary?.totalMedicines || 0}
              </div>
              <div className="metric-sub">Active pharmaceutical formulary</div>
            </div>
          </div>

          {/* Stock Overview Table */}
          <div className="content-card">
            <div className="card-header-bar">
              <div>
                <h3 className="card-title">Stock Overview by Formulary</h3>
                <p className="card-subtitle">
                  Aggregated stock levels, active vs quarantined distribution
                </p>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicine Formulation</th>
                    <th>Product SKU</th>
                    <th>Total Inventory</th>
                    <th>Active Units</th>
                    <th>Quarantine (Expired)</th>
                    <th>Batch Ratio (Active / Total)</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.medicines?.map((m) => (
                    <tr key={m.medicine_id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{m.medicine_name}</div>
                      </td>
                      <td>
                        <span className="chip-sku">{m.medicine_sku}</span>
                      </td>
                      <td>
                        <strong>{m.total_quantity}</strong>
                      </td>
                      <td>
                        <span
                          style={{ color: "var(--success)", fontWeight: 700 }}
                        >
                          {m.active_quantity}
                        </span>
                      </td>
                      <td>
                        {m.expired_quantity > 0 ? (
                          <span className="badge expired">
                            {m.expired_quantity} EXPIRED
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>0</span>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            color: "var(--primary-light)",
                          }}
                        >
                          {m.active_batches} / {m.total_batches}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MEDICINES */}
      {tab === "medicines" && (
        <div>
          {/* Register New Medicine Card */}
          <div className="content-card">
            <div className="card-header-bar">
              <div>
                <h3 className="card-title">Register New Pharmaceutical Item</h3>
                <p className="card-subtitle">
                  Add a new formulation to the clinical catalog with unique SKU
                </p>
              </div>
            </div>
            <div className="card-body">
              <form onSubmit={handleCreateMedicine}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Medicine Full Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="e.g. Ciprofloxacin 500mg"
                      value={medForm.name}
                      onChange={(e) =>
                        setMedForm({ ...medForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Unique Product SKU * (Must be Unique)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="e.g. MED-CIPRO-500"
                      value={medForm.sku}
                      onChange={(e) =>
                        setMedForm({ ...medForm, sku: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Clinical Description / Dosage Notes
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Broad-spectrum fluoroquinolone antibiotic"
                      value={medForm.description}
                      onChange={(e) =>
                        setMedForm({ ...medForm, description: e.target.value })
                      }
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Register Medicine
                </button>
              </form>
            </div>
          </div>

          {/* Medicines Catalog Grid */}
          <div className="content-card">
            <div className="card-header-bar">
              <div>
                <h3 className="card-title">Formulary Catalog</h3>
                <p className="card-subtitle">
                  Total {medicines.length} registered pharmaceutical items
                </p>
              </div>
              <div className="search-box">
                <svg
                  className="search-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Filter by name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item ID</th>
                    <th>Formulation Name</th>
                    <th>Product SKU</th>
                    <th>Clinical Notes / Description</th>
                    <th>Total Units in Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedicines.map((m) => (
                    <tr key={m.id}>
                      <td
                        style={{
                          color: "var(--text-muted)",
                          fontFamily: "monospace",
                        }}
                      >
                        #{m.id}
                      </td>
                      <td>
                        <strong style={{ fontSize: 14 }}>{m.name}</strong>
                      </td>
                      <td>
                        <span className="chip-sku">{m.sku}</span>
                      </td>
                      <td style={{ color: "#475569" }}>
                        {m.description || "—"}
                      </td>
                      <td>
                        <strong style={{ fontSize: 14 }}>
                          {m.total_quantity}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BATCHES */}
      {tab === "batches" && (
        <div>
          {/* Create Batch Card */}
          <div className="content-card">
            <div className="card-header-bar">
              <div>
                <h3 className="card-title">Receive & Provision New Batch</h3>
                <p className="card-subtitle">
                  Assign lot number, expiry date, and initial received stock
                </p>
              </div>
            </div>
            <div className="card-body">
              <form onSubmit={handleCreateBatch}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">
                      Associated Formulation *
                    </label>
                    <select
                      className="form-control"
                      required
                      value={batchForm.medicine_id}
                      onChange={(e) =>
                        setBatchForm({
                          ...batchForm,
                          medicine_id: e.target.value,
                        })
                      }
                    >
                      <option value="">
                        -- Select Medicine Formulation --
                      </option>
                      {medicines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Batch / Lot Identifier *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="e.g. AMOX-2027C"
                      value={batchForm.batch_no}
                      onChange={(e) =>
                        setBatchForm({ ...batchForm, batch_no: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Official Expiry Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      required
                      value={batchForm.expiry_date}
                      onChange={(e) =>
                        setBatchForm({
                          ...batchForm,
                          expiry_date: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Initial Quantity Received
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      value={batchForm.initial_quantity}
                      onChange={(e) =>
                        setBatchForm({
                          ...batchForm,
                          initial_quantity: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                    <line x1="12" y1="12" x2="12" y2="22" />
                  </svg>
                  Provision Batch
                </button>
              </form>
            </div>
          </div>

          {/* Batches Inventory Table */}
          <div className="content-card">
            <div className="card-header-bar">
              <div>
                <h3 className="card-title">Batches & Expiry Compliance</h3>
                <p className="card-subtitle">
                  Real-time stock on hand with automated expiry status tagging
                </p>
              </div>
              <div className="search-box">
                <svg
                  className="search-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Filter by batch or formulation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Batch Lot #</th>
                    <th>Medicine Formulation</th>
                    <th>Expiry Date</th>
                    <th>Available Stock</th>
                    <th>Compliance Status</th>
                    <th>Quick Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map((b) => (
                    <tr
                      key={b.id}
                      style={{
                        backgroundColor: b.is_expired
                          ? "rgba(254, 242, 242, 0.6)"
                          : "transparent",
                      }}
                    >
                      <td>
                        <span className="chip-sku">{b.batch_no}</span>
                      </td>
                      <td>
                        <strong>{b.medicine_name}</strong>
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: 13 }}>
                        {b.expiry_date}
                      </td>
                      <td>
                        <strong style={{ fontSize: 15 }}>
                          {b.quantity_on_hand}
                        </strong>{" "}
                        units
                      </td>
                      <td>
                        {b.is_expired ? (
                          <span className="badge expired">
                            ● Quarantined / Expired
                          </span>
                        ) : b.is_low_stock ? (
                          <span className="badge low">
                            ⚠ Low Stock ({b.quantity_on_hand})
                          </span>
                        ) : (
                          <span className="badge active">● Active Stock</span>
                        )}
                      </td>
                      <td>
                        {!b.is_expired && b.quantity_on_hand > 0 ? (
                          <button
                            className="btn-sm-action"
                            onClick={() => handleQuickDispense(b.id)}
                            title="Dispense from this batch"
                          >
                            Dispense Sale →
                          </button>
                        ) : (
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--danger)",
                              fontWeight: 600,
                            }}
                          >
                            Sale Prohibited
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RECORD MOVEMENTS & HISTORY */}
      {tab === "movements" && (
        <div>
          {/* Record Movement Form Card */}
          <div className="content-card">
            <div className="card-header-bar">
              <div>
                <h3 className="card-title">
                  Execute Controlled Stock Movement
                </h3>
                <p className="card-subtitle">
                  Atomic transactional movement with serialized row locking
                  (SELECT ... FOR UPDATE)
                </p>
              </div>
            </div>
            <div className="card-body">
              <form onSubmit={handleRecordMovement}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">
                      Target Inventory Batch *
                    </label>
                    <select
                      className="form-control"
                      required
                      value={moveForm.batch_id}
                      onChange={(e) =>
                        setMoveForm({ ...moveForm, batch_id: e.target.value })
                      }
                    >
                      <option value="">-- Choose Target Batch --</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.batch_no} — {b.medicine_name} (Stock:{" "}
                          {b.quantity_on_hand}, Exp: {b.expiry_date}
                          {b.is_expired ? " [EXPIRED / QUARANTINE]" : ""})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Movement Type *</label>
                    <select
                      className="form-control"
                      value={moveForm.type}
                      onChange={(e) =>
                        setMoveForm({ ...moveForm, type: e.target.value })
                      }
                    >
                      <option value="SALE">
                        SALE (Deduct Stock — Strictly Validates Expiry &
                        Quantity)
                      </option>
                      <option value="PURCHASE">
                        PURCHASE (Receive & Increment Stock)
                      </option>
                      <option value="RETURN">
                        RETURN (Customer Return to Active Stock)
                      </option>
                      <option value="ADJUSTMENT">
                        ADJUSTMENT (Audited Inventory Reconciliation)
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Quantity (Units) *</label>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      required
                      value={moveForm.quantity}
                      onChange={(e) =>
                        setMoveForm({ ...moveForm, quantity: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Prescription / PO Reference
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. RX-2026-9042 or PO-SEED-01"
                      value={moveForm.reference}
                      onChange={(e) =>
                        setMoveForm({ ...moveForm, reference: e.target.value })
                      }
                    />
                  </div>

                  <div
                    className="form-group"
                    style={{ gridColumn: "span 2 / auto" }}
                  >
                    <label className="form-label">
                      Reason / Clinical Justification{" "}
                      {moveForm.type === "ADJUSTMENT"
                        ? "(Required for Adjustments)"
                        : "(Optional)"}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      required={moveForm.type === "ADJUSTMENT"}
                      placeholder="Dispensing confirmation, audit adjustment reason, or supplier return note"
                      value={moveForm.reason}
                      onChange={(e) =>
                        setMoveForm({ ...moveForm, reason: e.target.value })
                      }
                    />
                  </div>
                </div>

                <button type="submit" className="btn-primary">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  Commit Stock Transaction
                </button>
              </form>
            </div>
          </div>

          {/* Immutable Audit Trail */}
          <div className="content-card">
            <div className="card-header-bar">
              <div>
                <h3 className="card-title">Immutable Audit Trail</h3>
                <p className="card-subtitle">
                  Chronological transaction log of all inventory modifications
                </p>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Batch Lot</th>
                    <th>Medicine Formulation</th>
                    <th>Action</th>
                    <th>Quantity</th>
                    <th>Prescription / Ref</th>
                    <th>Clinical Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          fontFamily: "monospace",
                        }}
                      >
                        {new Date(m.created_at).toLocaleString()}
                      </td>
                      <td>
                        <span className="chip-sku">{m.batch_no}</span>
                      </td>
                      <td>
                        <strong>{m.medicine_name}</strong>
                      </td>
                      <td>
                        <span
                          className={`badge ${m.type === "SALE"
                              ? "danger"
                              : m.type === "PURCHASE"
                                ? "active"
                                : "low"
                            }`}
                        >
                          {m.type}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontSize: 14 }}>{m.quantity}</strong>
                      </td>
                      <td>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: 12,
                            color: "#334155",
                          }}
                        >
                          {m.reference || "—"}
                        </span>
                      </td>
                      <td style={{ color: "#475569" }}>{m.reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
