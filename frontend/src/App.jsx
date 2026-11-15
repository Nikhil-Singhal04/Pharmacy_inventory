import React, { useState, useEffect } from "react";

export default function App() {
  const [tab, setTab] = useState("summary");
  const [apiReady, setApiReady] = useState(null);

  // Data states
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState(null);

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
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Initial check and load
  useEffect(() => {
    fetch("/ready")
      .then((res) => res.json())
      .then((data) => setApiReady(data.status === "ready"))
      .catch(() => setApiReady(false));
    refreshAll();
  }, []);

  const refreshAll = () => {
    fetchMedicines();
    fetchBatches();
    fetchMovements();
    fetchSummary();
  };

  const fetchMedicines = () => {
    fetch("/api/medicines")
      .then((res) => res.json())
      .then((d) => setMedicines(d.data || []))
      .catch(() => {});
  };

  const fetchBatches = () => {
    fetch("/api/batches")
      .then((res) => res.json())
      .then((d) => setBatches(d.data || []))
      .catch(() => {});
  };

  const fetchMovements = () => {
    fetch("/api/stock-movements")
      .then((res) => res.json())
      .then((d) => setMovements(d.data || []))
      .catch(() => {});
  };

  const fetchSummary = () => {
    fetch("/api/reports/stock-summary")
      .then((res) => res.json())
      .then((d) => setSummary(d))
      .catch(() => {});
  };

  const clearAlerts = () => {
    setErrorMsg("");
    setSuccessMsg("");
  };

  // Submit Medicine
  const handleCreateMedicine = async (e) => {
    e.preventDefault();
    clearAlerts();
    try {
      const res = await fetch("/api/medicines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(medForm),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error?.message || "Failed to create medicine");
      setSuccessMsg(
        `Medicine '${data.data.name}' created with SKU ${data.data.sku}`,
      );
      setMedForm({ name: "", sku: "", description: "" });
      fetchMedicines();
      fetchSummary();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // Submit Batch
  const handleCreateBatch = async (e) => {
    e.preventDefault();
    clearAlerts();
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchForm),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error?.message || "Failed to create batch");
      setSuccessMsg(`Batch '${data.data.batch_no}' created successfully`);
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
      setErrorMsg(err.message);
    }
  };

  // Submit Movement (SALE, PURCHASE, etc.)
  const handleRecordMovement = async (e) => {
    e.preventDefault();
    clearAlerts();
    try {
      const res = await fetch("/api/stock-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(moveForm),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error?.message || "Transaction rejected");
      setSuccessMsg(
        `Recorded ${data.data.movement.type} of ${data.data.movement.quantity} units on batch ${data.data.batch.batch_no}. New Stock: ${data.data.batch.new_quantity}`,
      );
      setMoveForm({ ...moveForm, quantity: 1, reason: "", reference: "" });
      refreshAll();
    } catch (err) {
      // Prominently display API domain errors (expired batch, insufficient quantity)
      setErrorMsg(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Pharmacy Inventory Dashboard</h1>
          <p style={{ margin: "4px 0 0", color: "#4a5568", fontSize: 14 }}>
            PERN Stack · Medicine, Batch & Stock-Movement Tracking
          </p>
        </div>
        <div>
          <span
            style={{
              padding: "6px 12px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              background: apiReady ? "#c6f6d5" : "#fed7d7",
              color: apiReady ? "#22543d" : "#9b2c2c",
            }}
          >
            API: {apiReady ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav style={{ marginBottom: 20 }}>
        <button
          className={tab === "summary" ? "active" : ""}
          onClick={() => {
            clearAlerts();
            setTab("summary");
          }}
        >
          Stock Summary
        </button>
        <button
          className={tab === "medicines" ? "active" : ""}
          onClick={() => {
            clearAlerts();
            setTab("medicines");
          }}
        >
          Medicines ({medicines.length})
        </button>
        <button
          className={tab === "batches" ? "active" : ""}
          onClick={() => {
            clearAlerts();
            setTab("batches");
          }}
        >
          Batches ({batches.length})
        </button>
        <button
          className={tab === "movements" ? "active" : ""}
          onClick={() => {
            clearAlerts();
            setTab("movements");
          }}
        >
          Record Movement / History
        </button>
      </nav>

      {/* Global Alerts */}
      {errorMsg && (
        <div className="alert-error" role="alert">
          <strong>Error: </strong> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="alert-success" role="status">
          <strong>Success: </strong> {successMsg}
        </div>
      )}

      {/* TAB 1: SUMMARY */}
      {tab === "summary" && summary && (
        <div>
          <div className="grid">
            <div className="stat-card">
              <div style={{ color: "#718096", fontSize: 13 }}>
                Total Active Stock
              </div>
              <div className="stat-val">
                {summary.summary?.activeStock || 0}
              </div>
            </div>
            <div className="stat-card danger">
              <div style={{ color: "#718096", fontSize: 13 }}>
                Expired Stock (Quarantine)
              </div>
              <div className="stat-val" style={{ color: "#c53030" }}>
                {summary.summary?.expiredStock || 0}
              </div>
            </div>
            <div className="stat-card warning">
              <div style={{ color: "#718096", fontSize: 13 }}>
                Low Stock Batches (≤ 10)
              </div>
              <div className="stat-val" style={{ color: "#dd6b20" }}>
                {summary.summary?.lowStockBatches || 0}
              </div>
            </div>
            <div className="stat-card">
              <div style={{ color: "#718096", fontSize: 13 }}>
                Total Registered Medicines
              </div>
              <div className="stat-val">
                {summary.summary?.totalMedicines || 0}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Stock Overview by Medicine</h3>
            <table>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>SKU</th>
                  <th>Total Stock</th>
                  <th>Active Stock</th>
                  <th>Expired Stock</th>
                  <th>Batches (Active / Total)</th>
                </tr>
              </thead>
              <tbody>
                {summary.medicines?.map((m) => (
                  <tr key={m.medicine_id}>
                    <td>
                      <strong>{m.medicine_name}</strong>
                    </td>
                    <td>
                      <code>{m.medicine_sku}</code>
                    </td>
                    <td>{m.total_quantity}</td>
                    <td>{m.active_quantity}</td>
                    <td
                      style={{
                        color: m.expired_quantity > 0 ? "#c53030" : "inherit",
                      }}
                    >
                      {m.expired_quantity}
                    </td>
                    <td>
                      {m.active_batches} / {m.total_batches}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MEDICINES */}
      {tab === "medicines" && (
        <div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Register New Medicine</h3>
            <form onSubmit={handleCreateMedicine}>
              <div className="form-group">
                <label>Medicine Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ciprofloxacin 500mg"
                  value={medForm.name}
                  onChange={(e) =>
                    setMedForm({ ...medForm, name: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label>SKU * (Must be Unique)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MED-CIPRO-500"
                  value={medForm.sku}
                  onChange={(e) =>
                    setMedForm({ ...medForm, sku: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  placeholder="Clinical notes / dosage form"
                  value={medForm.description}
                  onChange={(e) =>
                    setMedForm({ ...medForm, description: e.target.value })
                  }
                />
              </div>
              <button type="submit" className="submit-btn">
                Add Medicine
              </button>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Medicines List</h3>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Description</th>
                  <th>Total Quantity</th>
                </tr>
              </thead>
              <tbody>
                {medicines.map((m) => (
                  <tr key={m.id}>
                    <td>{m.id}</td>
                    <td>
                      <strong>{m.name}</strong>
                    </td>
                    <td>
                      <code>{m.sku}</code>
                    </td>
                    <td>{m.description || "—"}</td>
                    <td>{m.total_quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BATCHES */}
      {tab === "batches" && (
        <div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Create New Batch</h3>
            <form onSubmit={handleCreateBatch}>
              <div className="form-group">
                <label>Medicine *</label>
                <select
                  required
                  value={batchForm.medicine_id}
                  onChange={(e) =>
                    setBatchForm({ ...batchForm, medicine_id: e.target.value })
                  }
                >
                  <option value="">-- Select Medicine --</option>
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.sku})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Batch Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BATCH-2027A"
                  value={batchForm.batch_no}
                  onChange={(e) =>
                    setBatchForm({ ...batchForm, batch_no: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label>Expiry Date *</label>
                <input
                  type="date"
                  required
                  value={batchForm.expiry_date}
                  onChange={(e) =>
                    setBatchForm({ ...batchForm, expiry_date: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label>Initial Quantity On Hand</label>
                <input
                  type="number"
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
              <button type="submit" className="submit-btn">
                Create Batch
              </button>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>
              Batches Inventory (Expiry Status Highlighted)
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Batch No</th>
                  <th>Medicine</th>
                  <th>Expiry Date</th>
                  <th>Quantity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr
                    key={b.id}
                    style={{ background: b.is_expired ? "#fff5f5" : "inherit" }}
                  >
                    <td>
                      <code>{b.batch_no}</code>
                    </td>
                    <td>{b.medicine_name}</td>
                    <td>{b.expiry_date}</td>
                    <td>
                      <strong>{b.quantity_on_hand}</strong>
                    </td>
                    <td>
                      {b.is_expired ? (
                        <span className="badge-expired">EXPIRED</span>
                      ) : b.is_low_stock ? (
                        <span className="badge-low">LOW STOCK</span>
                      ) : (
                        <span className="badge-active">ACTIVE</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: RECORD MOVEMENTS & HISTORY */}
      {tab === "movements" && (
        <div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>
              Record Stock Movement (Purchase / Sale / Return / Adjustment)
            </h3>
            <form onSubmit={handleRecordMovement}>
              <div className="form-group">
                <label>Select Batch *</label>
                <select
                  required
                  value={moveForm.batch_id}
                  onChange={(e) =>
                    setMoveForm({ ...moveForm, batch_id: e.target.value })
                  }
                >
                  <option value="">-- Choose Batch --</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batch_no} — {b.medicine_name} (Stock:{" "}
                      {b.quantity_on_hand}, Exp: {b.expiry_date}
                      {b.is_expired ? " [EXPIRED]" : ""})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Movement Type *</label>
                <select
                  value={moveForm.type}
                  onChange={(e) =>
                    setMoveForm({ ...moveForm, type: e.target.value })
                  }
                >
                  <option value="SALE">
                    SALE (Deduct Stock - Validates Expiry & Availability)
                  </option>
                  <option value="PURCHASE">PURCHASE (Add Stock)</option>
                  <option value="RETURN">RETURN (Return to Stock)</option>
                  <option value="ADJUSTMENT">
                    ADJUSTMENT (Requires Reason)
                  </option>
                </select>
              </div>
              <div className="form-group">
                <label>Quantity *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={moveForm.quantity}
                  onChange={(e) =>
                    setMoveForm({ ...moveForm, quantity: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label>Reference / Prescription #</label>
                <input
                  type="text"
                  placeholder="e.g. RX-2026-0042 or PO-109"
                  value={moveForm.reference}
                  onChange={(e) =>
                    setMoveForm({ ...moveForm, reference: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label>
                  Reason {moveForm.type === "ADJUSTMENT" ? "*" : "(Optional)"}
                </label>
                <input
                  type="text"
                  required={moveForm.type === "ADJUSTMENT"}
                  placeholder="Clinical indication / Audit explanation"
                  value={moveForm.reason}
                  onChange={(e) =>
                    setMoveForm({ ...moveForm, reason: e.target.value })
                  }
                />
              </div>
              <button type="submit" className="submit-btn">
                Execute Stock Movement
              </button>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Stock Movement Audit Trail</h3>
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Batch</th>
                  <th>Medicine</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Reference</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontSize: 13, color: "#718096" }}>
                      {new Date(m.created_at).toLocaleString()}
                    </td>
                    <td>
                      <code>{m.batch_no}</code>
                    </td>
                    <td>{m.medicine_name}</td>
                    <td>
                      <span
                        style={{
                          fontWeight: "bold",
                          color:
                            m.type === "SALE"
                              ? "#c53030"
                              : m.type === "PURCHASE"
                                ? "#2f855a"
                                : "#2b6cb0",
                        }}
                      >
                        {m.type}
                      </span>
                    </td>
                    <td>
                      <strong>{m.quantity}</strong>
                    </td>
                    <td>{m.reference || "—"}</td>
                    <td>{m.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
