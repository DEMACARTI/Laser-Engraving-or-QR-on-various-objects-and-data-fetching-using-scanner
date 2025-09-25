import React, { useState, useEffect } from 'react';
import styles from '../styles/pages/Inventory.module.css';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import { DataGrid, GridColDef, GridRowsProp } from '@mui/x-data-grid';
import { Inventory as InventoryIcon } from '@mui/icons-material';

interface InventoryItem {
  uid: string;
  component: string;
  vendor: string;
  lot: string;
  mfg_date: string;
  warranty_years: number;
  created_at: string;
  status: string;
  location: string;
  status_updated_at: string;
}

const Inventory: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const API_BASE = 'https://laser-engraving-or-qr-on-various-objects-gbbk.onrender.com';

  // Fetch inventory data from database
  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/inventory/items`);

      if (!response.ok) {
        throw new Error('Failed to fetch inventory data');
      }

      const data = await response.json();

      if (data.success && data.items) {
        setItems(data.items);
      } else {
        throw new Error('Invalid items data format');
      }

    } catch (err) {
      console.error('Inventory fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory data');
    } finally {
      setLoading(false);
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'generated': return 'info';
      case 'manufactured': return 'primary';
      case 'engraved': return 'secondary';
      case 'shipped': return 'success';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  // Convert items to DataGrid format with search filter
  const filteredItems = items.filter(item =>
    !searchTerm || 
    item.uid.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.component.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.vendor.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const rows: GridRowsProp = filteredItems.map((item, index) => ({
    id: index + 1,
    uid: item.uid,
    component: item.component,
    vendor: item.vendor,
    lot: item.lot,
    status: item.status || 'Unknown',
    location: item.location || 'Unknown',
    mfgDate: item.mfg_date,
    createdAt: item.created_at,
  }));

  const columns: GridColDef[] = [
    { 
      field: 'uid', 
      headerName: 'UID', 
      width: 200,
      renderCell: (params) => (
        <Typography variant="body2" fontFamily="monospace">
          {params.value}
        </Typography>
      )
    },
    { field: 'component', headerName: 'Component', width: 120 },
    { field: 'vendor', headerName: 'Vendor', width: 100 },
    { field: 'lot', headerName: 'Lot', width: 120 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={getStatusColor(params.value as string) as any}
          size="small"
        />
      ),
    },
    { field: 'location', headerName: 'Location', width: 150 },
    { field: 'mfgDate', headerName: 'Mfg Date', width: 120 },
    { 
      field: 'createdAt', 
      headerName: 'Created', 
      width: 120,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.value ? new Date(params.value).toLocaleDateString() : 'N/A'}
        </Typography>
      )
    },
  ];

  useEffect(() => {
    fetchInventoryData();
  }, []);

  return (
    <Box className={styles.root}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <InventoryIcon />
        Inventory Management
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stats */}
      <Grid container spacing={3} className={styles.section}>
        <Grid item xs={12} sm={6} md={4}>
          <Card className={styles.paper}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Items
              </Typography>
              <Typography variant="h5" component="div">
                {items.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card className={styles.paper}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Filtered Items
              </Typography>
              <Typography variant="h5" component="div">
                {filteredItems.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card className={styles.paper}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Status
              </Typography>
              <Typography variant="h5" component="div">
                {loading ? 'Loading...' : 'Connected'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search */}
      <Paper className={styles.paper} sx={{ mb: 2 }}>
        <TextField
          fullWidth
          label="Search by UID, Component, or Vendor"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          variant="outlined"
          size="small"
          sx={{ maxWidth: 400 }}
        />
      </Paper>

      {/* Data Grid */}
      <Paper className={styles.paper} sx={{ height: 600, width: '100%' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            initialState={{
              pagination: {
                paginationModel: { page: 0, pageSize: 25 },
              },
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            checkboxSelection
            disableRowSelectionOnClick
          />
        )}
      </Paper>
    </Box>
  );
};

export default Inventory;
