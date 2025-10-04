import React from 'react';
import styles from '../../styles/components/Sidebar.module.css';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Toolbar,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  QrCode as QrCodeIcon,
  Inventory as InventoryIcon,
  AutoFixHigh as PrecisionIcon,
  QrCodeScanner as ScannerIcon,
  Analytics as AnalyticsIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'QR Generation', icon: <QrCodeIcon />, path: '/qr-generation' },
  { text: 'Inventory', icon: <InventoryIcon />, path: '/inventory' },
  { text: 'Engraving', icon: <PrecisionIcon />, path: '/engraving' },
  { text: 'Scanning', icon: <ScannerIcon />, path: '/scanning' },
  { text: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics' },
  { text: 'AI Alerts', icon: <NotificationsIcon />, path: '/ai-alerts' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

const Sidebar: React.FC<SidebarProps> = ({ open }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleItemClick = (path: string) => {
    navigate(path);
  };

  return (
    <Drawer
      className={styles.root}
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        width: 240,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 240,
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          color: 'rgba(17,24,39,0.9)',
          borderRight: '1px solid rgba(16,24,40,0.08)',
        },
      }}
    >
      <Toolbar />
      <Box sx={{ overflow: 'auto' }}>
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => handleItemClick(item.path)}
                sx={{
                  borderRadius: 1,
                  alignItems: 'center',
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(37, 99, 235, 0.06)',
                    color: 'primary.main',
                    '& .MuiListItemIcon-root': { color: 'primary.main' },
                    '&:before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: 8,
                      bottom: 8,
                      width: '3px',
                      borderRadius: '0 3px 3px 0',
                      backgroundColor: 'primary.main',
                    },
                    '&:hover': { backgroundColor: 'rgba(37, 99, 235, 0.1)' },
                  },
                  '&:hover': { backgroundColor: 'rgba(16,24,40,0.04)' },
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primaryTypographyProps={{ sx: { fontWeight: 500, letterSpacing: '0.15px' } }} primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider sx={{ borderColor: 'rgba(16,24,40,0.08)' }} />
      </Box>
    </Drawer>
  );
};

export default Sidebar;