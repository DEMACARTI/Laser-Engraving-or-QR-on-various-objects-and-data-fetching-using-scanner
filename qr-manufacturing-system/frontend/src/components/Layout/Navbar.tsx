import React, { useState } from 'react';
import styles from '../../styles/components/Navbar.module.css';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Badge,
  Box,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  AccountCircle,
} from '@mui/icons-material';
import NotificationDropdown from './NotificationDropdown';
import { useAlerts } from '../../hooks/useAlerts';

interface NavbarProps {
  onMenuClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const [notificationAnchorEl, setNotificationAnchorEl] = useState<HTMLElement | null>(null);
  const { badgeCount, criticalCount } = useAlerts();
  
  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchorEl(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setNotificationAnchorEl(null);
  };

  const isNotificationOpen = Boolean(notificationAnchorEl);

  return (
    <div className={styles.root}>
      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: '#ffffff',
          color: 'text.primary',
          boxShadow: '0 1px 0 rgba(16,24,40,0.08)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={onMenuClick}
            edge="start"
            sx={{ 
              mr: 2, 
              transition: 'filter 150ms ease, color 150ms ease',
              '&:hover, &:focus-visible': { 
                color: 'primary.main', 
                filter: 'drop-shadow(0 0 6px rgba(37,99,235,0.25))' 
              },
            }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography 
            variant="h6" 
            noWrap 
            component="div" 
            sx={{ flexGrow: 1, letterSpacing: '0.2px', fontWeight: 600 }}
          >
            QR Manufacturing System
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              size="large"
              aria-label="show new notifications"
              color="inherit"
              onClick={handleNotificationClick}
              sx={{ 
                mr: 1,
                transition: 'filter 150ms ease, color 150ms ease',
                '&:hover, &:focus-visible': { 
                  color: 'primary.main',
                  filter: 'drop-shadow(0 0 6px rgba(37,99,235,0.25))' 
                },
              }}
            >
              <Badge 
                badgeContent={badgeCount} 
                color={criticalCount > 0 ? "error" : "warning"}
                variant={badgeCount > 0 ? "standard" : "dot"}
              >
                <NotificationsIcon />
              </Badge>
            </IconButton>
            
            <IconButton
              size="large"
              edge="end"
              aria-label="account of current user"
              color="inherit"
              sx={{ 
                transition: 'filter 150ms ease, color 150ms ease',
                '&:hover, &:focus-visible': { 
                  color: 'primary.main',
                  filter: 'drop-shadow(0 0 6px rgba(37,99,235,0.25))' 
                },
              }}
            >
              <AccountCircle />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      
      {/* Notification Dropdown */}
      <NotificationDropdown
        anchorEl={notificationAnchorEl}
        open={isNotificationOpen}
        onClose={handleNotificationClose}
      />
    </div>
  );
};

export default Navbar;