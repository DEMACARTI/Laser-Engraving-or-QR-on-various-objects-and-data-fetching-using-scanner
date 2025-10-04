import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Button,

  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,

  Fab,
  Snackbar,
  Paper,
  useTheme,
  useMediaQuery,
  LinearProgress
} from '@mui/material';
import {
  Warning as WarningIcon,

  Info as InfoIcon,
  Build as MaintenanceIcon,
  Security as SafetyIcon,
  Inventory as InventoryIcon,
  Assessment as ComplianceIcon,
  TrendingUp as PerformanceIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,

  CheckCircle as CheckCircleIcon,
  Psychology as IntelligenceIcon
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import styles from '../styles/pages/AIAlerts.module.css';

interface AIAlert {
  id?: number;
  uid: string;
  alert_type: string;
  priority: number;
  priority_name: string;
  title: string;
  description: string;
  component: string;
  location: string;
  predicted_date?: string;
  recommendations: string[];
  metadata: any;
  created_at: string;
  acknowledged?: boolean;
  resolved?: boolean;
}

interface AlertSummary {
  total_alerts: number;
  unacknowledged: number;
  unresolved: number;
  critical_alerts: number;
  by_type: Array<{ alert_type: string; count: number }>;
  by_priority: Array<{ priority: number; count: number }>;
}

const AIAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<AIAlert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [highlightedAlertId, setHighlightedAlertId] = useState<number | null>(null);

  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down('sm'));
  const gridSpacing = isSm ? 2 : 3;
  const location = useLocation();
  const highlightedRef = useRef<HTMLDivElement>(null);

  const API_BASE = 'http://localhost:5002';

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 5: return 'error'; // Emergency
      case 4: return 'error'; // Critical
      case 3: return 'warning'; // High
      case 2: return 'info'; // Medium
      case 1: return 'default'; // Low
      default: return 'default';
    }
  };

  const getAlertTypeIcon = (alertType: string) => {
    switch (alertType) {
      case 'expiry_warning':
      case 'expiry_critical':
        return <WarningIcon />;
      case 'maintenance_due':
        return <MaintenanceIcon />;
      case 'safety_critical':
        return <SafetyIcon />;
      case 'inventory_low':
        return <InventoryIcon />;
      case 'compliance_due':
        return <ComplianceIcon />;
      case 'performance_anomaly':
        return <PerformanceIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const formatAlertType = (alertType: string) => {
    return alertType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/ai-alerts/list`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }

      const data = await response.json();
      if (data.success) {
        setAlerts(data.alerts || []);
      } else {
        throw new Error(data.error || 'Failed to fetch alerts');
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await fetch(`${API_BASE}/ai-alerts/summary`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch summary');
      }

      const data = await response.json();
      if (data.success) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  };

  const generateAlerts = async () => {
    try {
      setGenerating(true);
      const response = await fetch(`${API_BASE}/ai-alerts/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      const data = await response.json();
      
      if (data.success) {
        setSnackbarMessage(`Generated ${data.count} new alerts`);
        setSnackbarOpen(true);
        await fetchAlerts();
        await fetchSummary();
      } else {
        throw new Error(data.error || 'Failed to generate alerts');
      }
    } catch (err) {
      console.error('Error generating alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate alerts');
    } finally {
      setGenerating(false);
    }
  };

  const acknowledgeAlert = async (alertId: number) => {
    try {
      const response = await fetch(`${API_BASE}/ai-alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          acknowledged_by: 'Web User'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSnackbarMessage('Alert acknowledged successfully');
        setSnackbarOpen(true);
        await fetchAlerts();
        await fetchSummary();
      } else {
        throw new Error(data.error || 'Failed to acknowledge alert');
      }
    } catch (err) {
      console.error('Error acknowledging alert:', err);
      setError(err instanceof Error ? err.message : 'Failed to acknowledge alert');
    }
  };

  const resolveAlert = async (alertId: number) => {
    try {
      const response = await fetch(`${API_BASE}/ai-alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setSnackbarMessage('Alert resolved successfully');
        setSnackbarOpen(true);
        await fetchAlerts();
        await fetchSummary();
      } else {
        throw new Error(data.error || 'Failed to resolve alert');
      }
    } catch (err) {
      console.error('Error resolving alert:', err);
      setError(err instanceof Error ? err.message : 'Failed to resolve alert');
    }
  };

  useEffect(() => {
    fetchAlerts();
    fetchSummary();
    
    // Handle highlight from navigation state
    if (location.state?.highlightAlert) {
      setHighlightedAlertId(location.state.highlightAlert);
      // Clear the state after setting highlight
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  
  // Scroll to highlighted alert after alerts are loaded
  useEffect(() => {
    if (highlightedAlertId && alerts.length > 0 && highlightedRef.current) {
      setTimeout(() => {
        highlightedRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        // Remove highlight after 3 seconds
        setTimeout(() => setHighlightedAlertId(null), 3000);
      }, 500);
    }
  }, [highlightedAlertId, alerts]);



  if (loading) {
    return (
      <Box className={styles.root} display="flex" alignItems="center" justifyContent="center" minHeight={320}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className={styles.root}>
      <div className={`${styles.container} ${styles.offsetCenter}`}>
        <Typography variant="h4" gutterBottom className={styles.title} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IntelligenceIcon />
          AI Alert Intelligence
        </Typography>

        {error && (
          <Box className={styles.section}>
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          </Box>
        )}

        {/* Key Metrics */}
        <Grid container spacing={gridSpacing} className={styles.section}>
          <Grid item xs={12} sm={6} md={3}>
            <Card className={styles.card}>
              <CardContent className={styles.cardContent}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Total Alerts
                </Typography>
                <Typography variant="h4" color="primary">
                  {summary?.total_alerts || 0}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  System-wide alerts
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card className={styles.card}>
              <CardContent className={styles.cardContent}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Critical Alerts
                </Typography>
                <Typography variant="h4" color="error.main">
                  {summary?.critical_alerts || 0}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Require immediate attention
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card className={styles.card}>
              <CardContent className={styles.cardContent}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Response Rate
                </Typography>
                <Typography variant="h4" color="success.main">
                  {summary && summary.total_alerts > 0 ? Math.round(((summary.total_alerts - (summary.unacknowledged || 0)) / summary.total_alerts) * 100) : 0}%
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={summary && summary.total_alerts > 0 ? ((summary.total_alerts - (summary.unacknowledged || 0)) / summary.total_alerts) * 100 : 0}
                    color="success"
                    sx={{ height: 8, borderRadius: 5 }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card className={styles.card}>
              <CardContent className={styles.cardContent}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  AI Status
                </Typography>
                <Typography variant="h4" color="success.main">
                  Active
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  ML models operational
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Alerts List */}
        <Paper className={styles.paper}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">AI Alert Dashboard</Typography>
            <Button
                variant="contained"
                startIcon={generating ? <CircularProgress size={20} /> : <RefreshIcon />}
                onClick={generateAlerts}
                disabled={generating}
              >
                {generating ? 'Generating...' : 'Generate New Alerts'}
              </Button>
            </Box>

            {alerts.length === 0 ? (
              <Typography variant="body1" color="textSecondary" textAlign="center" py={4}>
                No alerts found. Click "Generate New Alerts" to create AI-powered alerts.
              </Typography>
            ) : (
              alerts.map((alert, index) => (
                <Accordion 
                  key={alert.id || index} 
                  className={styles.alertAccordion}
                  ref={alert.id === highlightedAlertId ? highlightedRef : null}
                  sx={{
                    backgroundColor: alert.id === highlightedAlertId ? 'action.selected' : 'inherit',
                    transition: 'background-color 0.3s ease',
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" alignItems="center" width="100%" gap={2}>
                      <Box className={styles.alertIcon}>
                        {getAlertTypeIcon(alert.alert_type)}
                      </Box>
                      <Box flexGrow={1}>
                        <Typography variant="h6" className={styles.alertTitle}>
                          {alert.title}
                        </Typography>
                        <Box display="flex" gap={1} mt={1}>
                          <Chip
                            label={alert.priority_name}
                            color={getPriorityColor(alert.priority) as any}
                            size="small"
                          />
                          <Chip
                            label={formatAlertType(alert.alert_type)}
                            variant="outlined"
                            size="small"
                          />
                          <Chip
                            label={alert.component}
                            variant="outlined"
                            size="small"
                          />
                        </Box>
                      </Box>
                      {alert.acknowledged && (
                        <CheckCircleIcon color="success" />
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={8}>
                        <Typography variant="body1" paragraph>
                          {alert.description}
                        </Typography>
                        
                        <Typography variant="h6" gutterBottom>
                          Recommendations:
                        </Typography>
                        <List dense>
                          {alert.recommendations.map((rec, idx) => (
                            <ListItem key={idx}>
                              <ListItemIcon>
                                <InfoIcon color="primary" />
                              </ListItemIcon>
                              <ListItemText primary={rec} />
                            </ListItem>
                          ))}
                        </List>
                      </Grid>
                      
                      <Grid item xs={12} md={4}>
                        <Typography variant="body2" color="textSecondary">
                          <strong>UID:</strong> {alert.uid}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          <strong>Location:</strong> {alert.location}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          <strong>Created:</strong> {new Date(alert.created_at).toLocaleString()}
                        </Typography>
                        {alert.predicted_date && (
                          <Typography variant="body2" color="textSecondary">
                            <strong>Predicted Date:</strong> {new Date(alert.predicted_date).toLocaleString()}
                          </Typography>
                        )}
                        
                        <Box mt={2} display="flex" gap={1} flexDirection="column">
                          {!alert.acknowledged && alert.id && (
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => acknowledgeAlert(alert.id!)}
                            >
                              Acknowledge
                            </Button>
                          )}
                          {!alert.resolved && alert.id && (
                            <Button
                              variant="contained"
                              size="small"
                              color="success"
                              onClick={() => resolveAlert(alert.id!)}
                            >
                              Mark as Resolved
                            </Button>
                          )}
                        </Box>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              ))
            )}
        </Paper>

        {/* Floating Action Button for Refresh */}
        <Fab
          color="primary"
          aria-label="refresh"
          className={styles.fab}
          onClick={() => {
            fetchAlerts();
            fetchSummary();
          }}
        >
          <RefreshIcon />
        </Fab>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarOpen(false)}
          message={snackbarMessage}
        />
      </div>
    </Box>
  );
};

export default AIAlerts;