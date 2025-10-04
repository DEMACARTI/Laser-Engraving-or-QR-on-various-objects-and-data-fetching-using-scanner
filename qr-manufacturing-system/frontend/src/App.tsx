import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import { SnackbarProvider } from 'notistack';

// Components
import Navbar from './components/Layout/Navbar';
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './pages/Dashboard';
import QRGeneration from './pages/QRGeneration';
import Inventory from './pages/Inventory';
import Engraving from './pages/Engraving';
import Scanning from './pages/Scanning';
import Analytics from './pages/Analytics';
import AIAlerts from './pages/AIAlerts';
import Settings from './pages/Settings';
import ClickSpark from './components/Effects/ClickSpark';

// Create theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0b5fff', light: '#4c82ff', dark: '#0646bf' },
    secondary: { main: '#6e6e73' },
    background: { default: '#f7f9fc', paper: '#ffffff' },
  },
  typography: {
    fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
    h1: { fontWeight: 600, letterSpacing: '0.2px', fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
    h2: { fontWeight: 600, letterSpacing: '0.2px', fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
    h3: { fontWeight: 600, letterSpacing: '0.2px', fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
    h4: { fontWeight: 500, letterSpacing: '0.15px', fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
    h5: { fontWeight: 500, letterSpacing: '0.15px', fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
    h6: { fontWeight: 500, letterSpacing: '0.15px' },
    subtitle1: { fontWeight: 500, letterSpacing: '0.15px' },
    subtitle2: { fontWeight: 500, letterSpacing: '0.15px' },
    body1: { lineHeight: 1.65, letterSpacing: '0.1px' },
    body2: { lineHeight: 1.65, letterSpacing: '0.1px' },
    caption: { letterSpacing: '0.2px' },
    overline: { letterSpacing: '0.3px' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
        body: {
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility',
        },
      },
    },
    MuiPaper: { 
      styleOverrides: { 
        root: { 
          borderRadius: 14,
          boxShadow: '0 1px 4px rgba(16,24,40,0.05), 0 1px 1px rgba(16,24,40,0.03)',
          border: '1px solid rgba(16,24,40,0.06)',
        } 
      } 
    },
    MuiCard: { 
      styleOverrides: { 
        root: { 
          borderRadius: 14,
          boxShadow: '0 1px 4px rgba(16,24,40,0.05), 0 1px 1px rgba(16,24,40,0.03)',
          border: '1px solid rgba(16,24,40,0.06)',
        } 
      } 
    },
    MuiButton: { styleOverrides: { root: { borderRadius: 10, textTransform: 'none', fontWeight: 500 } } },
    MuiContainer: { styleOverrides: { root: { paddingLeft: 24, paddingRight: 24 } } },
  },
});

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider 
          maxSnack={3}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <Router>
            <Box sx={{ display: 'flex' }}>
              <Navbar onMenuClick={handleSidebarToggle} />
              <Sidebar open={sidebarOpen} onToggle={handleSidebarToggle} />
              
              <Box
                component="main"
                sx={{
                  flexGrow: 1,
                  bgcolor: 'background.default',
                  p: { xs: 2, sm: 3, md: 4 },
                  marginTop: '64px', // Height of AppBar
                  marginLeft: sidebarOpen ? '240px' : '0px', // Width of Sidebar
                  '--drawer-width': sidebarOpen ? '240px' : '0px', // expose for page-level centering adjustments
                  transition: theme.transitions.create(['margin'], {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.leavingScreen,
                  }),
                  minHeight: 'calc(100vh - 64px)',
                }}
              >
                {/* Global click spark effect - wraps all page content */}
                <ClickSpark sparkColor="#fff" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
                  <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/qr-generation" element={<QRGeneration />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/engraving" element={<Engraving />} />
                  <Route path="/scanning" element={<Scanning />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/ai-alerts" element={<AIAlerts />} />
                  <Route path="/settings" element={<Settings />} />
                  </Routes>
                </ClickSpark>
              </Box>
            </Box>
          </Router>
        </SnackbarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;