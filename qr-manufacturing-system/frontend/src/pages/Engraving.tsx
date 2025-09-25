import React, { useState, useEffect, useRef } from 'react';
import styles from '../styles/pages/Engraving.module.css';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import TrainLoader from '../components/Loaders/TrainLoader';

interface EngravingQR {
  uid: string;
  qr_path: string;
  component: string;
  vendor: string;
  lot: string;
  mfg_date?: string;
  created_at?: string;
}

const Engraving: React.FC = () => {
  const [generatedQRs, setGeneratedQRs] = useState<EngravingQR[]>([]);
  const [numQRsToEngrave, setNumQRsToEngrave] = useState(10);
  const [timeDelay, setTimeDelay] = useState(2.0);
  const [engravingStatus, setEngravingStatus] = useState<'idle' | 'running' | 'paused' | 'stopped'>('idle');
  const [qrStatuses, setQrStatuses] = useState<Record<string, string>>({});
  const [currentEngravingIndex, setCurrentEngravingIndex] = useState(0);
  const [error, setError] = useState("");
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch generated QR codes on mount
  useEffect(() => {
    fetchGeneratedQRs();
  }, []);

  const fetchGeneratedQRs = async () => {
    try {
      // Fetch actual manufactured items from the backend
      const response = await fetch('https://laser-engraving-or-qr-on-various-objects-gbbk.onrender.com/items/manufactured?limit=5000');
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.items && data.items.length > 0) {
          // Map the backend response to match the expected format
          const qrItems = data.items.map((item: any) => ({
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
          throw new Error('No items found');
        }
      } else {
        throw new Error('Backend response not ok');
      }
    } catch (err) {
      console.error('Failed to fetch generated QR codes from API:', err);
      setError('Failed to fetch generated QR codes from backend. Using mock data.');
      
      // Fallback to mock data on API error
      const mockQRs = [];
      for (let i = 1; i <= 20; i++) {
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
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
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
  }, [engravingStatus, currentEngravingIndex, numQRsToEngrave, timeDelay, generatedQRs]);

  // Timer effect for elapsed time
  useEffect(() => {
    if (engravingStatus === 'running' && !timerRef.current) {
      if (!startTime) {
        setStartTime(new Date());
      }
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else if (engravingStatus !== 'running' && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [engravingStatus, startTime]);

  const handleStartEngraving = () => {
    if (generatedQRs.length === 0) {
      setError('No QR codes available for engraving. Please generate some first.');
      return;
    }
    
    setEngravingStatus('running');
    setCurrentEngravingIndex(0);
    setStartTime(new Date());
    setElapsedTime(0);
    setError('');
    
    // Reset all statuses
    const resetStatuses: Record<string, string> = {};
    generatedQRs.slice(0, numQRsToEngrave).forEach(qr => {
      resetStatuses[qr.uid] = 'pending';
    });
    setQrStatuses(resetStatuses);
  };

  const handlePauseEngraving = () => {
    setEngravingStatus('paused');
  };

  const handleResumeEngraving = () => {
    setEngravingStatus('running');
  };

  const handleStopEngraving = () => {
    setEngravingStatus('stopped');
    setCurrentEngravingIndex(0);
    setElapsedTime(0);
    setStartTime(null);
    setQrStatuses({});
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (status) {
      case 'engraved': return 'success';
      case 'engraving': return 'warning';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  const completedCount = Object.values(qrStatuses).filter(status => status === 'engraved').length;
  const progressPercentage = numQRsToEngrave > 0 ? (completedCount / numQRsToEngrave) * 100 : 0;

  return (
    <Box className={styles.root}>
      <Typography variant="h4" gutterBottom>
        Laser Engraving System
      </Typography>

      <Grid container spacing={3} className={styles.section}>
        {/* Control Panel */}
        <Grid item xs={12} md={6}>
          <Paper className={styles.paper}>
            <Typography variant="h6" gutterBottom>
              Engraving Controls
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Number of QRs to Engrave"
                  type="number"
                  value={numQRsToEngrave}
                  onChange={(e) => setNumQRsToEngrave(Math.min(Math.max(1, parseInt(e.target.value) || 1), generatedQRs.length))}
                  inputProps={{ min: 1, max: generatedQRs.length }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Time Delay (seconds)"
                  type="number"
                  value={timeDelay}
                  onChange={(e) => setTimeDelay(Math.max(0.5, parseFloat(e.target.value) || 0.5))}
                  inputProps={{ min: 0.5, step: 0.1 }}
                />
              </Grid>
            </Grid>

            {error && <Alert severity="error" sx={{ mt: 2, mb: 2 }}>{error}</Alert>}

            {/* Status Display */}
            <Card sx={{ mt: 2, mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Status: <Chip label={engravingStatus.toUpperCase()} color={
                    engravingStatus === 'running' ? 'success' : 
                    engravingStatus === 'paused' ? 'warning' : 'default'
                  } />
                </Typography>
                <Typography variant="body2">
                  Progress: {completedCount} / {numQRsToEngrave} QR codes engraved
                </Typography>
                <Box sx={{ mt: 1, mb: 1 }}>
                  <Box sx={{ display: 'none' }}>
                    <LinearProgress variant="determinate" value={progressPercentage} />
                  </Box>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <TrainLoader label={`Engraving… ${Math.round(progressPercentage)}%`} />
                  </div>
                </Box>
                <Typography variant="body2">
                  Elapsed Time: {formatTime(elapsedTime)}
                </Typography>
                {engravingStatus === 'running' && currentEngravingIndex < numQRsToEngrave && (
                  <Typography variant="body2">
                    Currently Engraving: {generatedQRs[currentEngravingIndex]?.uid || 'N/A'}
                  </Typography>
                )}
              </CardContent>
            </Card>

            {/* Control Buttons */}
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              {engravingStatus === 'idle' || engravingStatus === 'stopped' ? (
                <Button
                  variant="contained"
                  startIcon={<PlayIcon />}
                  onClick={handleStartEngraving}
                  disabled={generatedQRs.length === 0}
                  color="success"
                >
                  Start Engraving
                </Button>
              ) : engravingStatus === 'running' ? (
                <Button
                  variant="contained"
                  startIcon={<PauseIcon />}
                  onClick={handlePauseEngraving}
                  color="warning"
                >
                  Pause
                </Button>
              ) : (
                <Button
                  variant="contained"
                  startIcon={<PlayIcon />}
                  onClick={handleResumeEngraving}
                  color="success"
                >
                  Resume
                </Button>
              )}
              
              <Button
                variant="outlined"
                startIcon={<StopIcon />}
                onClick={handleStopEngraving}
                disabled={engravingStatus === 'idle'}
                color="error"
              >
                Stop
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<SettingsIcon />}
                disabled={engravingStatus === 'running'}
              >
                Settings
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* QR Codes List */}
        <Grid item xs={12} md={6}>
          <Paper className={styles.paper}>
            <Typography variant="h6" gutterBottom>
              Available QR Codes ({generatedQRs.length})
            </Typography>
            
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              <List dense>
                {generatedQRs.slice(0, numQRsToEngrave).map((qr, index) => (
                  <ListItem key={qr.uid} divider>
                    <ListItemText
                      primary={qr.uid}
                      secondary={`${qr.component} - ${qr.vendor} - ${qr.lot}`}
                    />
                    <Chip
                      label={qrStatuses[qr.uid] || 'ready'}
                      color={getStatusColor(qrStatuses[qr.uid] || 'ready')}
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
            
            {generatedQRs.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                <Typography>No QR codes available</Typography>
                <Typography variant="body2">
                  Please generate QR codes first in the QR Generation section
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Machine Status */}
        <Grid item xs={12}>
          <Paper className={styles.paper}>
            <Typography variant="h6" gutterBottom>
              Machine Status
            </Typography>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Machine ID</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Current Job</TableCell>
                    <TableCell>Power (%)</TableCell>
                    <TableCell>Speed (mm/min)</TableCell>
                    <TableCell>Temperature (°C)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>LASER-001</TableCell>
                    <TableCell>
                      <Chip 
                        label={engravingStatus === 'running' ? 'ACTIVE' : 'IDLE'} 
                        color={engravingStatus === 'running' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {engravingStatus === 'running' && currentEngravingIndex < numQRsToEngrave 
                        ? generatedQRs[currentEngravingIndex]?.uid || 'N/A'
                        : 'None'
                      }
                    </TableCell>
                    <TableCell>80</TableCell>
                    <TableCell>1000</TableCell>
                    <TableCell>25</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Engraving;