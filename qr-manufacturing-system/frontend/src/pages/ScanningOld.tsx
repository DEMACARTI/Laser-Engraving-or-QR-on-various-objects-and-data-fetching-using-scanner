import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Chip,
} from '@mui/material';
import { DataGrid, GridColDef, GridRowsProp } from '@mui/x-data-grid';
import {
  CameraAlt as CameraIcon,
  Upload as UploadIcon,
  CheckCircle as ValidIcon,
  Error as InvalidIcon,
} from '@mui/icons-material';

interface ScanResult {
  id: string;
  qrCode: string;
  isValid: boolean;
  scannedAt: string;
  location?: string;
  status: string;
}

const Scanning: React.FC = () => {
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock scan history
  const scanHistory: GridRowsProp = [
    {
      id: 1,
      qrCode: 'PAD-V0100-L2025-09-00001',
      isValid: true,
      scannedAt: '2025-01-17T10:30:00Z',
      location: 'Warehouse A1',
      status: 'active'
    },
    {
      id: 2,
      qrCode: 'PAD-V0100-L2025-09-00002',
      isValid: true,
      scannedAt: '2025-01-17T10:25:00Z',
      location: 'Production Line 1',
      status: 'in_use'
    },
    {
      id: 3,
      qrCode: 'INVALID-CODE-123',
      isValid: false,
      scannedAt: '2025-01-17T10:20:00Z',
      location: 'Unknown',
      status: 'invalid'
    }
  ];

  const columns: GridColDef[] = [
    { field: 'qrCode', headerName: 'QR Code', width: 200 },
    {
      field: 'isValid',
      headerName: 'Valid',
      width: 100,
      renderCell: (params) => (
        params.value ? 
          <ValidIcon color="success" /> : 
          <InvalidIcon color="error" />
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => {
        const getStatusColor = (status: string) => {
          switch (status) {
            case 'active': return 'success';
            case 'in_use': return 'warning';
            case 'invalid': return 'error';
            default: return 'default';
          }
        };
        
        return (
          <Chip
            label={params.value}
            color={getStatusColor(params.value as string) as any}
            size="small"
          />
        );
      }
    },
    { field: 'location', headerName: 'Location', width: 150 },
    {
      field: 'scannedAt',
      headerName: 'Scanned At',
      width: 180,
      renderCell: (params) => new Date(params.value as string).toLocaleString()
    }
  ];

  const handleCameraScan = () => {
    setScanning(true);
    // Simulate camera scanning
    setTimeout(() => {
      const mockScan = 'PAD-V0100-L2025-09-00048';
      setLastScan(mockScan);
      setScanning(false);
    }, 2000);
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Simulate QR code detection from image
      const mockScan = 'PAD-V0100-L2025-09-00049';
      setLastScan(mockScan);
    }
  };

  const handleManualEntry = () => {
    if (manualCode.trim()) {
      setLastScan(manualCode.trim());
      setManualCode('');
      setDialogOpen(false);
    }
  };

  const validateQRCode = (code: string) => {
    // Mock validation logic
    return code.startsWith('PAD-V') && code.length >= 20;
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        QR Code Scanning
      </Typography>

      <Grid container spacing={3}>
        {/* Scanning Interface */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Scan QR Code
            </Typography>
            
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Box
                sx={{
                  width: '100%',
                  height: 300,
                  border: '2px dashed #ccc',
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                  backgroundColor: scanning ? '#f5f5f5' : 'transparent'
                }}
              >
                {scanning ? (
                  <Typography>Scanning...</Typography>
                ) : (
                  <Typography color="textSecondary">
                    Camera view will appear here
                  </Typography>
                )}
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<CameraIcon />}
                    onClick={handleCameraScan}
                    disabled={scanning}
                  >
                    Camera
                  </Button>
                </Grid>
                <Grid item xs={4}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<UploadIcon />}
                    onClick={handleFileUpload}
                  >
                    Upload
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleFileSelect}
                  />
                </Grid>
                <Grid item xs={4}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => setDialogOpen(true)}
                  >
                    Manual
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>

        {/* Scan Results */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Last Scan Result
            </Typography>
            
            {lastScan ? (
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    {validateQRCode(lastScan) ? (
                      <ValidIcon color="success" sx={{ mr: 1 }} />
                    ) : (
                      <InvalidIcon color="error" sx={{ mr: 1 }} />
                    )}
                    <Typography variant="h6">
                      {validateQRCode(lastScan) ? 'Valid QR Code' : 'Invalid QR Code'}
                    </Typography>
                  </Box>
                  <Typography variant="body1" gutterBottom>
                    <strong>Code:</strong> {lastScan}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Scanned at: {new Date().toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <Alert severity="info">
                No QR code scanned yet. Use one of the scanning methods above.
              </Alert>
            )}

            <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
              Quick Stats
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main">
                      {scanHistory.filter(item => item.isValid).length}
                    </Typography>
                    <Typography variant="body2">
                      Valid Scans
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="error.main">
                      {scanHistory.filter(item => !item.isValid).length}
                    </Typography>
                    <Typography variant="body2">
                      Invalid Scans
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Scan History */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Scan History
            </Typography>
            
            <DataGrid
              rows={scanHistory}
              columns={columns}
              pageSizeOptions={[10, 25, 50]}
              disableRowSelectionOnClick
              sx={{ height: 400 }}
            />
          </Paper>
        </Grid>
      </Grid>

      {/* Manual Entry Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>Manual QR Code Entry</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="QR Code"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            margin="normal"
            placeholder="Enter QR code manually"
          />
        </DialogContent>
        <Box sx={{ p: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleManualEntry} variant="contained">
            Submit
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
};

export default Scanning;