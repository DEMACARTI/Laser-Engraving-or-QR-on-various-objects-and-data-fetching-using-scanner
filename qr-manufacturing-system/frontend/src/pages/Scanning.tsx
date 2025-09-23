import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Divider
} from '@mui/material';
import {
  CameraAlt,
  QrCodeScanner,
  CheckCircle,
  Error as ErrorIcon,
  Info as InfoIcon,
  Clear as ClearIcon,
  StopCircle,
  PlayCircle,
  Refresh
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
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize ZXing reader
  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader();
    
    // Get available camera devices
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableDevices(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error('Error getting camera devices:', err);
      }
    };

    getDevices();

    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
      }
      stopCamera();
    };
  }, []);

  // Focus input on mount for barcode scanner
  useEffect(() => {
    if (!cameraMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [cameraMode]);

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
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
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
  }, [selectedDeviceId]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (readerRef.current) {
      readerRef.current.reset();
    }
    setIsCameraActive(false);
  }, []);

  const handleScan = async (uid: string) => {
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
      const response = await fetch('http://localhost:5002/scan', {
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
  };

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
      uid: uid,
      error: 'UID not found in database'
    };
  };

  const addToHistory = (uid: string, result: ScanResult) => {
    const historyItem: ScanHistoryItem = {
      ...result,
      scannedAt: new Date().toISOString()
    };
    
    setScanHistory(prev => [historyItem, ...prev.slice(0, 9)]); // Keep last 10 scans
  };

  const handleManualScan = () => {
    handleScan(scannedUID);
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
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        🔍 QR Code Scanner
      </Typography>

      <Grid container spacing={3}>
        {/* Scanner Section */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: 'fit-content' }}>
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
                        startCamera();
                      } else {
                        stopCamera();
                      }
                    }}
                  />
                }
                label="Camera Mode"
              />
            </Box>

            {cameraMode ? (
              <Box>
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

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {!isCameraActive ? (
                    <Button
                      variant="contained"
                      startIcon={<PlayCircle />}
                      onClick={startCamera}
                      color="success"
                    >
                      Start Camera
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      startIcon={<StopCircle />}
                      onClick={stopCamera}
                      color="error"
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
                    Restart
                  </Button>
                </Box>

                {isCameraActive && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Position the QR code within the camera view. The scanner will automatically detect and scan QR codes.
                  </Alert>
                )}
              </Box>
            ) : (
              <Box>
                {/* Manual Input Scanner */}
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Enter UID manually or use a barcode scanner gun
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-end' }}>
                  <TextField
                    ref={inputRef}
                    label="Enter UID"
                    variant="outlined"
                    value={scannedUID}
                    onChange={(e) => setScannedUID(e.target.value)}
                    onKeyPress={handleKeyPress}
                    fullWidth
                    placeholder="e.g., PAD-V010-L2025-09-00001"
                    disabled={loading}
                    helperText="Press Enter to scan or use barcode scanner gun"
                  />
                  
                  <Button
                    variant="contained"
                    onClick={handleManualScan}
                    disabled={loading || !scannedUID.trim()}
                    sx={{ minWidth: 120 }}
                  >
                    {loading ? <CircularProgress size={24} /> : 'Scan'}
                  </Button>
                </Box>

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
              <Paper sx={{ p: 3, mt: 3 }}>
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
          <Paper sx={{ p: 3, height: 'fit-content' }}>
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
            onKeyPress={(e) => e.key === 'Enter' && handleDialogScan()}
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
    </Box>
  );
};

export default Scanning;