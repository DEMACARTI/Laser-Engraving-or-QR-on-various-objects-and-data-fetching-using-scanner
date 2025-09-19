import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import EngraveQRPage from './pages/EngraveQRPage'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState('generate');
  const [options, setOptions] = useState({ components: [], vendors: [], lots: [] });
  const [form, setForm] = useState({ component: "", vendor: "", lot: "", warranty_years: 5, count: 1, mfg_date: "" });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Mock options since backend might not be available
    setOptions({
      components: ["ERC", "LINER", "PAD", "SLEEPER"],
      vendors: ["V001", "V010", "V011", "V012"],
      lots: ["L2025-09", "L2025-10", "L2025-11"]
    });
  }, []);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setResults([]);
    setError("");
    
    try {
      // Simulate QR generation for demo
      const mockResults = [];
      for (let i = 1; i <= parseInt(form.count); i++) {
        const uid = `${form.component}-${form.vendor}-${form.lot}-${String(i).padStart(5, '0')}`;
        mockResults.push({
          uid: uid,
          qr_path: `../qr_batch_output/${uid}.png`
        });
      }
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      setResults(mockResults);
    } catch (err) {
      setError("Failed to generate QR codes. Please try again.");
    }
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ component: "", vendor: "", lot: "", warranty_years: 5, count: 1, mfg_date: "" });
    setResults([]);
    setError("");
  };

  if (currentPage === 'engrave') {
    return <EngraveQRPage onBack={() => setCurrentPage('generate')} />;
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="8" height="8" fill="currentColor"/>
                <rect x="13" y="3" width="8" height="8" fill="currentColor"/>
                <rect x="3" y="13" width="8" height="8" fill="currentColor"/>
                <rect x="15" y="15" width="2" height="2" fill="currentColor"/>
                <rect x="19" y="15" width="2" height="2" fill="currentColor"/>
                <rect x="15" y="19" width="2" height="2" fill="currentColor"/>
                <rect x="19" y="19" width="2" height="2" fill="currentColor"/>
              </svg>
            </div>
            <h1 className="app-title">QR Management System</h1>
          </div>
          <nav className="nav-tabs">
            <button 
              className={`nav-tab ${currentPage === 'generate' ? 'active' : ''}`}
              onClick={() => setCurrentPage('generate')}
            >
              Generate QR
            </button>
            <button 
              className={`nav-tab ${currentPage === 'engrave' ? 'active' : ''}`}
              onClick={() => setCurrentPage('engrave')}
            >
              Engrave QR
            </button>
            <Link to="/scan" className="nav-tab scan-link">
              <span className="tab-icon">📱</span>
              Scan QR
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="page-container">
          <div className="page-header">
            <h2 className="page-title">QR Code Generation</h2>
            <p className="page-subtitle">Create high-quality QR codes for your manufacturing components</p>
          </div>

          <div className="content-grid">
            {/* Form Section */}
            <div className="form-section">
              <div className="form-card">
                <h3 className="card-title">Configuration</h3>
                <form onSubmit={handleSubmit} className="qr-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Component Type</label>
                      <select 
                        name="component" 
                        value={form.component} 
                        onChange={handleChange} 
                        className="form-select"
                        required
                      >
                        <option value="">Select Component</option>
                        {options.components.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Vendor Code</label>
                      <input 
                        type="text"
                        name="vendor" 
                        value={form.vendor} 
                        onChange={handleChange} 
                        className="form-input"
                        placeholder="Enter vendor code (e.g., V001, V010)"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Lot Number</label>
                      <select 
                        name="lot" 
                        value={form.lot} 
                        onChange={handleChange} 
                        className="form-select"
                        required
                      >
                        <option value="">Select Lot</option>
                        {options.lots.map(l => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Warranty (Years)</label>
                      <input 
                        type="number" 
                        name="warranty_years" 
                        min="1" 
                        max="10" 
                        value={form.warranty_years} 
                        onChange={handleChange} 
                        className="form-input"
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Quantity</label>
                      <input 
                        type="number" 
                        name="count" 
                        min="1" 
                        max="1000" 
                        value={form.count} 
                        onChange={handleChange} 
                        className="form-input"
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Manufacturing Date</label>
                      <input 
                        type="date" 
                        name="mfg_date" 
                        value={form.mfg_date} 
                        onChange={handleChange} 
                        className="form-input"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="error-message">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                        <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2"/>
                        <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                      {error}
                    </div>
                  )}

                  <div className="form-actions">
                    <button 
                      type="button" 
                      onClick={resetForm}
                      className="btn btn-secondary"
                      disabled={loading}
                    >
                      Reset
                    </button>
                    <button 
                      type="submit" 
                      className="btn btn-primary"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <div className="spinner"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="3" width="8" height="8" stroke="currentColor" strokeWidth="2"/>
                            <rect x="13" y="3" width="8" height="8" stroke="currentColor" strokeWidth="2"/>
                            <rect x="3" y="13" width="8" height="8" stroke="currentColor" strokeWidth="2"/>
                          </svg>
                          Generate QR Codes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Results Section */}
            <div className="results-section">
              {results.length > 0 ? (
                <div className="results-card">
                  <div className="results-header">
                    <h3 className="card-title">Generated QR Codes</h3>
                    <div className="results-count">
                      <span className="count-badge">{results.length}</span>
                      <span>codes generated</span>
                    </div>
                  </div>
                  
                  <div className="results-list">
                    {results.slice(0, 6).map(r => (
                      <div key={r.uid} className="result-item">
                        <div className="qr-preview">
                          <div className="qr-placeholder">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                              <rect x="3" y="3" width="8" height="8" fill="currentColor"/>
                              <rect x="13" y="3" width="8" height="8" fill="currentColor"/>
                              <rect x="3" y="13" width="8" height="8" fill="currentColor"/>
                              <rect x="15" y="15" width="2" height="2" fill="currentColor"/>
                              <rect x="19" y="15" width="2" height="2" fill="currentColor"/>
                              <rect x="15" y="19" width="2" height="2" fill="currentColor"/>
                              <rect x="19" y="19" width="2" height="2" fill="currentColor"/>
                            </svg>
                          </div>
                        </div>
                        <div className="result-info">
                          <span className="result-uid">{r.uid}</span>
                          <span className="result-path">{r.qr_path.split('/').pop()}</span>
                        </div>
                      </div>
                    ))}
                    {results.length > 6 && (
                      <div className="more-results">
                        +{results.length - 6} more codes
                      </div>
                    )}
                  </div>
                  
                  <div className="results-actions">
                    <button 
                      onClick={() => setCurrentPage('engrave')}
                      className="btn btn-primary btn-full"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z" stroke="currentColor" strokeWidth="2" fill="none"/>
                        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none"/>
                      </svg>
                      Proceed to Engraving
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.5"/>
                      <rect x="13" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.5"/>
                      <rect x="3" y="13" width="8" height="8" stroke="currentColor" strokeWidth="1.5"/>
                      <rect x="15" y="15" width="2" height="2" fill="currentColor"/>
                      <rect x="19" y="15" width="2" height="2" fill="currentColor"/>
                      <rect x="15" y="19" width="2" height="2" fill="currentColor"/>
                      <rect x="19" y="19" width="2" height="2" fill="currentColor"/>
                    </svg>
                  </div>
                  <h3>No QR Codes Generated</h3>
                  <p>Configure your settings and generate QR codes to see them here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
