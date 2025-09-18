import React, { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [options, setOptions] = useState({ components: [], vendors: [], lots: [] });
  const [form, setForm] = useState({ component: "", vendor: "", lot: "", warranty_years: 5, count: 1, mfg_date: "" });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get("http://localhost:5001/api/options").then(res => setOptions(res.data));
  }, []);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setResults([]);
    try {
      const res = await axios.post("http://localhost:5001/api/generate", form);
      setResults(res.data.results);
    } catch (err) {
      alert("Error generating QR");
    }
    setLoading(false);
  };

  return (
    <div className="container">
      <h1>QR Code Generator</h1>
      <form onSubmit={handleSubmit} className="qr-form">
        <label>Component:
          <select name="component" value={form.component} onChange={handleChange} required>
            <option value="">Select</option>
            {options.components.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>Vendor:
          <select name="vendor" value={form.vendor} onChange={handleChange} required>
            <option value="">Select</option>
            {options.vendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label>Lot:
          <select name="lot" value={form.lot} onChange={handleChange} required>
            <option value="">Select</option>
            {options.lots.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label>Warranty Years:
          <input type="number" name="warranty_years" min="1" max="10" value={form.warranty_years} onChange={handleChange} required />
        </label>
        <label>Count:
          <input type="number" name="count" min="1" max="100" value={form.count} onChange={handleChange} required />
        </label>
        <label>Mfg Date:
          <input type="date" name="mfg_date" value={form.mfg_date} onChange={handleChange} />
        </label>
        <button type="submit" disabled={loading}>{loading ? "Generating..." : "Generate QR"}</button>
      </form>
      {results.length > 0 && (
        <div className="results">
          <h2>Generated QRs</h2>
          <ul>
            {results.map(r => (
              <li key={r.uid}>
                <b>{r.uid}</b><br />
                <img src={`http://localhost:5001/api/qr/${r.uid}`} alt={r.uid} width={120} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
