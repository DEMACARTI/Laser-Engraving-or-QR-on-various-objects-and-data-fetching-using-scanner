import React, { useEffect } from 'react';
import {
  Popover,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  Box,
  Chip,
  Badge,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Warning as WarningIcon,
  Info as InfoIcon,
  Build as MaintenanceIcon,
  Security as SafetyIcon,
  Inventory as InventoryIcon,
  Assessment as ComplianceIcon,
  TrendingUp as PerformanceIcon,
  ArrowForward as ArrowForwardIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAlerts, AIAlert } from '../../hooks/useAlerts';

interface NotificationDropdownProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  anchorEl,
  open,
  onClose
}) => {
  const { alerts, loading, error, unacknowledgedCount, refreshAlerts } = useAlerts();
  const navigate = useNavigate();

  const getAlertTypeIcon = (alertType: string) => {
    switch (alertType) {
      case 'expiry_warning':
      case 'expiry_critical':
        return <WarningIcon color="warning" fontSize="small" />;
      case 'maintenance_due':
        return <MaintenanceIcon color="info" fontSize="small" />;
      case 'safety_critical':
        return <SafetyIcon color="error" fontSize="small" />;
      case 'inventory_low':
        return <InventoryIcon color="warning" fontSize="small" />;
      case 'compliance_due':
        return <ComplianceIcon color="info" fontSize="small" />;
      case 'performance_anomaly':
        return <PerformanceIcon color="secondary" fontSize="small" />;
      default:
        return <InfoIcon color="info" fontSize="small" />;
    }
  };

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

  // Refresh alerts when dropdown opens
  useEffect(() => {
    if (open) {
      refreshAlerts();
    }
  }, [open, refreshAlerts]);

  // Get the 5 most recent alerts
  const recentAlerts = alerts
    .sort((a: AIAlert, b: AIAlert) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 5);

  const handleViewAllClick = () => {
    onClose();
    navigate('/ai-alerts');
  };

  const handleAlertClick = (alertId?: number) => {
    onClose();
    navigate('/ai-alerts', { state: { highlightAlert: alertId } });
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const alertDate = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - alertDate.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      hideBackdrop={true}
      disableScrollLock={true}
      PaperProps={{
        sx: {
          width: 400,
          maxHeight: 500,
          mt: 1,
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(16, 24, 40, 0.15)',
        }
      }}
    >
      <Card elevation={0}>
        <CardContent sx={{ p: 0 }}>
          {/* Header */}
          <Box sx={{ p: 2, pb: 1 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="h6" fontWeight={600}>
                Notifications
              </Typography>
              <Badge badgeContent={unacknowledgedCount} color="error">
                <NotificationsIcon color="action" />
              </Badge>
            </Box>
          </Box>

          <Divider />

          {/* Content */}
          <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" py={3}>
                <CircularProgress size={24} />
                <Typography variant="body2" sx={{ ml: 1 }}>
                  Loading alerts...
                </Typography>
              </Box>
            ) : error ? (
              <Box p={2}>
                <Alert severity="error" sx={{ '& .MuiAlert-message': { fontSize: '0.875rem' } }}>
                  {error}
                </Alert>
              </Box>
            ) : recentAlerts.length === 0 ? (
              <Box p={3} textAlign="center">
                <NotificationsIcon color="disabled" sx={{ fontSize: 48, mb: 1 }} />
                <Typography variant="body2" color="textSecondary">
                  No alerts at this time
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Your system is running smoothly
                </Typography>
              </Box>
            ) : (
              <List sx={{ py: 0 }}>
                {recentAlerts.map((alert, index) => (
                  <React.Fragment key={alert.id || index}>
                    <ListItem
                      button
                      onClick={() => handleAlertClick(alert.id)}
                      sx={{ 
                        py: 1.5,
                        '&:hover': { backgroundColor: 'action.hover' }
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {getAlertTypeIcon(alert.alert_type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" fontWeight={500} noWrap>
                              {alert.title}
                            </Typography>
                            <Chip
                              label={alert.priority_name}
                              color={getPriorityColor(alert.priority) as any}
                              size="small"
                              sx={{ fontSize: '0.65rem', height: 16 }}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" color="textSecondary" display="block">
                              {alert.component} • {alert.location}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {formatTimeAgo(alert.created_at)}
                            </Typography>
                          </Box>
                        }
                      />
                      {!alert.acknowledged && (
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: 'error.main',
                            ml: 1
                          }}
                        />
                      )}
                    </ListItem>
                    {index < recentAlerts.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>

          {/* Footer */}
          <Divider />
          <Box p={2}>
            <Button
              fullWidth
              endIcon={<ArrowForwardIcon />}
              onClick={handleViewAllClick}
              variant="outlined"
              size="small"
            >
              View All Alerts
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Popover>
  );
};

export default NotificationDropdown;