
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import '../App.css';

export default function EngraveQRPage({ onBack }) {
  const [generatedQRs, setGeneratedQRs] = useState([]);
  const [numQRsToEngrave, setNumQRsToEngrave] = useState(10);
  const [timeDelay, setTimeDelay] = useState(2.0);
  const [engravingStatus, setEngravingStatus] = useState('idle'); // 'idle', 'running', 'paused', 'stopped'
  const [qrStatuses, setQrStatuses] = useState({});
  const [currentEngravingIndex, setCurrentEngravingIndex] = useState(0);
  const [error, setError] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef(null);
  const timerRef = useRef(null);

  // Fetch generated QR codes on mount
  useEffect(() => {
    fetchGeneratedQRs();
  }, []);

  const fetchGeneratedQRs = async () => {
    try {
      // Fetch actual manufactured items from the backend
      const response = await axios.get('https://laser-engraving-or-qr-on-various-objects.onrender.com/items/manufactured', {
        params: { limit: 100 } // Get up to 100 recent items
      });
      
      if (response.data && response.data.length > 0) {
        // Map the backend response to match the expected format
        const qrItems = response.data.map(item => ({
          uid: item.uid,
          qr_path: item.qr_path,
          component: item.component,
          vendor: item.vendor,
          lot: item.lot,
          mfg_date: item.mfg_date,
          created_at: item.created_at
        }));
        setGeneratedQRs(qrItems);
      } else {
        // Fallback to mock data if no items found
        const mockQRs = [];
        for (let i = 1; i <= 10; i++) {
          mockQRs.push({
            uid: `PAD-V0100-L2025-09-${String(i).padStart(5, '0')}`,
            qr_path: `/api/qr/PAD-V0100-L2025-09-${String(i).padStart(5, '0')}`,
            component: 'PAD',
            vendor: 'V0100',
            lot: 'L2025-09'
          });
        }
        setGeneratedQRs(mockQRs);
      }
    } catch (err) {
      console.error('Failed to fetch generated QR codes from API:', err);
      setError('Failed to fetch generated QR codes from backend. Using mock data.');
      
      // Fallback to mock data on API error
      const mockQRs = [];
      for (let i = 1; i <= 10; i++) {
        mockQRs.push({
          uid: `PAD-V0100-L2025-09-${String(i).padStart(5, '0')}`,
          qr_path: `/api/qr/PAD-V0100-L2025-09-${String(i).padStart(5, '0')}`,
          component: 'PAD',
          vendor: 'V0100',
          lot: 'L2025-09'
        });
      }
      setGeneratedQRs(mockQRs);
    }
  };

  // Simulated engraving process
  const simulateEngraving = () => {
    if (currentEngravingIndex >= numQRsToEngrave || engravingStatus !== 'running') {
      if (currentEngravingIndex >= numQRsToEngrave) {
        setEngravingStatus('idle');
        setCurrentEngravingIndex(0);
      }
      return;
    }

    const currentQR = generatedQRs[currentEngravingIndex];
    if (currentQR) {
      // Set status to engraving
      setQrStatuses(prev => ({
        ...prev,
        [currentQR.uid]: 'engraving'
      }));

      // Simulate engraving process with delay
      setTimeout(() => {
        if (engravingStatus === 'running') {
          // Set status to engraved
          setQrStatuses(prev => ({
            ...prev,
            [currentQR.uid]: 'engraved'
          }));
          
          setCurrentEngravingIndex(prev => prev + 1);
        }
      }, timeDelay * 1000);
    }
  };

  // Effect to handle the engraving simulation
  useEffect(() => {
    if (engravingStatus === 'running') {
      intervalRef.current = setInterval(() => {
        simulateEngraving();
      }, (timeDelay + 0.5) * 1000); // Add small buffer
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [engravingStatus, currentEngravingIndex, numQRsToEngrave, timeDelay]);

  const handleStart = () => {
    if (generatedQRs.length === 0) {
      setError('No QR codes available for engraving.');
      return;
    }
    if (numQRsToEngrave > generatedQRs.length) {
      setError(`Cannot engrave ${numQRsToEngrave} QRs. Only ${generatedQRs.length} QRs available.`);
      return;
    }
    
    setError("");
    setEngravingStatus('running');
    setCurrentEngravingIndex(0);
    setQrStatuses({});
    setElapsedTime(0);
    setStartTime(Date.now());
    simulateEngraving();
  };

  const handlePause = () => {
    setEngravingStatus('paused');
  };

  const handleResume = () => {
    setEngravingStatus('running');
  };

  const handleEnd = () => {
    setEngravingStatus('stopped');
    setCurrentEngravingIndex(0);
    setQrStatuses({});
    setElapsedTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'engraving': return '#f59e0b';
      case 'engraved': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'engraving': return 'Engraving...';
      case 'engraved': return 'Engraved';
      default: return 'Pending';
    }
  };

  // Timer effect
  useEffect(() => {
    if (engravingStatus === 'running') {
      setStartTime(Date.now() - elapsedTime * 1000);
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [engravingStatus, startTime]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getCompletionPercentage = () => {
    const completed = Object.keys(qrStatuses).filter(uid => qrStatuses[uid] === 'engraved').length;
    return numQRsToEngrave > 0 ? Math.round((completed / numQRsToEngrave) * 100) : 0;
  };

  const getEstimatedTimeRemaining = () => {
    const completed = Object.keys(qrStatuses).filter(uid => qrStatuses[uid] === 'engraved').length;
    const remaining = numQRsToEngrave - completed;
    return remaining * timeDelay;
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <button onClick={onBack} className="back-button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5m0 0l7 7m-7-7l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back to Generate
            </button>
            <div className="logo-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z" stroke="currentColor" strokeWidth="2" fill="none"/>
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none"/>
              </svg>
            </div>
            <h1 className="app-title">Laser Engraving System</h1>
          </div>
          
          <div className="status-indicator">
            <div className={`status-dot ${engravingStatus}`}></div>
            <span className="status-text">{engravingStatus.toUpperCase()}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="page-container">
          <div className="page-header">
            <h2 className="page-title">QR Code Engraving</h2>
            <p className="page-subtitle">Configure and monitor the laser engraving process</p>
          </div>

          <div className="content-grid engrave-grid">
            {/* Configuration Panel */}
            <div className="form-section">
              <div className="form-card">
                <h3 className="card-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Configuration
                </h3>
                
                <div className="form-group">
                  <label className="form-label">QR Codes to Engrave</label>
                  <div className="input-with-info">
                    <input 
                      type="number" 
                      min="1" 
                      max={generatedQRs.length} 
                      value={numQRsToEngrave} 
                      onChange={e => setNumQRsToEngrave(parseInt(e.target.value) || 1)}
                      disabled={engravingStatus === 'running'}
                      className="form-input"
                    />
                    <span className="input-info">of {generatedQRs.length} available</span>
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Time Delay (seconds)</label>
                  <div className="input-with-info">
                    <input 
                      type="number" 
                      min="0.5" 
                      max="60" 
                      step="0.5" 
                      value={timeDelay} 
                      onChange={e => setTimeDelay(parseFloat(e.target.value) || 2.0)}
                      disabled={engravingStatus === 'running'}
                      className="form-input"
                    />
                    <span className="input-info">between each engraving</span>
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="control-buttons">
                  <button 
                    className={`btn btn-primary ${engravingStatus === 'running' ? 'btn-disabled' : ''}`}
                    onClick={handleStart}
                    disabled={engravingStatus === 'running'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <polygon points="5,3 19,12 5,21" fill="currentColor"/>
                    </svg>
                    Start Engraving
                  </button>
                  
                  <div className="button-group">
                    <button 
                      className={`btn btn-secondary ${engravingStatus !== 'running' ? 'btn-disabled' : ''}`}
                      onClick={handlePause}
                      disabled={engravingStatus !== 'running'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <rect x="6" y="4" width="4" height="16" fill="currentColor"/>
                        <rect x="14" y="4" width="4" height="16" fill="currentColor"/>
                      </svg>
                      Pause
                    </button>
                    
                    <button 
                      className={`btn btn-secondary ${engravingStatus !== 'paused' ? 'btn-disabled' : ''}`}
                      onClick={handleResume}
                      disabled={engravingStatus !== 'paused'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <polygon points="5,3 19,12 5,21" fill="currentColor"/>
                      </svg>
                      Resume
                    </button>
                    
                    <button 
                      className={`btn btn-secondary ${engravingStatus === 'idle' ? 'btn-disabled' : ''}`}
                      onClick={handleEnd}
                      disabled={engravingStatus === 'idle'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                        <rect x="9" y="9" width="6" height="6" fill="currentColor"/>
                      </svg>
                      Stop
                    </button>
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
              </div>
            </div>

            {/* Status and Progress Panel */}
            <div className="results-section">
              <div className="results-card">
                <div className="results-header">
                  <h3 className="card-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      <polyline points="22,4 12,14.01 9,11.01" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Progress Overview
                  </h3>
                </div>

                {/* Progress Stats */}
                <div className="progress-stats">
                  <div className="stat-item">
                    <div className="stat-value">{getCompletionPercentage()}%</div>
                    <div className="stat-label">Complete</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{Object.keys(qrStatuses).filter(uid => qrStatuses[uid] === 'engraved').length}</div>
                    <div className="stat-label">Engraved</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{numQRsToEngrave - Object.keys(qrStatuses).filter(uid => qrStatuses[uid] === 'engraved').length}</div>
                    <div className="stat-label">Remaining</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{formatTime(elapsedTime)}</div>
                    <div className="stat-label">Elapsed</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="progress-container">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${getCompletionPercentage()}%` }}
                    ></div>
                  </div>
                  <div className="progress-text">
                    {Object.keys(qrStatuses).filter(uid => qrStatuses[uid] === 'engraved').length} of {numQRsToEngrave} completed
                  </div>
                </div>

                {/* QR Status List */}
                <div className="qr-status-section">
                  <h4 className="section-title">Engraving Queue</h4>
                  <div className="qr-status-list">
                    {generatedQRs.slice(0, Math.min(numQRsToEngrave, 8)).map((qr, index) => (
                      <div key={qr.uid} className={`qr-status-item ${index === currentEngravingIndex && engravingStatus === 'running' ? 'current' : ''}`}>
                        <div className="qr-info">
                          <div className="qr-uid">{qr.uid}</div>
                          <div className="qr-index">#{String(index + 1).padStart(2, '0')}</div>
                        </div>
                        <div className="qr-status-badge">
                          <div className={`status-dot ${qrStatuses[qr.uid] || 'pending'}`}></div>
                          <span className="status-text">{getStatusText(qrStatuses[qr.uid])}</span>
                          {index === currentEngravingIndex && engravingStatus === 'running' && (
                            <div className="current-indicator">
                              <div className="pulse-dot"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {numQRsToEngrave > 8 && (
                      <div className="more-items">
                        +{numQRsToEngrave - 8} more items in queue
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
