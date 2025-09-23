import React from 'react';
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
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        width: 240,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 240,
          boxSizing: 'border-box',
          backgroundColor: '#1e293b',
          color: '#fff',
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
                  '&.Mui-selected': {
                    backgroundColor: '#334155',
                    '&:hover': {
                      backgroundColor: '#475569',
                    },
                  },
                  '&:hover': {
                    backgroundColor: '#334155',
                  },
                }}
              >
                <ListItemIcon sx={{ color: '#fff' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider sx={{ backgroundColor: '#475569' }} />
      </Box>
    </Drawer>
  );
};

export default Sidebar;