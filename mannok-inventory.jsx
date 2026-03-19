import { useState, useEffect, useRef, useCallback } from "react";

const CATEGORIES = ["Raw Materials", "Finished Goods", "Packaging", "Equipment & Tools", "Machinery Parts"];

const LOW_STOCK_THRESHOLD = 10;

const CATEGORY_COLORS = {
  "Raw Materials":     { bg: "#1a3a2a", accent: "#2ecc71", badge: "#145a32" },
  "Finished Goods":    { bg: "#1a2a3a", accent: "#3498db", badge: "#154360" },
  "Packaging":         { bg: "#2a1a3a", accent: "#9b59b6", badge: "#4a235a" },
  "Equipment & Tools": { bg: "#3a2a1a", accent: "#e67e22", badge: "#784212" },
  "Machinery Parts":   { bg: "#3a1a1a", accent: "#e74c3c", badge: "#78281f" },
};

const CATEGORY_ICONS = {
  "Raw Materials":     "⬡",
  "Finished Goods":    "◈",
  "Packaging":         "▣",
  "Equipment & Tools": "⚙",
  "Machinery Parts":   "⛭",
};

const INITIAL_ITEMS = [
  { id: "MNK-001", name: "Portland Cement", category: "Raw Materials", quantity: 240, unit: "bags", location: "Warehouse A", minStock: 50 },
  { id: "MNK-002", name: "Aggregate Mix", category: "Raw Materials", quantity: 8, unit: "tonnes", location: "Yard 1", minStock: 20 },
  { id: "MNK-003", name: "Block 7N 440x215x215", category: "Finished Goods", quantity: 1450, unit: "units", location: "Bay 3", minStock: 200 },
  { id: "MNK-004", name: "Roof Panel Type A", category: "Finished Goods", quantity: 6, unit: "units", location: "Bay 5", minStock: 15 },
  { id: "MNK-005", name: "Pallet Wrap", category: "Packaging", quantity: 34, unit: "rolls", location: "Store Room", minStock: 10 },
  { id: "MNK-006", name: "Cardboard Corners", category: "Packaging", quantity: 4, unit: "boxes", location: "Store Room", minStock: 10 },
  { id: "MNK-007", name: "Forklift Battery", category: "Equipment & Tools", quantity: 3, unit: "units", location: "Charging Bay", minStock: 2 },
  { id: "MNK-008", name: "Angle Grinder 115mm", category: "Equipment & Tools", quantity: 7, unit: "units", location: "Tool Store", minStock: 2 },
  { id: "MNK-009", name: "Conveyor Belt Drive Shaft", category: "Machinery Parts", quantity: 2, unit: "units", location: "Maintenance", minStock: 1 },
  { id: "MNK-010", name: "Hydraulic Seal Kit", category: "Machinery Parts", quantity: 1, unit: "kits", location: "Maintenance", minStock: 3 },
];

function generateId() {
  return "MNK-" + String(Math.floor(Math.random() * 9000) + 1000);
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  const colors = { success: "#2ecc71", error: "#e74c3c", warning: "#f39c12", info: "#3498db" };
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: "#0d1117", border: `1px solid ${colors[type]}`,
      borderLeft: `4px solid ${colors[type]}`,
      color: "#e8eaf0", padding: "14px 20px", borderRadius: 8,
      fontFamily: "'DM Mono', monospace", fontSize: 13,
      boxShadow: `0 4px 24px ${colors[type]}33`,
      display: "flex", alignItems: "center", gap: 10,
      animation: "slideIn 0.3s ease",
      maxWidth: 340,
    }}>
      <span style={{ color: colors[type], fontSize: 18 }}>
        {type === "success" ? "✓" : type === "error" ? "✕" : type === "warning" ? "⚠" : "ℹ"}
      </span>
      {message}
    </div>
  );
}

