import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Fab,
  Chip,
} from '@mui/material';
import { DataGrid, GridColDef, GridRowsProp } from '@mui/x-data-grid';
import { Add as AddIcon, PlayArrow as StartIcon } from '@mui/icons-material';

interface EngravingJob {
  id: string;
  qrCode: string;
  material: string;
  laserSettings: string;
  status: string;
  priority: string;
  createdAt: string;
  completedAt?: string;
  estimatedTime: number;
}

const Engraving: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [newJob, setNewJob] = useState({
    qrCode: '',
    material: '',
    laserSettings: 'default',
    priority: 'medium'
  });

  // Mock data
  const rows: GridRowsProp = [
    {
      id: 1,
      qrCode: 'PAD-V0100-L2025-09-00045',
      material: 'Aluminum',
      laserSettings: 'Metal-High',
      status: 'completed',
      priority: 'high',
      createdAt: '2025-01-17T08:00:00Z',
      completedAt: '2025-01-17T08:15:00Z',
      estimatedTime: 15
    },
    {
      id: 2,
      qrCode: 'PAD-V0100-L2025-09-00046',
      material: 'Plastic',
      laserSettings: 'Plastic-Medium',
      status: 'in_progress',
      priority: 'medium',
      createdAt: '2025-01-17T09:00:00Z',
      estimatedTime: 8
    },
    {
      id: 3,
      qrCode: 'PAD-V0100-L2025-09-00047',
      material: 'Wood',
      laserSettings: 'Wood-Low',
      status: 'queued',
      priority: 'low',
      createdAt: '2025-01-17T10:00:00Z',
      estimatedTime: 12
    }
  ];

  const columns: GridColDef[] = [
    { field: 'qrCode', headerName: 'QR Code', width: 200 },
    { field: 'material', headerName: 'Material', width: 120 },
    { field: 'laserSettings', headerName: 'Laser Settings', width: 150 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => {
        const getStatusColor = (status: string) => {
          switch (status) {
            case 'completed': return 'success';
            case 'in_progress': return 'warning';
            case 'queued': return 'info';
            case 'failed': return 'error';
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
    {
      field: 'priority',
      headerName: 'Priority',
      width: 100,
      renderCell: (params) => {
        const getPriorityColor = (priority: string) => {
          switch (priority) {
            case 'high': return 'error';
            case 'medium': return 'warning';
            case 'low': return 'success';
            default: return 'default';
          }
        };
        
        return (
          <Chip
            label={params.value}
            color={getPriorityColor(params.value as string) as any}
            size="small"
          />
        );
      }
    },
    { field: 'estimatedTime', headerName: 'Est. Time (min)', width: 130 },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 150,
      renderCell: (params) => new Date(params.value as string).toLocaleString()
    }
  ];

  const handleClose = () => {
    setOpen(false);
    setNewJob({ qrCode: '', material: '', laserSettings: 'default', priority: 'medium' });
  };

  const handleSave = () => {
    // TODO: Implement save logic
    console.log('Creating new engraving job:', newJob);
    handleClose();
  };

  const handleStartJob = (jobId: string) => {
    // TODO: Implement start job logic
    console.log('Starting job:', jobId);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Laser Engraving Jobs
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<StartIcon />}
            onClick={() => handleStartJob('next')}
          >
            Start Next Job
          </Button>
        </Box>

        <DataGrid
          rows={rows}
          columns={columns}
          pageSizeOptions={[10, 25, 50]}
          checkboxSelection
          disableRowSelectionOnClick
          sx={{ height: 600 }}
        />
      </Paper>

      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => setOpen(true)}
      >
        <AddIcon />
      </Fab>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Engraving Job</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="QR Code"
            value={newJob.qrCode}
            onChange={(e) => setNewJob({ ...newJob, qrCode: e.target.value })}
            margin="normal"
          />
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Material</InputLabel>
            <Select
              value={newJob.material}
              onChange={(e) => setNewJob({ ...newJob, material: e.target.value })}
              label="Material"
            >
              <MenuItem value="Aluminum">Aluminum</MenuItem>
              <MenuItem value="Steel">Steel</MenuItem>
              <MenuItem value="Plastic">Plastic</MenuItem>
              <MenuItem value="Wood">Wood</MenuItem>
              <MenuItem value="Acrylic">Acrylic</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Laser Settings</InputLabel>
            <Select
              value={newJob.laserSettings}
              onChange={(e) => setNewJob({ ...newJob, laserSettings: e.target.value })}
              label="Laser Settings"
            >
              <MenuItem value="Metal-High">Metal - High Power</MenuItem>
              <MenuItem value="Metal-Medium">Metal - Medium Power</MenuItem>
              <MenuItem value="Plastic-Medium">Plastic - Medium Power</MenuItem>
              <MenuItem value="Wood-Low">Wood - Low Power</MenuItem>
              <MenuItem value="Acrylic-Medium">Acrylic - Medium Power</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Priority</InputLabel>
            <Select
              value={newJob.priority}
              onChange={(e) => setNewJob({ ...newJob, priority: e.target.value })}
              label="Priority"
            >
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            Create Job
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Engraving;