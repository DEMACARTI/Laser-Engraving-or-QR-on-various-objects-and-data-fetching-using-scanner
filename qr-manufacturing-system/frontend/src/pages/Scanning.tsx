import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from '../styles/pages/Scanning.module.css';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  Switch,
  FormControlLabel,
  CircularProgress,
  Fade,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import {
  QrCodeScanner,
  CheckCircle,
  Info as InfoIcon,
  Clear as ClearIcon,
  Refresh,
  CameraAlt,
  Videocam,
  VideocamOff
} from '@mui/icons-material';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

interface ScanResult {
  success: boolean;
  uid: string;
  component?: string;
  vendor?: string;
  lot?: string;
  mfg_date?: string;
  warranty_years?: number;
  expiry_date?: string;
  current_status?: string;
  status_updated_at?: string;
  location?: string;
  note?: string;
  created_at?: string;
  error?: string;
}

interface ScanHistoryItem extends ScanResult {
  scannedAt: string;
}

const Scanning = () => {
  const [scannedUID, setScannedUID] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [cameraMode, setCameraMode] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [camerasLoading, setCamerasLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera utility (declared early to be used in effects)
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - assigning null is valid for HTMLVideoElement.srcObject
      videoRef.current.srcObject = null;
    }
    if (readerRef.current) {
      readerRef.current.reset();
    }
    setIsCameraActive(false);
  }, []);

  // Initialize ZXing reader
  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader();
    
    // Get available camera devices
    const getDevices = async () => {
      setCamerasLoading(true);
      try {
        console.log('🔍 Detecting available camera devices...');
        
        // Request permissions first to get device labels
        await navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
          stream.getTracks().forEach(track => track.stop());
        });
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        
        console.log(`📷 Found ${videoDevices.length} camera device(s):`, videoDevices.map(d => d.label || 'Unnamed Camera'));
        
        if (videoDevices.length > 0) {
          // Prefer back camera (environment) for QR scanning
          const backCamera = videoDevices.find(device => 
            device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('environment') ||
            device.label.toLowerCase().includes('rear')
          );
          const selectedDevice = backCamera?.deviceId || videoDevices[0].deviceId;
          setSelectedDeviceId(selectedDevice);
          console.log('✅ Default camera selected:', backCamera?.label || videoDevices[0].label || 'First available camera');
        } else {
          console.warn('⚠️ No camera devices found');
        }
      } catch (err) {
        console.error('❌ Error getting camera devices:', err);
        // Fallback: still try to enumerate devices without labels
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          setAvailableCameras(videoDevices);
          if (videoDevices.length > 0) {
            setSelectedDeviceId(videoDevices[0].deviceId);
            console.log(`📷 Fallback: Found ${videoDevices.length} camera(s) without labels`);
          }
        } catch (fallbackErr) {
          console.error('💥 Failed to enumerate devices:', fallbackErr);
          setError('Unable to access camera devices. Please check camera permissions.');
        }
      } finally {
        setCamerasLoading(false);
      }
    };

    getDevices();

    // Listen for device changes (cameras being connected/disconnected)
    const handleDeviceChange = () => {
      console.log('📱 Camera devices changed, refreshing...');
      // Refresh devices when they change
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        
        // If current device is no longer available, select the first one
        if (!videoDevices.find(d => d.deviceId === selectedDeviceId) && videoDevices.length > 0) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
      });
    };

    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange);

    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
      }
      stopCamera();
      navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [stopCamera, selectedDeviceId]);

  // Focus input on mount for barcode scanner
  useEffect(() => {
    if (!cameraMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [cameraMode]);

  // Cleanup effect - stop camera when component unmounts or camera mode changes
  useEffect(() => {
    return () => {
      // Cleanup when component unmounts
      stopCamera();
    };
  }, [stopCamera]);

  // Refresh camera devices
  const refreshCameraDevices = useCallback(async () => {
    console.log('🔄 Refreshing camera devices...');
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    setAvailableCameras(videoDevices);
    
    // If current device is no longer available, select the first one
    if (!videoDevices.find(d => d.deviceId === selectedDeviceId) && videoDevices.length > 0) {
      setSelectedDeviceId(videoDevices[0].deviceId);
    }
  }, [selectedDeviceId]);

  // Stop camera when switching away from camera mode
  useEffect(() => {
    if (!cameraMode && isCameraActive) {
      stopCamera();
    }
  }, [cameraMode, isCameraActive, stopCamera]);

  

  const addToHistory = useCallback((uid: string, result: ScanResult) => {
    const historyItem: ScanHistoryItem = {
      ...result,
      scannedAt: new Date().toISOString()
    };
    setScanHistory(prev => [historyItem, ...prev.slice(0, 9)]); // Keep last 10 scans
  }, []);

  const handleScan = useCallback(async (uid: string) => {
    if (!uid.trim()) {
      setError('Please enter a valid UID');
      return;
    }

    setLoading(true);
    setError('');
    setScanResult(null);

    try {
      console.log(`🔍 Attempting to scan UID: ${uid.trim()}`);
      
      // Connect to the backend scanning service (same database as QR generation)
      const response = await fetch('https://laser-engraving-or-qr-on-various-objects-gbbk.onrender.com/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: uid.trim()
        }),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      console.log('✅ Backend response received:', response);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('✅ Scan successful:', data);
          setScanResult(data);
          addToHistory(uid.trim(), data);
          setScannedUID('');
        } else {
          setError(data.error || 'Item not found in database');
        }
      } else {
        throw new Error('Backend service error');
      }
    } catch (err: any) {
      console.error('❌ Backend error details:', err);
      
      // Fallback to mock data when backend is not available
      const mockResponse = await simulateScanAPI(uid.trim());
      
      if (mockResponse.success) {
        console.log('✅ Mock data found for UID:', uid.trim());
        setScanResult(mockResponse);
        addToHistory(uid.trim(), mockResponse);
        setScannedUID('');
      } else {
        console.log('❌ UID not found in mock data:', uid.trim());
        setError(mockResponse.error || 'UID not found');
      }
    }
    
    setLoading(false);
    
    // Refocus input for continuous scanning
    if (!cameraMode && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [cameraMode, addToHistory]);

  const handleCameraChange = useCallback((event: SelectChangeEvent<string>) => {
    const newDeviceId = event.target.value;
    setSelectedDeviceId(newDeviceId);
    
    // If camera is currently active, restart with new device
    if (isCameraActive) {
      stopCamera();
      // Use a slight delay to ensure the camera is fully stopped before restarting
      setTimeout(() => {
        // Create a new camera start with the updated device ID
        if (readerRef.current && videoRef.current) {
          const startCameraWithDevice = async () => {
            try {
              setIsCameraActive(true);
              setError('');

              const constraints = {
                video: {
                  deviceId: newDeviceId ? { exact: newDeviceId } : undefined,
                  facingMode: newDeviceId ? undefined : { ideal: 'environment' },
                  width: { ideal: 1280 },
                  height: { ideal: 720 }
                }
              } as MediaStreamConstraints;

              const stream = await navigator.mediaDevices.getUserMedia(constraints);
              streamRef.current = stream;
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore - assigning MediaStream is supported at runtime
              videoRef.current!.srcObject = stream;

              // Start scanning
              readerRef.current!.decodeFromVideoDevice(
                newDeviceId || null,
                videoRef.current!,
                (result, error) => {
                  if (result) {
                    const scannedText = result.getText();
                    console.log('📷 QR Code scanned:', scannedText);
                    handleScan(scannedText);
                    // Stop camera after successful scan
                    setTimeout(() => {
                      stopCamera();
                      setCameraMode(false);
                    }, 1000);
                  }
                  if (error && !(error instanceof NotFoundException)) {
                    console.warn('Scan error:', error);
                  }
                }
              );
            } catch (err: any) {
              console.error('Camera error:', err);
              setError(`Camera error: ${err.message}`);
              setIsCameraActive(false);
            }
          };
          startCameraWithDevice();
        }
      }, 500);
    }
  }, [isCameraActive, stopCamera, handleScan, setCameraMode]);

  const startCamera = useCallback(async () => {
    if (!readerRef.current || !videoRef.current) return;

    try {
      setIsCameraActive(true);
      setError('');

      // Stop any existing stream
      stopCamera();

      const constraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          facingMode: selectedDeviceId ? undefined : { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      } as MediaStreamConstraints;

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - assigning MediaStream is supported at runtime
      videoRef.current.srcObject = stream;

      // Start scanning
      readerRef.current.decodeFromVideoDevice(
        selectedDeviceId || null,
        videoRef.current,
        (result, error) => {
          if (result) {
            const scannedText = result.getText();
            console.log('📷 QR Code scanned:', scannedText);
            handleScan(scannedText);
            // Stop camera after successful scan
            setTimeout(() => {
              stopCamera();
              setCameraMode(false);
            }, 1000);
          }
          if (error && !(error instanceof NotFoundException)) {
            console.warn('Scan error:', error);
          }
        }
      );

    } catch (err: any) {
      console.error('Camera error:', err);
      setError(`Camera error: ${err.message}`);
      setIsCameraActive(false);
    }
  }, [selectedDeviceId, stopCamera, handleScan]);

  // Mock database matching the QR generation service
  const simulateScanAPI = async (uid: string): Promise<ScanResult> => {
    // Add realistic delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Mock data that matches the generate QR page database structure
    const mockItems: Record<string, ScanResult> = {
      'PAD-V010-L2025-09-00001': {
        success: true,
        uid: 'PAD-V010-L2025-09-00001',
        component: 'PAD',
        vendor: 'V010',
        lot: 'L2025-09',
        mfg_date: '2025-09-23',
        warranty_years: 5,
        expiry_date: '2030-09-23',
        current_status: 'Manufactured',
        status_updated_at: '2025-09-23T10:30:00Z',
        location: 'Factory',
        note: 'Initial QR generation',
        created_at: '2025-09-23T10:30:00Z'
      },
      'PAD-V010-L2025-09-00002': {
        success: true,
        uid: 'PAD-V010-L2025-09-00002',
        component: 'PAD',
        vendor: 'V010',
        lot: 'L2025-09',
        mfg_date: '2025-09-23',
        warranty_years: 5,
        expiry_date: '2030-09-23',
        current_status: 'Quality Checked',
        status_updated_at: '2025-09-23T11:15:00Z',
        location: 'Quality Control',
        note: 'Passed quality inspection',
        created_at: '2025-09-23T10:30:00Z'
      },
      'ERC-V010-L2025-09-00001': {
        success: true,
        uid: 'ERC-V010-L2025-09-00001',
        component: 'ERC',
        vendor: 'V010',
        lot: 'L2025-09',
        mfg_date: '2025-09-23',
        warranty_years: 3,
        expiry_date: '2028-09-23',
        current_status: 'Shipped',
        status_updated_at: '2025-09-23T14:20:00Z',
        location: 'In Transit',
        note: 'Shipped to customer',
        created_at: '2025-09-23T10:30:00Z'
      },
      'LINER-V011-L2025-10-00001': {
        success: true,
        uid: 'LINER-V011-L2025-10-00001',
        component: 'LINER',
        vendor: 'V011',
        lot: 'L2025-10',
        mfg_date: '2025-09-23',
        warranty_years: 7,
        expiry_date: '2032-09-23',
        current_status: 'Installed',
        status_updated_at: '2025-09-23T16:45:00Z',
        location: 'Platform 5',
        note: 'Successfully installed',
        created_at: '2025-09-23T10:30:00Z'
      },
      'SLEEPER-V012-L2025-11-00001': {
        success: true,
        uid: 'SLEEPER-V012-L2025-11-00001',
        component: 'SLEEPER',
        vendor: 'V012',
        lot: 'L2025-11',
        mfg_date: '2025-09-23',
        warranty_years: 10,
        expiry_date: '2035-09-23',
        current_status: 'In Service',
        status_updated_at: '2025-09-23T18:30:00Z',
        location: 'Track A-5',
        note: 'Operational',
        created_at: '2025-09-23T10:30:00Z'
      }
    };

    const item = mockItems[uid];
    
    if (item) {
      return item;
    }
    
    return {
      success: false,
      uid,
      error: 'UID not found in mock data'
    };
  };

  const handleManualScan = () => {
    handleScan(scannedUID.trim());
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleManualScan();
    }
  };

  const handleManualEntry = () => {
    setDialogOpen(true);
    setManualCode('');
  };

  const handleDialogScan = () => {
    if (manualCode.trim()) {
      handleScan(manualCode.trim());
      setDialogOpen(false);
      setManualCode('');
    }
  };

  const clearResults = () => {
    setScanResult(null);
    setError('');
    setScannedUID('');
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'manufactured': return 'primary';
      case 'quality checked': return 'info';
      case 'shipped': return 'warning';
      case 'installed': return 'success';
      case 'in service': return 'success';
      default: return 'default';
    }
  };

  return (
    <Box className={styles.root}>
      <div className={`${styles.container} ${styles.offsetCenter}`}>
        <Typography variant="h4" gutterBottom className={styles.title} sx={{ mb: 3, fontWeight: 'bold' }}>
          🔍 QR Code Scanner
        </Typography>

      <Grid container spacing={3} className={styles.section}>
        {/* Scanner Section */}
        <Grid item xs={12} md={8}>
          <Paper className={styles.paper} sx={{ height: 'fit-content' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <QrCodeScanner color="primary" />
                Scanner
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={cameraMode}
                    onChange={(e) => {
                      setCameraMode(e.target.checked);
                      if (e.target.checked) {
                        // Don't auto-start camera, let user choose when to start
                        // startCamera();
                      } else {
                        stopCamera(); // Always stop camera when switching to manual mode
                      }
                    }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {cameraMode ? <Videocam fontSize="small" /> : <QrCodeScanner fontSize="small" />}
                    {cameraMode ? 'Camera Mode' : 'Manual Mode'}
                  </Box>
                }
              />
            </Box>

            {cameraMode ? (
              <Box>
                {/* Camera Device Selection */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CameraAlt color="primary" />
                    Camera Device Selection
                    <Chip 
                      label={`${availableCameras.length} device${availableCameras.length !== 1 ? 's' : ''} found`} 
                      size="small" 
                      color={availableCameras.length > 0 ? 'success' : 'error'}
                      variant="outlined"
                    />
                  </Typography>
                  
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={8}>
                      <FormControl fullWidth disabled={camerasLoading}>
                        <InputLabel id="camera-select-label">
                          {camerasLoading ? 'Detecting cameras...' : 'Select Camera Device'}
                        </InputLabel>
                        <Select
                          labelId="camera-select-label"
                          value={selectedDeviceId}
                          label={camerasLoading ? 'Detecting cameras...' : 'Select Camera Device'}
                          onChange={handleCameraChange}
                          startAdornment={<CameraAlt sx={{ mr: 1, color: 'action.active' }} />}
                        >
                          {availableCameras.length === 0 && !camerasLoading ? (
                            <MenuItem value="" disabled>
                              🚫 No cameras detected
                            </MenuItem>
                          ) : (
                            availableCameras.map((camera, index) => {
                              const isBackCamera = camera.label.toLowerCase().includes('back') || 
                                                 camera.label.toLowerCase().includes('environment') ||
                                                 camera.label.toLowerCase().includes('rear');
                              const isFrontCamera = camera.label.toLowerCase().includes('front') || 
                                                   camera.label.toLowerCase().includes('user') ||
                                                   camera.label.toLowerCase().includes('facing');
                              
                              let displayName = camera.label || `Camera ${index + 1}`;
                              let icon = '📷';
                              
                              if (camera.label) {
                                if (isBackCamera) {
                                  displayName = `Back Camera - ${camera.label}`;
                                  icon = '📱';
                                } else if (isFrontCamera) {
                                  displayName = `Front Camera - ${camera.label}`;
                                  icon = '🤳';
                                } else {
                                  displayName = camera.label;
                                  icon = '📷';
                                }
                              } else {
                                displayName = `Camera ${index + 1}`;
                                if (isBackCamera) {
                                  displayName += ' (Back)';
                                  icon = '📱';
                                } else if (isFrontCamera) {
                                  displayName += ' (Front)';
                                  icon = '🤳';
                                }
                              }
                              
                              return (
                                <MenuItem key={camera.deviceId} value={camera.deviceId}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <span>{icon}</span>
                                    <Box>
                                      <Typography variant="body2">{displayName}</Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        Device ID: {camera.deviceId.substring(0, 20)}...
                                      </Typography>
                                    </Box>
                                  </Box>
                                </MenuItem>
                              );
                            })
                          )}
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<Refresh />}
                        onClick={refreshCameraDevices}
                        disabled={camerasLoading}
                        size="large"
                      >
                        {camerasLoading ? <CircularProgress size={20} /> : 'Refresh Devices'}
                      </Button>
                    </Grid>
                  </Grid>
                  
                  {/* Camera Info and Tips */}
                  <Box sx={{ mt: 2 }}>
                    {availableCameras.length === 0 ? (
                      <Alert severity="error">
                        ❌ <strong>No cameras detected.</strong> Please check:
                        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                          <li>Camera permissions are granted</li>
                          <li>Camera is not being used by another application</li>
                          <li>Device has a working camera</li>
                        </ul>
                      </Alert>
                    ) : availableCameras.length === 1 ? (
                      <Alert severity="info">
                        📷 <strong>Single camera detected:</strong> {availableCameras[0].label || 'Unnamed Camera'}
                      </Alert>
                    ) : (
                      <Alert severity="success">
                        🎯 <strong>Multiple cameras available!</strong> Select the back/rear camera for optimal QR code scanning. Front cameras may have difficulty reading QR codes clearly.
                      </Alert>
                    )}
                    
                    {selectedDeviceId && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Currently selected: {availableCameras.find(c => c.deviceId === selectedDeviceId)?.label || 'Unknown Camera'}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
                
                {/* Camera Scanner */}
                <Box sx={{ position: 'relative', mb: 2 }}>
                  <video
                    ref={videoRef}
                    style={{
                      width: '100%',
                      maxWidth: 500,
                      height: 'auto',
                      border: '2px solid #1976d2',
                      borderRadius: 8,
                      backgroundColor: '#000'
                    }}
                    autoPlay
                    playsInline
                  />
                  
                  {isCameraActive && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        border: '3px solid #4caf50',
                        borderRadius: 8,
                        pointerEvents: 'none',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          width: '60%',
                          height: '60%',
                          border: '2px solid #4caf50',
                          borderRadius: 4,
                          transform: 'translate(-50%, -50%)',
                          animation: 'pulse 2s infinite'
                        }
                      }}
                    />
                  )}
                </Box>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  {!isCameraActive ? (
                    <Button
                      variant="contained"
                      startIcon={<Videocam />}
                      onClick={startCamera}
                      color="success"
                      size="large"
                    >
                      Start Camera
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      startIcon={<VideocamOff />}
                      onClick={stopCamera}
                      color="error"
                      size="large"
                    >
                      Stop Camera
                    </Button>
                  )}
                  
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={() => {
                      stopCamera();
                      setTimeout(startCamera, 500);
                    }}
                    disabled={!isCameraActive}
                  >
                    Restart Camera
                  </Button>
                </Box>
                
                {/* Resource optimization info */}
                <Box sx={{ mt: 2 }}>
                  {isCameraActive ? (
                    <Alert severity="warning" sx={{ fontSize: '0.875rem' }}>
                      📷 <strong>Camera Active:</strong> Click "Stop Camera" when done scanning to save device battery and resources.
                    </Alert>
                  ) : (
                    <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
                      🔋 <strong>Camera Stopped:</strong> Camera resources are optimized. Click "Start Camera" to begin scanning.
                    </Alert>
                  )}
                </Box>

                {isCameraActive && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    📱 <strong>Ready to Scan:</strong> Position the QR code within the camera view. The scanner will automatically detect and scan QR codes. Camera will stop after successful scan to save resources.
                  </Alert>
                )}
              </Box>
            ) : (
              <Box>
                {/* Manual Input Scanner */}
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Enter UID manually or use a barcode scanner gun
                </Typography>
                
                <Grid container spacing={2} alignItems="stretch" sx={{ mb: 2 }}>
                  <Grid item xs={12} md={9}>
                    <TextField
                      inputRef={inputRef}
                      label="Enter UID"
                      variant="outlined"
                      value={scannedUID}
                      onChange={(e) => setScannedUID(e.target.value)}
                      onKeyDown={handleKeyPress}
                      fullWidth
                      placeholder="e.g., PAD-V010-L2025-09-00001"
                      disabled={loading}
                      helperText="Press Enter to scan or use barcode scanner gun"
                    />
                  </Grid>
                  <Grid item xs={12} md={3} sx={{ display: 'flex', alignItems: 'stretch' }}>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={handleManualScan}
                      disabled={loading || !scannedUID.trim()}
                      sx={{
                        height: { md: 56 },
                        minHeight: { md: 56 },
                      }}
                    >
                      {loading ? <CircularProgress size={24} /> : 'Scan'}
                    </Button>
                  </Grid>
                </Grid>

                <Button
                  variant="outlined"
                  startIcon={<QrCodeScanner />}
                  onClick={handleManualEntry}
                  sx={{ mr: 2 }}
                >
                  Manual Entry
                </Button>
              </Box>
            )}

            {error && (
              <Fade in={true}>
                <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>
                  {error}
                </Alert>
              </Fade>
            )}
          </Paper>

          {/* Scan Results */}
          {scanResult && (
            <Fade in={true}>
              <Paper className={styles.paper} sx={{ mt: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircle color="success" />
                    Scan Result
                  </Typography>
                  <Button
                    startIcon={<ClearIcon />}
                    onClick={clearResults}
                    size="small"
                  >
                    Clear
                  </Button>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">
                          UID
                        </Typography>
                        <Typography variant="h6" sx={{ fontFamily: 'monospace', mb: 1 }}>
                          {scanResult.uid}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip label={scanResult.component} size="small" color="primary" />
                          <Chip label={scanResult.vendor} size="small" color="info" />
                          <Chip label={scanResult.lot} size="small" color="secondary" />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">
                          Status & Location
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Chip
                            label={scanResult.current_status}
                            color={getStatusColor(scanResult.current_status || '')}
                            size="small"
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          📍 {scanResult.location}
                        </Typography>
                        {scanResult.note && (
                          <Typography variant="body2" color="text.secondary">
                            📝 {scanResult.note}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Manufacturing & Warranty Information
                        </Typography>
                        
                        <Grid container spacing={2}>
                          <Grid item xs={6} sm={3}>
                            <Typography variant="body2" color="text.secondary">
                              Manufacturing Date
                            </Typography>
                            <Typography variant="body1">
                              {scanResult.mfg_date}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={6} sm={3}>
                            <Typography variant="body2" color="text.secondary">
                              Warranty Period
                            </Typography>
                            <Typography variant="body1">
                              {scanResult.warranty_years} years
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={6} sm={3}>
                            <Typography variant="body2" color="text.secondary">
                              Expiry Date
                            </Typography>
                            <Typography variant="body1">
                              {scanResult.expiry_date}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={6} sm={3}>
                            <Typography variant="body2" color="text.secondary">
                              Last Updated
                            </Typography>
                            <Typography variant="body2">
                              {scanResult.status_updated_at ? 
                                new Date(scanResult.status_updated_at).toLocaleString() : 
                                'N/A'
                              }
                            </Typography>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Paper>
            </Fade>
          )}
        </Grid>

        {/* Scan History */}
        <Grid item xs={12} md={4}>
          <Paper className={styles.paper} sx={{ height: 'fit-content' }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoIcon color="primary" />
              Recent Scans ({scanHistory.length})
            </Typography>
            
            {scanHistory.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                No scans yet. Start scanning to see history.
              </Typography>
            ) : (
              <List dense>
                {scanHistory.map((item, index) => (
                  <React.Fragment key={`${item.uid}-${item.scannedAt}`}>
                    <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {item.uid}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Chip
                              label={item.current_status || 'Unknown'}
                              size="small"
                              color={getStatusColor(item.current_status || '')}
                              sx={{ mr: 1, mb: 0.5 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {new Date(item.scannedAt).toLocaleString()}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < scanHistory.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Manual Entry Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Manual UID Entry</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="UID"
            fullWidth
            variant="outlined"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDialogScan()}
            placeholder="e.g., PAD-V010-L2025-09-00001"
            helperText="Enter the complete UID to scan"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDialogScan} variant="contained" disabled={!manualCode.trim()}>
            Scan
          </Button>
        </DialogActions>
      </Dialog>

      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}
      </style>
      </div>
    </Box>
  );
};

export default Scanning;