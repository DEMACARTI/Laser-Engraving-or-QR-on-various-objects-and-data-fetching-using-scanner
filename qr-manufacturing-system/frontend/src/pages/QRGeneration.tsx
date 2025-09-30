import React, { useState, useEffect } from 'react';
import styles from '../styles/pages/QRGeneration.module.css';
import {
  Box,
  Typography,
  Grid,
  Paper,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import { FormHelperText } from '@mui/material';
import {
  QrCode as QrCodeIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';

interface QRResult {
  uid: string;
  qr_path: string;
}

interface QROptions {
  components: string[];
  vendors: string[];
  lots: string[];
}

const QRGeneration: React.FC = () => {
  const [formData, setFormData] = useState({
    component: '',
    vendor: '',
    lot: '',
    warranty_years: 5,
    count: 1,
    mfg_date: new Date().toISOString().split('T')[0]
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [options, setOptions] = useState<QROptions>({ 
    components: [], 
    vendors: [], 
    lots: [] 
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<QRResult[]>([]);
  const [error, setError] = useState('');

  // Load options on component mount
  useEffect(() => {
    const loadOptions = async () => {
      try {
        // Try to load from backend API
        const response = await fetch('https://laser-engraving-or-qr-on-various-objects-gbbk.onrender.com/api/options');
        if (response.ok) {
          const data = await response.json();
          setOptions(data);
        } else {
          throw new Error('Backend not available');
        }
      } catch (err) {
        console.log('Backend not available, using fallback options');
        // Fallback to mock options if backend is not available
        setOptions({
          components: ["ERC", "LINER", "PAD", "SLEEPER"],
          vendors: ["V010", "V011", "V012"],
          lots: ["L2025-09", "L2025-10", "L2025-11"]
        });
      }
    };
    
    loadOptions();
  }, []);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    // Live-validate the field after first submit attempt
    if (submitAttempted) {
      const msg = validateField(field, value);
      setFormErrors(prev => ({ ...prev, [field]: msg }));
    }
  };

  const validateField = (field: string, value: any): string => {
    switch (field) {
      case 'component':
        return value ? '' : 'Component is required';
      case 'vendor':
        return value ? '' : 'Vendor is required';
      case 'lot':
        return value ? '' : 'Lot number is required';
      case 'warranty_years': {
        const n = Number(value);
        if (!Number.isFinite(n)) return 'Enter a valid number';
        if (n < 1) return 'Must be at least 1 year';
        if (n > 20) return 'Must not exceed 20 years';
        return '';
      }
      case 'count': {
        const n = Number(value);
        if (!Number.isFinite(n)) return 'Enter a valid quantity';
        if (n < 1) return 'Minimum 1';
        if (n > 1000) return 'Maximum 1000';
        return '';
      }
      default:
        return '';
    }
  };

  const validateForm = (): boolean => {
    const fields: Array<[string, any]> = [
      ['component', formData.component],
      ['vendor', formData.vendor],
      ['lot', formData.lot],
      ['warranty_years', formData.warranty_years],
      ['count', formData.count],
      ['mfg_date', formData.mfg_date],
    ];
    const errors: Record<string, string> = {};
    for (const [k, v] of fields) {
      const msg = validateField(k, v);
      if (msg) errors[k] = msg;
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const generateQRCodes = async () => {
    setSubmitAttempted(true);
    if (!validateForm()) {
      setError('Please correct the highlighted fields');
      return;
    }

    setLoading(true);
    setProgress(0);
    setResults([]);
    setError('');

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      // Call the actual backend API for QR generation
      const response = await fetch('https://laser-engraving-or-qr-on-various-objects-gbbk.onrender.com/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          component: formData.component,
          vendor: formData.vendor,
          lot: formData.lot,
          warranty_years: parseInt(formData.warranty_years.toString()),
          count: parseInt(formData.count.toString()),
          mfg_date: formData.mfg_date || null
        }),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      clearInterval(progressInterval);
      setProgress(100);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setResults(data.results);
        } else {
          setError("Failed to generate QR codes. Please check the backend service.");
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err: any) {
      console.error('QR Generation Error:', err);
      
      // Fallback to mock data if backend is not available
      if (err.name === 'AbortError' || err.message.includes('500')) {
        setError("Backend service unavailable. Using mock data for demo.");
        
        // Show mock results for demo purposes
        const mockResults = [];
        for (let i = 1; i <= parseInt(formData.count.toString()); i++) {
          const uid = `${formData.component}-${formData.vendor}-${formData.lot}-${String(i).padStart(5, '0')}`;
          mockResults.push({
            uid: uid,
            qr_path: `../qr_batch_output/${uid}.png`
          });
        }
        setResults(mockResults);
      } else {
        setError("Failed to generate QR codes. Please try again.");
      }
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const resetForm = () => {
    setFormData({ 
      component: "", 
      vendor: "", 
      lot: "", 
      warranty_years: 5, 
      count: 1, 
      mfg_date: new Date().toISOString().split('T')[0]
    });
    setResults([]);
    setError("");
  };

  const downloadQRCode = async (uid: string) => {
    try {
      // Use the local backend API for development, fallback to remote for production
      const apiBase = process.env.NODE_ENV === 'development' ? 'http://localhost:5002' : 'https://laser-engraving-or-qr-on-various-objects-gbbk.onrender.com';
      const response = await fetch(`${apiBase}/api/qr/${uid}`);
      
      if (!response.ok) {
        throw new Error(`Failed to download QR code: ${response.status}`);
      }
      
      // Create blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${uid}.png`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log(`✅ Downloaded QR code for ${uid}`);
    } catch (error) {
      console.error(`❌ Failed to download QR code for ${uid}:`, error);
      setError(`Failed to download QR code for ${uid}. Please try again.`);
    }
  };

  const downloadAll = async () => {
    if (results.length === 0) {
      setError('No QR codes to download');
      return;
    }
    
    try {
      setLoading(true);
      setProgress(0);
      
      const apiBase = process.env.NODE_ENV === 'development' ? 'http://localhost:5002' : 'https://laser-engraving-or-qr-on-various-objects-gbbk.onrender.com';
      const uids = results.map(result => result.uid);
      
      // Try bulk download first (if available)
      try {
        const response = await fetch(`${apiBase}/api/qr_batch_download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uids }),
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `qr_codes_${results.length}_items.zip`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          console.log(`✅ Downloaded ${results.length} QR codes as ZIP`);
          setProgress(100);
          return;
        } else {
          console.warn('Bulk download not available, falling back to individual downloads');
        }
      } catch (bulkError) {
        console.warn('Bulk download failed, falling back to individual downloads:', bulkError);
      }
      
      // Fallback: download individual files
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        try {
          const response = await fetch(`${apiBase}/api/qr/${result.uid}`);
          
          if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${result.uid}.png`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            // Small delay between downloads to avoid overwhelming the browser
            await new Promise(resolve => setTimeout(resolve, 100));
          } else {
            console.warn(`Failed to download ${result.uid}: ${response.status}`);
          }
        } catch (err) {
          console.warn(`Failed to download ${result.uid}:`, err);
        }
        
        // Update progress
        setProgress(((i + 1) / results.length) * 100);
      }
      
      console.log(`✅ Downloaded ${results.length} QR codes individually`);
    } catch (error) {
      console.error('❌ Failed to download all QR codes:', error);
      setError('Failed to download all QR codes. Please try again.');
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  return (
    <Box className={styles.root}>
      <div className={`${styles.container} ${styles.offsetCenter}`}>
      <Typography variant="h4" gutterBottom className={styles.title}>
        QR Code Generation
      </Typography>

  <Grid container spacing={3} className={styles.section}>
        {/* Generation Form */}
        <Grid item xs={12} md={6}>
          <Paper className={styles.paper}>
            <Typography variant="h6" gutterBottom>
              Component Details
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required error={Boolean(formErrors.component)}>
                  <InputLabel id="component-type-label">Component Type</InputLabel>
                  <Select
                    labelId="component-type-label"
                    label="Component Type"
                    value={formData.component}
                    onChange={(e) => handleInputChange('component', e.target.value)}
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 200,
                          zIndex: 9999,
                        },
                      },
                      anchorOrigin: {
                        vertical: 'bottom',
                        horizontal: 'left',
                      },
                      transformOrigin: {
                        vertical: 'top',
                        horizontal: 'left',
                      },
                    }}
                  >
                    {options.components.map(comp => (
                      <MenuItem key={comp} value={comp}>{comp}</MenuItem>
                    ))}
                  </Select>
                  {formErrors.component && (
                    <FormHelperText>{formErrors.component}</FormHelperText>
                  )}
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required error={Boolean(formErrors.vendor)}>
                  <InputLabel id="vendor-label">Vendor</InputLabel>
                  <Select
                    labelId="vendor-label"
                    label="Vendor"
                    value={formData.vendor}
                    onChange={(e) => handleInputChange('vendor', e.target.value)}
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 200,
                          zIndex: 9999,
                        },
                      },
                      anchorOrigin: {
                        vertical: 'bottom',
                        horizontal: 'left',
                      },
                      transformOrigin: {
                        vertical: 'top',
                        horizontal: 'left',
                      },
                    }}
                  >
                    {options.vendors.map(vendor => (
                      <MenuItem key={vendor} value={vendor}>{vendor}</MenuItem>
                    ))}
                  </Select>
                  {formErrors.vendor && (
                    <FormHelperText>{formErrors.vendor}</FormHelperText>
                  )}
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required error={Boolean(formErrors.lot)}>
                  <InputLabel id="lot-label">Lot Number</InputLabel>
                  <Select
                    labelId="lot-label"
                    label="Lot Number"
                    value={formData.lot}
                    onChange={(e) => handleInputChange('lot', e.target.value)}
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 200,
                          zIndex: 9999,
                        },
                      },
                      anchorOrigin: {
                        vertical: 'bottom',
                        horizontal: 'left',
                      },
                      transformOrigin: {
                        vertical: 'top',
                        horizontal: 'left',
                      },
                    }}
                  >
                    {options.lots.map(lot => (
                      <MenuItem key={lot} value={lot}>{lot}</MenuItem>
                    ))}
                  </Select>
                  {formErrors.lot && (
                    <FormHelperText>{formErrors.lot}</FormHelperText>
                  )}
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Warranty Years"
                  type="number"
                  value={formData.warranty_years}
                  onChange={(e) => handleInputChange('warranty_years', parseInt(e.target.value))}
                  inputProps={{ min: 1, max: 20 }}
                  required
                  error={Boolean(formErrors.warranty_years)}
                  helperText={formErrors.warranty_years || '1 - 20 years'}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Quantity"
                  type="number"
                  value={formData.count}
                  onChange={(e) => handleInputChange('count', parseInt(e.target.value))}
                  inputProps={{ min: 1, max: 1000 }}
                  required
                  error={Boolean(formErrors.count)}
                  helperText={formErrors.count || '1 - 1000 items'}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Manufacturing Date"
                  type="date"
                  value={formData.mfg_date}
                  onChange={(e) => handleInputChange('mfg_date', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  required
                  error={Boolean(formErrors.mfg_date)}
                  helperText={formErrors.mfg_date || 'Cannot be in the future'}
                />
              </Grid>
            </Grid>

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<QrCodeIcon />}
                onClick={generateQRCodes}
                disabled={loading}
                sx={{ flex: 1 }}
              >
                {loading ? 'Generating...' : `Generate ${formData.count} QR Code${formData.count > 1 ? 's' : ''}`}
              </Button>
              
              <Button
                variant="outlined"
                size="large"
                onClick={resetForm}
                disabled={loading}
              >
                Reset
              </Button>
            </Box>
              
            {loading && (
              <Box sx={{ mt: 2 }}>
                {/* Keep LinearProgress hidden for accessibility value semantics */}
                <Box sx={{ display: 'none' }}>
                  <LinearProgress variant="determinate" value={progress} />
                </Box>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {/* Train Loader animation */}
                  {/* Prefer normal import, but here we inline-require to avoid top-level import reordering */}
                  {require('../components/Loaders/TrainLoader').default({ label: `Generating… ${progress}%` })}
                </div>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Results */}
        <Grid item xs={12} md={6}>
          <Paper className={styles.paper}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Generated QR Codes ({results.length})
              </Typography>
              {results.length > 0 && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={downloadAll}
                >
                  Download All
                </Button>
              )}
            </Box>
            
            {results.length > 0 ? (
              <List>
                {results.map((result, index) => (
                  <ListItem key={result.uid}>
                    <ListItemText
                      primary={result.uid}
                      secondary={`QR Code ${index + 1} - Generated: ${new Date().toLocaleString()}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => downloadQRCode(result.uid)}
                        size="small"
                      >
                        <DownloadIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                <QrCodeIcon sx={{ fontSize: 48, mb: 2 }} />
                <Typography>No QR codes generated yet</Typography>
                <Typography variant="body2">
                  Fill in the form and click Generate to create QR codes
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Old batch display for backward compatibility */}
      {false && ( // Hidden for now, keeping structure
        <Grid container spacing={3}>
          {results.length > 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Generated QR Codes
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>UID</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {results.map((result) => (
                        <TableRow key={result.uid}>
                          <TableCell>{result.uid}</TableCell>
                          <TableCell>
                            <Chip label="Generated" color="success" size="small" />
                          </TableCell>
                          <TableCell>{new Date().toLocaleString()}</TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => downloadQRCode(result.uid)}>
                              <DownloadIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}
      </div>
    </Box>
  );
};

export default QRGeneration;
