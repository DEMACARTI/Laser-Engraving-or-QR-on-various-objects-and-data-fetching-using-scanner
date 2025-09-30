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
    // Enhanced mobile text processing
    const processedUID = uid
      .trim() // Remove whitespace
      .replace(/\r\n|\r|\n/g, '') // Remove newlines
      .replace(/\0/g, '') // Remove null characters
      .replace(/\s+/g, ' ') // Normalize multiple spaces
      .toUpperCase(); // Convert to uppercase for consistent matching
    
    if (!processedUID) {
      setError('Please enter a valid UID');
      return;
    }

    setLoading(true);
    setError('');
    setScanResult(null);

    try {
      console.log(`� Original scanned text: "${uid}"`);
      console.log(`🔍 Processed UID: "${processedUID}"`);
      console.log(`🔍 UID length: ${processedUID.length}`);
      console.log(`🔍 UID char codes:`, Array.from(processedUID).map(c => c.charCodeAt(0)));
      
      // Connect to the backend scanning service (same database as QR generation)
      const response = await fetch('https://laser-engraving-or-qr-on-various-objects-gbbk.onrender.com/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: processedUID
        }),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      console.log('✅ Backend response received:', response);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('✅ Scan successful:', data);
          setScanResult(data);
          addToHistory(processedUID, data);
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
      const mockResponse = await simulateScanAPI(processedUID);
      
      if (mockResponse.success) {
        console.log('✅ Mock data found for UID:', processedUID);
        setScanResult(mockResponse);
        addToHistory(processedUID, mockResponse);
        setScannedUID('');
      } else {
        console.log('❌ UID not found in mock data:', processedUID);
        setError(`${mockResponse.error || 'UID not found'} - Processed: "${processedUID}"`);
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

      // Enhanced mobile camera constraints for better QR scanning
      const constraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          facingMode: selectedDeviceId ? undefined : { ideal: 'environment' },
          width: { ideal: 1920, min: 640 }, // Higher resolution for better QR reading
          height: { ideal: 1080, min: 480 },
          frameRate: { ideal: 30, min: 15 }, // Smooth video for mobile
          aspectRatio: { ideal: 16/9 }, // Standard mobile aspect ratio
          focusMode: 'continuous', // Continuous autofocus for mobile
          exposureMode: 'continuous', // Auto exposure
          whiteBalanceMode: 'continuous' // Auto white balance
        }
      } as MediaStreamConstraints;

      console.log('📱 Starting mobile-optimized camera with constraints:', constraints);

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
        // Apply additional mobile video settings
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          // Apply advanced constraints for mobile devices
          const capabilities = videoTrack.getCapabilities();
          console.log('📱 Camera capabilities:', capabilities);
          
          const advancedConstraints: any = {};
          
          // Check for mobile camera capabilities safely
          if ('focusMode' in capabilities && Array.isArray((capabilities as any).focusMode)) {
            const focusModes = (capabilities as any).focusMode;
            if (focusModes.includes('continuous')) {
              advancedConstraints.focusMode = 'continuous';
            }
          }
          
          if ('exposureMode' in capabilities && Array.isArray((capabilities as any).exposureMode)) {
            const exposureModes = (capabilities as any).exposureMode;
            if (exposureModes.includes('continuous')) {
              advancedConstraints.exposureMode = 'continuous';
            }
          }
          
          // Apply zoom settings for mobile if available
          if ('zoom' in capabilities && (capabilities as any).zoom) {
            const zoom = (capabilities as any).zoom;
            if (zoom.min !== undefined && zoom.max !== undefined) {
              // Set optimal zoom for QR scanning (slightly zoomed for better detail)
              const optimalZoom = Math.min(zoom.max, Math.max(zoom.min, 1.2));
              advancedConstraints.zoom = optimalZoom;
            }
          }
          
          if (Object.keys(advancedConstraints).length > 0) {
            try {
              await videoTrack.applyConstraints({ advanced: [advancedConstraints] });
              console.log('📱 Applied advanced mobile constraints:', advancedConstraints);
            } catch (advancedErr) {
              console.warn('📱 Could not apply advanced constraints:', advancedErr);
            }
          }
        }      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - assigning MediaStream is supported at runtime
      videoRef.current.srcObject = stream;

      // Enhanced ZXing configuration for mobile QR scanning
      const decodeHints = new Map();
      decodeHints.set(2, [0]); // QR_CODE format
      decodeHints.set(3, true); // TRY_HARDER for better mobile detection
      decodeHints.set(4, true); // PURE_BARCODE for cleaner detection
      
      // Start scanning with mobile-optimized settings
      readerRef.current.decodeFromVideoDevice(
        selectedDeviceId || null,
        videoRef.current,
        (result, error) => {
          if (result) {
            const scannedText = result.getText();
            console.log('� Raw QR Code scanned:', `"${scannedText}"`);
            console.log('📱 QR Code length:', scannedText.length);
            console.log('📱 QR Code char codes:', Array.from(scannedText).map(c => c.charCodeAt(0)));
            
            // Mobile-specific text cleaning
            const cleanedText = scannedText
              .trim()
              .replace(/\r\n|\r|\n/g, '') // Remove newlines
              .replace(/\0/g, '') // Remove null characters
              .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
              .normalize('NFC'); // Normalize Unicode
              
            console.log('📱 Cleaned QR Code for mobile:', `"${cleanedText}"`);
            
            // Mobile feedback: haptic + visual
            if ('vibrate' in navigator) {
              // Double vibration for success
              navigator.vibrate([100, 50, 100]);
            }
            
            // Add visual feedback for successful scan
            if (videoRef.current) {
              videoRef.current.style.border = '3px solid #4caf50';
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.style.border = '2px solid #1976d2';
                }
              }, 500);
            }
            
            // Mobile performance: reduce frame rate during processing
            if (streamRef.current) {
              const tracks = streamRef.current.getVideoTracks();
              if (tracks.length > 0) {
                const track = tracks[0];
                const currentConstraints = track.getConstraints();
                track.applyConstraints({
                  ...currentConstraints,
                  frameRate: { ideal: 15 } // Reduce during processing
                }).catch(err => console.warn('Could not reduce frame rate:', err));
              }
            }
            
            handleScan(cleanedText);
            
            // Stop camera after successful scan
            setTimeout(() => {
              stopCamera();
              setCameraMode(false);
            }, 1000);
          }
          if (error && !(error instanceof NotFoundException)) {
            console.warn('📱 Mobile scan error:', error);
          }
        }
      );

    } catch (err: any) {
      console.error('📱 Mobile camera error:', err);
      setError(`Camera error: ${err.message}. Try using back camera for better QR scanning.`);
      setIsCameraActive(false);
    }
  }, [selectedDeviceId, stopCamera, handleScan]);

  // Enhanced mock database with mobile-friendly matching
  const simulateScanAPI = async (uid: string): Promise<ScanResult> => {
    // Add realistic delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Enhanced mobile text processing
    const processedUID = uid
      .trim()
      .replace(/\r\n|\r|\n/g, '')
      .replace(/\0/g, '')
      .replace(/\s+/g, ' ')
      .toUpperCase();
    
    console.log(`📱 Mock API searching for: "${processedUID}"`);
    
    // Enhanced mock data with mobile test UIDs
    const mockItems: Record<string, ScanResult> = {
      // Original test data
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
      },
      // Mobile-friendly test UIDs
      'TEST-MOBILE-001': {
        success: true,
        uid: 'TEST-MOBILE-001',
        component: 'TEST',
        vendor: 'MOBILE',
        lot: 'L2025-TEST',
        mfg_date: '2025-09-30',
        warranty_years: 1,
        expiry_date: '2026-09-30',
        current_status: 'Mobile Test',
        status_updated_at: '2025-09-30T12:00:00Z',
        location: 'Mobile Lab',
        note: 'QR code mobile scanning test',
        created_at: '2025-09-30T12:00:00Z'
      },
      'QR-TEST-123': {
        success: true,
        uid: 'QR-TEST-123',
        component: 'QR',
        vendor: 'TEST',
        lot: 'L2025-QR',
        mfg_date: '2025-09-30',
        warranty_years: 2,
        expiry_date: '2027-09-30',
        current_status: 'QR Mobile Test',
        status_updated_at: '2025-09-30T12:00:00Z',
        location: 'Testing Lab',
        note: 'QR code mobile device test',
        created_at: '2025-09-30T12:00:00Z'
      },
      'MOBILE-QR-999': {
        success: true,
        uid: 'MOBILE-QR-999',
        component: 'MOBILE',
        vendor: 'QR',
        lot: 'L2025-MOBILE',
        mfg_date: '2025-09-30',
        warranty_years: 1,
        expiry_date: '2026-09-30',
        current_status: 'Mobile Ready',
        status_updated_at: '2025-09-30T12:00:00Z',
        location: 'Mobile Testing',
        note: 'Optimized for mobile QR scanning',
        created_at: '2025-09-30T12:00:00Z'
      }
    };

    // Try exact match first
    let item = mockItems[processedUID];
    
    // If not found, try case-insensitive matching
    if (!item) {
      console.log(`📱 Exact match not found for: "${processedUID}"`);
      console.log('📱 Available UIDs in mock data:', Object.keys(mockItems));
      
      const caseInsensitiveKey = Object.keys(mockItems).find(key => 
        key.toLowerCase() === processedUID.toLowerCase()
      );
      
      if (caseInsensitiveKey) {
        item = mockItems[caseInsensitiveKey];
        console.log(`✅ Found case-insensitive match: "${caseInsensitiveKey}"`);
      }
    }
    
    // Try partial matching for mobile scanning issues
    if (!item) {
      const partialMatch = Object.keys(mockItems).find(key => 
        key.includes(processedUID) || processedUID.includes(key)
      );
      
      if (partialMatch) {
        item = mockItems[partialMatch];
        console.log(`✅ Found partial match: "${partialMatch}" for "${processedUID}"`);
      }
    }
    
    if (item) {
      console.log(`✅ Mock data found for: "${processedUID}"`);
      return item;
    }
    
    console.log(`❌ No mock data found for: "${processedUID}"`);
    return {
      success: false,
      uid: processedUID,
      error: `UID not found in mock data. Searched for: "${processedUID}". Available mobile test UIDs: TEST-MOBILE-001, QR-TEST-123, MOBILE-QR-999, PAD-V010-L2025-09-00001`
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
                <Box sx={{ position: 'relative', mb: 2 }} className="mobile-scanner-container">
                  <video
                    ref={videoRef}
                    className="mobile-video"
                    style={{
                      width: '100%',
                      maxWidth: 500,
                      height: 'auto',
                      minHeight: 250,
                      border: '2px solid #1976d2',
                      borderRadius: 8,
                      backgroundColor: '#000',
                      objectFit: 'cover'
                    }}
                    autoPlay
                    playsInline
                    muted
                    controls={false}
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

                <Box 
                  sx={{ 
                    display: 'flex', 
                    gap: 2, 
                    flexWrap: 'wrap', 
                    alignItems: 'center',
                    flexDirection: { xs: 'column', md: 'row' },
                    '& > *': { 
                      minWidth: { xs: '100%', md: 'auto' },
                      minHeight: { xs: 48, md: 'auto' }
                    }
                  }} 
                  className="mobile-buttons"
                >
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
                
                {/* Mobile-optimized resource info */}
                <Box sx={{ mt: 2 }}>
                  {isCameraActive ? (
                    <Alert severity="warning" sx={{ fontSize: '0.875rem' }}>
                      � <strong>Camera Active:</strong> Hold device steady, ensure good lighting, and position QR code clearly in frame. Click "Stop Camera" when done to save battery.
                      <br />
                      <strong>📷 Mobile Tips:</strong> Use back camera, avoid glare, keep QR code flat and well-lit.
                    </Alert>
                  ) : (
                    <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
                      🔋 <strong>Camera Stopped:</strong> Resources optimized. Click "Start Camera" to begin mobile QR scanning.
                      <br />
                      <strong>🧪 Test UIDs:</strong> TEST-MOBILE-001, QR-TEST-123, MOBILE-QR-999, PAD-V010-L2025-09-00001
                    </Alert>
                  )}
                </Box>

                {isCameraActive && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    📱 <strong>Mobile Scanner Ready:</strong> Hold device 6-12 inches from QR code. Ensure good lighting and steady hands. Scanner auto-detects and provides haptic feedback on success.
                    <br />
                    <strong>💡 Mobile Tips:</strong> Tap screen to focus if blurry, avoid shadows, keep QR code flat and centered.
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