export default function MannokInventory() {
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [view, setView] = useState("dashboard"); // dashboard | inventory | scan | add | alerts | history
  const [scanMode, setScanMode] = useState("add"); // add | remove
  const [scanInput, setScanInput] = useState("");
  const [scanQty, setScanQty] = useState(1);
  const [scannedItem, setScannedItem] = useState(null);
  const [filterCat, setFilterCat] = useState("All");
  const [filterSearch, setFilterSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [history, setHistory] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [newItem, setNewItem] = useState({ id: "", name: "", category: "Raw Materials", quantity: 0, unit: "units", location: "", minStock: 10 });
  const scanRef = useRef(null);
  const scanBuffer = useRef("");
  const scanTimer = useRef(null);

  const showToast = useCallback((message, type = "info") => {
    setToast({ message, type });
  }, []);

  // SocketScan S720 barcode input handler - reads keyboard stream
  useEffect(() => {
    if (view !== "scan") return;
    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        const code = scanBuffer.current.trim();
        scanBuffer.current = "";
        if (scanTimer.current) clearTimeout(scanTimer.current);
        if (code) processScan(code);
      } else if (e.key.length === 1) {
        scanBuffer.current += e.key;
        if (scanTimer.current) clearTimeout(scanTimer.current);
        scanTimer.current = setTimeout(() => {
          const code = scanBuffer.current.trim();
          scanBuffer.current = "";
          if (code.length > 3) processScan(code);
        }, 100);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, items, scanMode, scanQty]);

  const processScan = useCallback((code) => {
    const found = items.find(i => i.id === code || i.id.toLowerCase() === code.toLowerCase());
    if (!found) {
      showToast(`Barcode "${code}" not found in inventory`, "error");
      setScannedItem(null);
      return;
    }
    setScannedItem(found);
    setScanInput(code);
  }, [items, showToast]);

  const confirmScan = useCallback(() => {
    if (!scannedItem) return;
    const qty = parseInt(scanQty) || 1;
    setItems(prev => prev.map(i => {
      if (i.id !== scannedItem.id) return i;
      const newQty = scanMode === "add" ? i.quantity + qty : Math.max(0, i.quantity - qty);
      return { ...i, quantity: newQty };
    }));
    const entry = {
      id: Date.now(),
      itemId: scannedItem.id,
      itemName: scannedItem.name,
      action: scanMode === "add" ? "STOCK IN" : "STOCK OUT",
      qty,
      timestamp: new Date().toISOString(),
      user: "Operator",
    };
    setHistory(prev => [entry, ...prev].slice(0, 200));
    showToast(`${scanMode === "add" ? "Added" : "Removed"} ${qty} × ${scannedItem.name}`, "success");
    setScannedItem(null);
    setScanInput("");
    setScanQty(1);
    if (scanRef.current) scanRef.current.focus();
  }, [scannedItem, scanMode, scanQty, showToast]);

  const saveItem = () => {
    if (!newItem.name || !newItem.id) { showToast("Name and ID are required", "error"); return; }
    if (editItem) {
      setItems(prev => prev.map(i => i.id === editItem.id ? { ...newItem } : i));
      showToast("Item updated", "success");
    } else {
      if (items.find(i => i.id === newItem.id)) { showToast("ID already exists", "error"); return; }
      setItems(prev => [...prev, newItem]);
      showToast("Item added to inventory", "success");
    }
    setShowAddModal(false);
    setEditItem(null);
    setNewItem({ id: generateId(), name: "", category: "Raw Materials", quantity: 0, unit: "units", location: "", minStock: 10 });
  };

  const deleteItem = (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
    showToast("Item removed", "warning");
  };

  const openEdit = (item) => {
    setEditItem(item);
    setNewItem({ ...item });
    setShowAddModal(true);
  };

  const lowStockItems = items.filter(i => i.quantity <= i.minStock);
  const totalItems = items.reduce((a, b) => a + b.quantity, 0);

  const filteredItems = items.filter(i => {
    const matchCat = filterCat === "All" || i.category === filterCat;
    const matchSearch = i.name.toLowerCase().includes(filterSearch.toLowerCase()) ||
      i.id.toLowerCase().includes(filterSearch.toLowerCase()) ||
      i.location.toLowerCase().includes(filterSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  const catCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = items.filter(i => i.category === cat).length;
    return acc;
  }, {});

  const styles = {
    app: {
      minHeight: "100vh",
      background: "#080c10",
      color: "#c8d0e0",
      fontFamily: "'DM Mono', 'Courier New', monospace",
      position: "relative",
      overflow: "hidden",
    },
    grid: {
      position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
      backgroundImage: `linear-gradient(rgba(46,204,113,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(46,204,113,0.03) 1px, transparent 1px)`,
      backgroundSize: "40px 40px",
    },
    header: {
      background: "linear-gradient(180deg, #0d1520 0%, #080c10 100%)",
      borderBottom: "1px solid #1e2d3d",
      padding: "0 24px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      height: 64, position: "sticky", top: 0, zIndex: 100,
    },
    logo: {
      display: "flex", alignItems: "center", gap: 12,
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: 22, fontWeight: 700, letterSpacing: 2,
      color: "#e8eaf0",
    },
    logoMark: {
      width: 36, height: 36, background: "linear-gradient(135deg, #2ecc71, #27ae60)",
      borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 18, color: "#080c10", fontWeight: 900,
    },
    nav: { display: "flex", gap: 4, alignItems: "center" },
    navBtn: (active) => ({
      background: active ? "#1a2d1a" : "transparent",
      border: active ? "1px solid #2ecc7144" : "1px solid transparent",
      color: active ? "#2ecc71" : "#7a8898",
      padding: "6px 14px", borderRadius: 6, cursor: "pointer",
      fontFamily: "'DM Mono', monospace", fontSize: 11,
      letterSpacing: 1, transition: "all 0.2s",
      display: "flex", alignItems: "center", gap: 6,
    }),
    main: {
      position: "relative", zIndex: 1,
      padding: "24px",
      maxWidth: 1400, margin: "0 auto",
    },
    card: {
      background: "#0d1520", border: "1px solid #1e2d3d",
      borderRadius: 12, padding: 24,
    },
    statCard: (color) => ({
      background: "#0d1520",
      border: `1px solid ${color}33`,
      borderRadius: 12, padding: 20,
      position: "relative", overflow: "hidden",
    }),
    statGlow: (color) => ({
      position: "absolute", top: -20, right: -20,
      width: 80, height: 80, borderRadius: "50%",
      background: `${color}22`, filter: "blur(20px)",
    }),
    badge: (color) => ({
      background: `${color}22`, color: color,
      border: `1px solid ${color}44`,
      padding: "2px 8px", borderRadius: 4,
      fontSize: 10, letterSpacing: 1, fontWeight: 600,
    }),
    input: {
      background: "#080c10", border: "1px solid #1e2d3d",
      color: "#c8d0e0", padding: "10px 14px", borderRadius: 8,
      fontFamily: "'DM Mono', monospace", fontSize: 13,
      outline: "none", width: "100%", boxSizing: "border-box",
    },
    btn: (variant = "primary") => ({
      background: variant === "primary" ? "linear-gradient(135deg, #2ecc71, #27ae60)"
        : variant === "danger" ? "linear-gradient(135deg, #e74c3c, #c0392b)"
        : variant === "warn" ? "linear-gradient(135deg, #e67e22, #d35400)"
        : "#1e2d3d",
      color: variant === "ghost" ? "#7a8898" : "#080c10",
      border: "none", padding: "10px 20px", borderRadius: 8,
      cursor: "pointer", fontFamily: "'DM Mono', monospace",
      fontSize: 12, fontWeight: 700, letterSpacing: 1,
      transition: "all 0.2s",
    }),
    table: { width: "100%", borderCollapse: "collapse" },
    th: {
      textAlign: "left", padding: "10px 14px",
      fontSize: 10, letterSpacing: 2, color: "#4a5a6a",
      borderBottom: "1px solid #1e2d3d", fontWeight: 600,
    },
    td: {
      padding: "12px 14px", fontSize: 12,
      borderBottom: "1px solid #0f1820",
      verticalAlign: "middle",
    },
  };

  // DASHBOARD
  const Dashboard = () => (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: "#e8eaf0", letterSpacing: 1 }}>
          MANNOK INVENTORY SYSTEM
        </div>
        <div style={{ color: "#4a5a6a", fontSize: 11, letterSpacing: 2, marginTop: 4 }}>
          SOCKETCAN S720 · LIVE TRACKING · {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).toUpperCase()}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 28 }}>
        {[
          { label: "TOTAL SKUs", value: items.length, color: "#3498db", icon: "◈" },
          { label: "TOTAL UNITS", value: totalItems.toLocaleString(), color: "#2ecc71", icon: "⬡" },
          { label: "LOW STOCK", value: lowStockItems.length, color: lowStockItems.length > 0 ? "#e74c3c" : "#2ecc71", icon: "⚠" },
          { label: "CATEGORIES", value: CATEGORIES.length, color: "#9b59b6", icon: "▣" },
          { label: "SCANS TODAY", value: history.filter(h => h.timestamp?.startsWith(new Date().toISOString().slice(0,10))).length, color: "#e67e22", icon: "⚡" },
        ].map(s => (
          <div key={s.label} style={styles.statCard(s.color)}>
            <div style={styles.statGlow(s.color)} />
            <div style={{ fontSize: 22, color: s.color, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 700, color: "#e8eaf0", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#4a5a6a", marginTop: 6 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Category breakdown */}
        <div style={styles.card}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "#4a5a6a", marginBottom: 16 }}>STOCK BY CATEGORY</div>
          {CATEGORIES.map(cat => {
            const c = CATEGORY_COLORS[cat];
            const catItems = items.filter(i => i.category === cat);
            const catQty = catItems.reduce((a, b) => a + b.quantity, 0);
            const pct = totalItems ? Math.round((catQty / totalItems) * 100) : 0;
            return (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11 }}>
                  <span style={{ color: c.accent }}>{CATEGORY_ICONS[cat]} {cat}</span>
                  <span style={{ color: "#4a5a6a" }}>{catItems.length} SKUs · {catQty.toLocaleString()} units</span>
                </div>
                <div style={{ background: "#0a0f15", borderRadius: 4, height: 6, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${c.accent}, ${c.accent}88)`, borderRadius: 4, transition: "width 0.8s ease" }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Low stock alerts */}
        <div style={{ ...styles.card, borderColor: lowStockItems.length > 0 ? "#e74c3c44" : "#1e2d3d" }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: lowStockItems.length > 0 ? "#e74c3c" : "#4a5a6a", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
            <span>⚠ LOW STOCK ALERTS</span>
            <span style={styles.badge(lowStockItems.length > 0 ? "#e74c3c" : "#2ecc71")}>{lowStockItems.length} ITEMS</span>
          </div>
          {lowStockItems.length === 0 ? (
            <div style={{ color: "#2ecc71", fontSize: 13, textAlign: "center", padding: "30px 0" }}>✓ All stock levels healthy</div>
          ) : (
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {lowStockItems.map(item => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #0f1820" }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#c8d0e0" }}>{item.name}</div>
                    <div style={{ fontSize: 10, color: "#4a5a6a" }}>{item.id} · {item.location}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: item.quantity === 0 ? "#e74c3c" : "#f39c12", fontFamily: "'Barlow Condensed', sans-serif" }}>{item.quantity}</div>
                    <div style={{ fontSize: 9, color: "#4a5a6a" }}>MIN: {item.minStock}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div style={styles.card}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: "#4a5a6a", marginBottom: 16 }}>RECENT ACTIVITY</div>
        {history.length === 0 ? (
          <div style={{ color: "#4a5a6a", fontSize: 12, textAlign: "center", padding: "20px 0" }}>No activity yet. Start scanning to track movements.</div>
        ) : (
          history.slice(0, 6).map(h => (
            <div key={h.id} style={{ display: "flex", gap: 14, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #0f1820" }}>
              <span style={styles.badge(h.action === "STOCK IN" ? "#2ecc71" : "#e74c3c")}>{h.action}</span>
              <span style={{ fontSize: 12, flex: 1 }}>{h.itemName}</span>
              <span style={{ fontSize: 11, color: "#4a5a6a" }}>×{h.qty}</span>
              <span style={{ fontSize: 10, color: "#4a5a6a" }}>{new Date(h.timestamp).toLocaleTimeString("en-GB")}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // SCAN VIEW
  const ScanView = () => (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "#e8eaf0", letterSpacing: 1, marginBottom: 24 }}>
        BARCODE SCANNER
      </div>

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderRadius: 10, overflow: "hidden", border: "1px solid #1e2d3d" }}>
        {["add", "remove"].map(mode => (
          <button key={mode} onClick={() => setScanMode(mode)} style={{
            flex: 1, padding: "14px", border: "none", cursor: "pointer",
            background: scanMode === mode ? (mode === "add" ? "#1a3a2a" : "#3a1a1a") : "#0d1520",
            color: scanMode === mode ? (mode === "add" ? "#2ecc71" : "#e74c3c") : "#4a5a6a",
            fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: 2,
            transition: "all 0.2s",
          }}>
            {mode === "add" ? "⬆ STOCK IN" : "⬇ STOCK OUT"}
          </button>
        ))}
      </div>

      {/* Scanner input */}
      <div style={{ ...styles.card, marginBottom: 20, borderColor: scanMode === "add" ? "#2ecc7133" : "#e74c3c33" }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: "#4a5a6a", marginBottom: 12 }}>SCAN BARCODE · S720 READY</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 24, color: scanMode === "add" ? "#2ecc71" : "#e74c3c" }}>
            {scanMode === "add" ? "▲" : "▼"}
          </div>
          <input
            ref={scanRef}
            autoFocus
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") processScan(scanInput); }}
            placeholder="Scan barcode or type ID..."
            style={{ ...styles.input, fontSize: 16, letterSpacing: 2, borderColor: scanMode === "add" ? "#2ecc7144" : "#e74c3c44" }}
          />
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#4a5a6a", whiteSpace: "nowrap" }}>QUANTITY:</span>
          <input
            type="number" min="1" value={scanQty}
            onChange={e => setScanQty(e.target.value)}
            style={{ ...styles.input, width: 80 }}
          />
          <button onClick={() => processScan(scanInput)} style={{ ...styles.btn("primary"), whiteSpace: "nowrap", padding: "10px 16px" }}>FIND</button>
        </div>
      </div>

      {/* Scanned item preview */}
      {scannedItem && (
        <div style={{ ...styles.card, borderColor: scanMode === "add" ? "#2ecc7166" : "#e74c3c66", marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "#4a5a6a", marginBottom: 16 }}>ITEM FOUND</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, color: "#e8eaf0", fontWeight: 700 }}>{scannedItem.name}</div>
              <div style={{ fontSize: 11, color: "#4a5a6a", marginTop: 4 }}>{scannedItem.id} · {scannedItem.location}</div>
              <div style={{ marginTop: 8 }}><span style={styles.badge(CATEGORY_COLORS[scannedItem.category].accent)}>{scannedItem.category}</span></div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#4a5a6a" }}>CURRENT STOCK</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 42, color: scannedItem.quantity <= scannedItem.minStock ? "#e74c3c" : "#2ecc71", fontWeight: 700, lineHeight: 1 }}>{scannedItem.quantity}</div>
              <div style={{ fontSize: 11, color: "#4a5a6a" }}>{scannedItem.unit}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 2, marginBottom: 16, padding: 14, background: "#080c10", borderRadius: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#4a5a6a" }}>AFTER THIS {scanMode === "add" ? "IN" : "OUT"}</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: scanMode === "add" ? "#2ecc71" : "#e74c3c" }}>
                {scanMode === "add" ? scannedItem.quantity + parseInt(scanQty || 1) : Math.max(0, scannedItem.quantity - parseInt(scanQty || 1))} {scannedItem.unit}
              </div>
            </div>
            <div style={{ fontSize: 28, color: "#1e2d3d", alignSelf: "center" }}>→</div>
            <div style={{ flex: 1, textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#4a5a6a" }}>CHANGE</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: scanMode === "add" ? "#2ecc71" : "#e74c3c" }}>
                {scanMode === "add" ? "+" : "-"}{scanQty || 1}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={confirmScan} style={{ ...styles.btn(scanMode === "add" ? "primary" : "danger"), flex: 1, padding: "14px" }}>
              {scanMode === "add" ? "✓ CONFIRM STOCK IN" : "✓ CONFIRM STOCK OUT"}
            </button>
            <button onClick={() => { setScannedItem(null); setScanInput(""); }} style={{ ...styles.btn("ghost"), padding: "14px 20px" }}>✕</button>
          </div>
        </div>
      )}

      {/* Quick reference */}
      <div style={{ ...styles.card, opacity: 0.7 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: "#4a5a6a", marginBottom: 10 }}>SCANNER GUIDE</div>
        <div style={{ fontSize: 11, color: "#4a5a6a", lineHeight: 2 }}>
          <div>① Connect S720 via Bluetooth · Pair as keyboard</div>
          <div>② Select IN or OUT mode above</div>
          <div>③ Scan item barcode (auto-detects) or type ID</div>
          <div>④ Adjust quantity if needed, confirm</div>
        </div>
      </div>
    </div>
  );

  // INVENTORY VIEW
  const InventoryView = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "#e8eaf0", letterSpacing: 1 }}>
          INVENTORY · {filteredItems.length} ITEMS
        </div>
        <button onClick={() => { setEditItem(null); setNewItem({ id: generateId(), name: "", category: "Raw Materials", quantity: 0, unit: "units", location: "", minStock: 10 }); setShowAddModal(true); }} style={styles.btn("primary")}>
          + ADD ITEM
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          placeholder="Search by name, ID or location..."
          style={{ ...styles.input, maxWidth: 280 }}
        />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {["All", ...CATEGORIES].map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat)} style={{
              ...styles.navBtn(filterCat === cat),
              fontSize: 10, padding: "6px 12px",
            }}>{cat === "All" ? "ALL" : CATEGORY_ICONS[cat] + " " + cat.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ ...styles.card, padding: 0, overflowX: "auto" }}>
        <table style={styles.table}>
          <thead>
            <tr>
              {["ID", "ITEM NAME", "CATEGORY", "QTY", "UNIT", "LOCATION", "STATUS", ""].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, idx) => {
              const c = CATEGORY_COLORS[item.category];
              const isLow = item.quantity <= item.minStock;
              return (
                <tr key={item.id} style={{ background: idx % 2 === 0 ? "transparent" : "#0a0f1580", transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#1e2d3d40"}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "#0a0f1580"}>
                  <td style={{ ...styles.td, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#4a5a6a" }}>{item.id}</td>
                  <td style={{ ...styles.td, fontWeight: 600, color: "#e8eaf0" }}>{item.name}</td>
                  <td style={styles.td}><span style={styles.badge(c.accent)}>{CATEGORY_ICONS[item.category]} {item.category}</span></td>
                  <td style={{ ...styles.td, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: isLow ? (item.quantity === 0 ? "#e74c3c" : "#f39c12") : "#2ecc71" }}>
                    {item.quantity}
                  </td>
                  <td style={{ ...styles.td, color: "#4a5a6a", fontSize: 11 }}>{item.unit}</td>
                  <td style={{ ...styles.td, fontSize: 11, color: "#7a8898" }}>{item.location}</td>
                  <td style={styles.td}>
                    <span style={styles.badge(item.quantity === 0 ? "#e74c3c" : isLow ? "#f39c12" : "#2ecc71")}>
                      {item.quantity === 0 ? "OUT OF STOCK" : isLow ? "LOW" : "OK"}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(item)} style={{ background: "#1e2d3d", border: "none", color: "#7a8898", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>EDIT</button>
                      <button onClick={() => deleteItem(item.id)} style={{ background: "#3a1a1a", border: "none", color: "#e74c3c", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>DEL</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredItems.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#4a5a6a", fontSize: 12 }}>No items found</div>
        )}
      </div>
    </div>
  );

  // ALERTS VIEW
  const AlertsView = () => (
    <div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "#e8eaf0", letterSpacing: 1, marginBottom: 24 }}>
        STOCK ALERTS · {lowStockItems.length} ACTIVE
      </div>
      {lowStockItems.length === 0 ? (
        <div style={{ ...styles.card, textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
          <div style={{ color: "#2ecc71", fontSize: 16, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 2 }}>ALL STOCK LEVELS HEALTHY</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {lowStockItems.map(item => {
            const c = CATEGORY_COLORS[item.category];
            const pct = Math.round((item.quantity / item.minStock) * 100);
            return (
              <div key={item.id} style={{ ...styles.card, borderColor: item.quantity === 0 ? "#e74c3c66" : "#f39c1266" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={styles.badge(c.accent)}>{item.category}</span>
                  <span style={styles.badge(item.quantity === 0 ? "#e74c3c" : "#f39c12")}>
                    {item.quantity === 0 ? "⚠ OUT OF STOCK" : "⚠ LOW STOCK"}
                  </span>
                </div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, color: "#e8eaf0", fontWeight: 700, marginBottom: 4 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: "#4a5a6a", marginBottom: 16 }}>{item.id} · {item.location}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: "#4a5a6a" }}>CURRENT</span>
                  <span style={{ fontSize: 11, color: "#4a5a6a" }}>MINIMUM</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, color: item.quantity === 0 ? "#e74c3c" : "#f39c12", fontWeight: 700 }}>{item.quantity} {item.unit}</span>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, color: "#4a5a6a", fontWeight: 700 }}>{item.minStock}</span>
                </div>
                <div style={{ background: "#0a0f15", borderRadius: 4, height: 6 }}>
                  <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: item.quantity === 0 ? "#e74c3c" : "#f39c12", borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // HISTORY VIEW
  const HistoryView = () => (
    <div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: "#e8eaf0", letterSpacing: 1, marginBottom: 24 }}>
        TRANSACTION HISTORY · {history.length} RECORDS
      </div>
      <div style={{ ...styles.card, padding: 0, overflowX: "auto" }}>
        <table style={styles.table}>
          <thead>
            <tr>
              {["TIME", "ACTION", "ITEM", "ITEM ID", "QTY", "OPERATOR"].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan={6} style={{ ...styles.td, textAlign: "center", color: "#4a5a6a", padding: 40 }}>No transactions yet</td></tr>
            ) : history.map(h => (
              <tr key={h.id}>
                <td style={{ ...styles.td, fontSize: 11, color: "#4a5a6a" }}>{new Date(h.timestamp).toLocaleString("en-GB")}</td>
                <td style={styles.td}><span style={styles.badge(h.action === "STOCK IN" ? "#2ecc71" : "#e74c3c")}>{h.action}</span></td>
                <td style={{ ...styles.td, color: "#e8eaf0" }}>{h.itemName}</td>
                <td style={{ ...styles.td, fontSize: 11, color: "#4a5a6a" }}>{h.itemId}</td>
                <td style={{ ...styles.td, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: h.action === "STOCK IN" ? "#2ecc71" : "#e74c3c" }}>
                  {h.action === "STOCK IN" ? "+" : "-"}{h.qty}
                </td>
                <td style={{ ...styles.td, fontSize: 11, color: "#4a5a6a" }}>{h.user}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ADD/EDIT MODAL
  const Modal = () => (
    <div style={{ position: "fixed", inset: 0, background: "#000000bb", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ ...styles.card, maxWidth: 500, width: "100%", border: "1px solid #2ecc7144" }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: "#e8eaf0", marginBottom: 24, letterSpacing: 1 }}>
          {editItem ? "EDIT ITEM" : "ADD NEW ITEM"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          {[
            { label: "ITEM ID", key: "id", type: "text", placeholder: "MNK-XXX" },
            { label: "UNIT", key: "unit", type: "text", placeholder: "units / bags / tonnes" },
            { label: "QUANTITY", key: "quantity", type: "number" },
            { label: "MIN STOCK", key: "minStock", type: "number" },
          ].map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#4a5a6a", marginBottom: 6 }}>{f.label}</div>
              <input
                type={f.type} value={newItem[f.key]} placeholder={f.placeholder}
                onChange={e => setNewItem(p => ({ ...p, [f.key]: f.type === "number" ? parseInt(e.target.value) || 0 : e.target.value }))}
                style={styles.input}
              />
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#4a5a6a", marginBottom: 6 }}>ITEM NAME</div>
          <input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} placeholder="Full item name" style={styles.input} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#4a5a6a", marginBottom: 6 }}>LOCATION</div>
          <input value={newItem.location} onChange={e => setNewItem(p => ({ ...p, location: e.target.value }))} placeholder="Warehouse / Bay / Store" style={styles.input} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#4a5a6a", marginBottom: 6 }}>CATEGORY</div>
          <select value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}
            style={{ ...styles.input, appearance: "none" }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={saveItem} style={{ ...styles.btn("primary"), flex: 1 }}>
            {editItem ? "SAVE CHANGES" : "ADD TO INVENTORY"}
          </button>
          <button onClick={() => { setShowAddModal(false); setEditItem(null); }} style={{ ...styles.btn("ghost"), padding: "10px 20px" }}>CANCEL</button>
        </div>
      </div>
    </div>
  );

  const navItems = [
    { id: "dashboard", label: "DASHBOARD", icon: "⊞" },
    { id: "scan", label: "SCAN", icon: "⌖" },
    { id: "inventory", label: "INVENTORY", icon: "◈" },
    { id: "alerts", label: `ALERTS${lowStockItems.length > 0 ? ` (${lowStockItems.length})` : ""}`, icon: "⚠" },
    { id: "history", label: "HISTORY", icon: "⏱" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Barlow+Condensed:wght@400;600;700;900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #080c10; }
        ::-webkit-scrollbar-thumb { background: #1e2d3d; border-radius: 3px; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        input:focus, select:focus { border-color: #2ecc7166 !important; box-shadow: 0 0 0 2px #2ecc7111; }
      `}</style>
      <div style={styles.app}>
        <div style={styles.grid} />
        <header style={styles.header}>
          <div style={styles.logo}>
            <div style={styles.logoMark}>M</div>
            <div>
              <div style={{ lineHeight: 1 }}>MANNOK</div>
              <div style={{ fontSize: 9, letterSpacing: 3, color: "#4a5a6a", fontWeight: 400 }}>INVENTORY SYSTEM</div>
            </div>
          </div>
          <nav style={styles.nav}>
            {navItems.map(n => (
              <button key={n.id} onClick={() => setView(n.id)} style={styles.navBtn(view === n.id)}>
                <span>{n.icon}</span>
                <span style={{ display: "none", "@media(min-width:600px)": { display: "inline" } }}>{n.label}</span>
                <span>{n.label}</span>
              </button>
            ))}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2ecc71", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 10, color: "#2ecc71", letterSpacing: 1 }}>S720 READY</span>
          </div>
        </header>
        <main style={styles.main}>
          {view === "dashboard" && <Dashboard />}
          {view === "scan" && <ScanView />}
          {view === "inventory" && <InventoryView />}
          {view === "alerts" && <AlertsView />}
          {view === "history" && <HistoryView />}
        </main>
        {showAddModal && <Modal />}
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </div>
    </>
  );
}
