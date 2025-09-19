import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import '../App.css';

export default function ScanningPage({ onBack }) {
  const [scannedUID, setScannedUID] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanHistory, setScanHistory] = useState([]);
  const [manualInput, setManualInput] = useState(true);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [cameraPermission, setCameraPermission] = useState('prompt'); // 'granted', 'denied', 'prompt'
  const inputRef = useRef(null);
  const videoRef = useRef(null);

  // Focus input on mount for barcode scanner
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleScan = async (uid) => {
    if (!uid.trim()) {
      setError('Please enter a valid UID');
      return;
    }

    setLoading(true);
    setError('');
    setScanResult(null);

    try {
      // Mock API call since scanning_service.py might not be running
      // In production, this would call: http://localhost:5001/scan
      const mockResponse = await simulateScanAPI(uid.trim());
      
      if (mockResponse.ok) {
        setScanResult(mockResponse);
        setScanHistory(prev => [
          { ...mockResponse, scannedAt: new Date().toISOString() },
          ...prev.slice(0, 9) // Keep last 10 scans
        ]);
        setScannedUID('');
      } else {
        setError(mockResponse.error || 'UID not found');
      }
    } catch (err) {
      setError('Failed to scan UID. Please check the service connection.');
    }
    
    setLoading(false);
    
    // Refocus input for continuous scanning
    if (inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 100);
    }
  };

  // Simulate the scanning service API response
  const simulateScanAPI = async (uid) => {
    // Add realistic delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Mock data - in production this would come from scanning_service.py
    const mockItems = {
      'PAD-V0100-L2025-09-00001': {
        ok: true,
        uid: 'PAD-V0100-L2025-09-00001',
        component: 'PAD',
        vendor: 'V0100',
        lot: 'L2025-09',
        mfg_date: '2025-09-18',
        warranty_years: 5,
        expiry_date: '2030-09-18',
        current_status: 'Manufactured',
        status_updated_at: '2025-09-18 10:30:00'
      },
      'ERC-V001-L2025-09-00001': {
        ok: true,
        uid: 'ERC-V001-L2025-09-00001',
        component: 'ERC',
        vendor: 'V001',
        lot: 'L2025-09',
        mfg_date: '2025-09-17',
        warranty_years: 3,
        expiry_date: '2028-09-17',
        current_status: 'In Transit',
        status_updated_at: '2025-09-18 14:20:00'
      },
      'LINER-V012-L2025-10-00001': {
        ok: true,
        uid: 'LINER-V012-L2025-10-00001',
        component: 'LINER',
        vendor: 'V012',
        lot: 'L2025-10',
        mfg_date: '2025-09-19',
        warranty_years: 7,
        expiry_date: '2032-09-19',
        current_status: 'Quality Check',
        status_updated_at: '2025-09-19 09:15:00'
      }
    };

    if (mockItems[uid]) {
      return mockItems[uid];
    } else {
      return { ok: false, error: 'UID not found in database' };
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleScan(scannedUID);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setScannedUID(value);
    setError('');
    
    // Auto-submit if looks like a complete UID (for barcode scanner integration)
    if (!manualInput && value.length >= 20 && value.includes('-')) {
      setTimeout(() => handleScan(value), 100);
    }
  };

  const getStatusColor = (status) => {
    const statusColors = {
      'Manufactured': '#059669',
      'Quality Check': '#d97706',
      'In Transit': '#2563eb',
      'Delivered': '#10b981',
      'Installed': '#6366f1',
      'Maintenance': '#f59e0b',
      'Decommissioned': '#dc2626'
    };
    return statusColors[status] || '#6b7280';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const clearHistory = () => {
    setScanHistory([]);
  };

  // Camera Functions
  const checkCameraPermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'camera' });
      setCameraPermission(result.state);
      return result.state;
    } catch (error) {
      console.log('Permission API not supported, will request on camera access');
      return 'prompt';
    }
  };

  const getAvailableCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(cameras);
      if (cameras.length > 0 && !selectedCamera) {
        setSelectedCamera(cameras[0].deviceId);
      }
      return cameras;
    } catch (error) {
      console.error('Error getting cameras:', error);
      setCameraError('Failed to get camera list');
      return [];
    }
  };

  const startCamera = async (deviceId = null) => {
    try {
      setCameraError('');
      
      // Stop existing stream if any
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: deviceId ? undefined : 'environment', // prefer rear camera on mobile
          deviceId: deviceId ? { exact: deviceId } : undefined
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      setCameraPermission('granted');
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (error) {
      console.error('Error starting camera:', error);
      setCameraPermission('denied');
      
      let errorMessage = 'Camera access failed. ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera permission and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera found on this device.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera is already in use by another application.';
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }
      
      setCameraError(errorMessage);
      return null;
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const switchCamera = async (deviceId) => {
    setSelectedCamera(deviceId);
    if (cameraStream) {
      await startCamera(deviceId);
    }
  };

  // Initialize camera on component mount
  useEffect(() => {
    const initializeCamera = async () => {
      await checkCameraPermission();
      await getAvailableCameras();
    };
    
    initializeCamera();
    
    // Cleanup on unmount
    return () => {
      stopCamera();
    };
  }, []);

  // Handle scanner mode toggle
  useEffect(() => {
    if (!manualInput && !cameraStream) {
      startCamera(selectedCamera);
    } else if (manualInput && cameraStream) {
      stopCamera();
    }
  }, [manualInput, selectedCamera]);

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
              Back to Main
            </button>
            <div className="logo-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
              </svg>
            </div>
            <h1 className="app-title">QR Code Scanner</h1>
          </div>
          
          <nav className="header-nav">
            <Link to="/" className="nav-back-btn">
              <span className="nav-icon">←</span>
              Back to QR Management
            </Link>
          </nav>
          
          <div className="scan-mode-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={!manualInput}
                onChange={(e) => setManualInput(!e.target.checked)}
                className="toggle-input"
              />
              <span className="toggle-slider"></span>
              <span className="toggle-text">
                {manualInput ? 'Manual Input' : 'Scanner Mode'}
              </span>
            </label>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="page-container">
          <div className="page-header">
            <h2 className="page-title">Item Scanning & Verification</h2>
            <p className="page-subtitle">Scan QR codes to retrieve item details and current status</p>
          </div>

          <div className="scanning-layout">
            {/* Scanning Section */}
            <div className="scan-section">
              <div className="scan-card">
                <h3 className="card-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="8" height="8" stroke="currentColor" strokeWidth="2"/>
                    <rect x="13" y="3" width="8" height="8" stroke="currentColor" strokeWidth="2"/>
                    <rect x="3" y="13" width="8" height="8" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Scan QR Code
                </h3>

                {/* Camera Preview Section */}
                {!manualInput && (
                  <div className="camera-section">
                    <div className="camera-preview-container">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="camera-preview"
                      />
                      
                      {/* Camera Overlay */}
                      <div className="camera-overlay">
                        <div className="scan-frame">
                          <div className="scan-corners">
                            <div className="corner top-left"></div>
                            <div className="corner top-right"></div>
                            <div className="corner bottom-left"></div>
                            <div className="corner bottom-right"></div>
                          </div>
                          <div className="scan-line"></div>
                        </div>
                      </div>

                      {/* Camera Status */}
                      <div className="camera-status">
                        {cameraStream && (
                          <div className="status-indicator active">
                            <div className="status-dot"></div>
                            <span>Camera Active</span>
                          </div>
                        )}
                        {cameraError && (
                          <div className="status-indicator error">
                            <span>⚠️ {cameraError}</span>
                          </div>
                        )}
                        {cameraPermission === 'denied' && (
                          <div className="status-indicator error">
                            <span>❌ Camera permission denied</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Camera Controls */}
                    <div className="camera-controls">
                      {availableCameras.length > 1 && (
                        <div className="camera-selector">
                          <label htmlFor="camera-select">Camera:</label>
                          <select
                            id="camera-select"
                            value={selectedCamera}
                            onChange={(e) => switchCamera(e.target.value)}
                            className="camera-select"
                          >
                            {availableCameras.map((camera, index) => (
                              <option key={camera.deviceId} value={camera.deviceId}>
                                {camera.label || `Camera ${index + 1}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="camera-buttons">
                        {!cameraStream ? (
                          <button
                            type="button"
                            onClick={() => startCamera(selectedCamera)}
                            className="camera-btn start-btn"
                          >
                            <span>📹</span>
                            Start Camera
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="camera-btn stop-btn"
                          >
                            <span>⏹️</span>
                            Stop Camera
                          </button>
                        )}

                        {cameraPermission === 'denied' && (
                          <button
                            type="button"
                            onClick={() => startCamera(selectedCamera)}
                            className="camera-btn retry-btn"
                          >
                            <span>🔄</span>
                            Retry Permission
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                <form onSubmit={handleSubmit} className="scan-form">
                  <div className="scan-input-group">
                    <input
                      ref={inputRef}
                      type="text"
                      value={scannedUID}
                      onChange={handleInputChange}
                      placeholder={manualInput ? "Enter UID manually (e.g., PAD-V0100-L2025-09-00001)" : "Scan QR code or enter UID"}
                      className="scan-input"
                      disabled={loading}
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      className="scan-button"
                      disabled={loading || !scannedUID.trim()}
                    >
                      {loading ? (
                        <div className="spinner"></div>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2"/>
                          </svg>
                          Scan
                        </>
                      )}
                    </button>
                  </div>
                </form>

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

                <div className="scan-examples">
                  <h4>Try these sample UIDs:</h4>
                  <div className="example-uids">
                    {['PAD-V0100-L2025-09-00001', 'ERC-V001-L2025-09-00001', 'LINER-V012-L2025-10-00001'].map(uid => (
                      <button
                        key={uid}
                        onClick={() => setScannedUID(uid)}
                        className="example-uid-btn"
                        disabled={loading}
                      >
                        {uid}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Results Section */}
            <div className="results-section">
              {scanResult ? (
                <div className="scan-result-card">
                  <div className="result-header">
                    <h3 className="card-title">Item Details</h3>
                    <div className="status-badge" style={{ backgroundColor: getStatusColor(scanResult.current_status) }}>
                      {scanResult.current_status || 'Unknown'}
                    </div>
                  </div>
                  
                  <div className="result-content">
                    <div className="result-grid">
                      <div className="result-field">
                        <label>UID</label>
                        <span className="result-uid">{scanResult.uid}</span>
                      </div>
                      <div className="result-field">
                        <label>Component</label>
                        <span>{scanResult.component}</span>
                      </div>
                      <div className="result-field">
                        <label>Vendor</label>
                        <span>{scanResult.vendor}</span>
                      </div>
                      <div className="result-field">
                        <label>Lot Number</label>
                        <span>{scanResult.lot}</span>
                      </div>
                      <div className="result-field">
                        <label>Manufacturing Date</label>
                        <span>{formatDate(scanResult.mfg_date)}</span>
                      </div>
                      <div className="result-field">
                        <label>Warranty Period</label>
                        <span>{scanResult.warranty_years} years</span>
                      </div>
                      <div className="result-field">
                        <label>Expiry Date</label>
                        <span className={isExpired(scanResult.expiry_date) ? 'expired' : 'valid'}>
                          {formatDate(scanResult.expiry_date)}
                          {isExpired(scanResult.expiry_date) && (
                            <span className="expired-indicator">⚠️ EXPIRED</span>
                          )}
                        </span>
                      </div>
                      <div className="result-field">
                        <label>Status Updated</label>
                        <span>{formatDateTime(scanResult.status_updated_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="scan-placeholder">
                  <div className="placeholder-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.5"/>
                      <rect x="13" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.5"/>
                      <rect x="3" y="13" width="8" height="8" stroke="currentColor" strokeWidth="1.5"/>
                      <circle cx="17" cy="17" r="3" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  </div>
                  <h3>Ready to Scan</h3>
                  <p>Enter a UID or scan a QR code to view item details</p>
                </div>
              )}
            </div>
          </div>

          {/* Scan History */}
          {scanHistory.length > 0 && (
            <div className="scan-history-section">
              <div className="history-header">
                <h3>Recent Scans</h3>
                <button onClick={clearHistory} className="clear-history-btn">
                  Clear History
                </button>
              </div>
              <div className="history-list">
                {scanHistory.map((item, index) => (
                  <div key={`${item.uid}-${index}`} className="history-item">
                    <div className="history-item-main">
                      <span className="history-uid">{item.uid}</span>
                      <span className="history-component">{item.component}</span>
                      <div className="history-status" style={{ color: getStatusColor(item.current_status) }}>
                        {item.current_status}
                      </div>
                    </div>
                    <div className="history-time">
                      {formatDateTime(item.scannedAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}