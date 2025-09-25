import React from 'react';
import styles from '../styles/pages/Dashboard.module.css';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  LinearProgress,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
// Removed TrainLoader for Success Rate; using standard percentage display instead

// Mock data for charts
const productionData = [
  { name: 'Mon', generated: 245, engraved: 230, scanned: 225 },
  { name: 'Tue', generated: 189, engraved: 175, scanned: 170 },
  { name: 'Wed', generated: 302, engraved: 290, scanned: 285 },
  { name: 'Thu', generated: 278, engraved: 265, scanned: 260 },
  { name: 'Fri', generated: 356, engraved: 340, scanned: 335 },
  { name: 'Sat', generated: 198, engraved: 190, scanned: 188 },
  { name: 'Sun', generated: 123, engraved: 120, scanned: 118 },
];

const statusData = [
  { name: 'Completed', value: 75, color: '#4caf50' },
  { name: 'In Progress', value: 20, color: '#ff9800' },
  { name: 'Failed', value: 5, color: '#f44336' },
];

const Dashboard: React.FC = () => {
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down('sm'));
  const gridSpacing = isSm ? 2 : 3;
  const barHeight = isSm ? 220 : 300;
  const lineHeight = isSm ? 200 : 250;
  const pieOuterRadius = isSm ? 60 : 80;

  return (
    <Box className={styles.root}>
      <div className={styles.container}>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
      
      {/* Key Metrics */}
      <Grid container spacing={gridSpacing} className={styles.section}>
        <Grid item xs={12} sm={6} md={3}>
          <Card className={styles.card}>
            <CardContent className={styles.cardContent}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Total QR Codes
              </Typography>
              <Typography variant="h4" color="primary">
                12,847
              </Typography>
              <Typography variant="body2" color="success.main">
                +15% from last month
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card className={styles.card}>
            <CardContent className={styles.cardContent}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Active Jobs
              </Typography>
              <Typography variant="h4" color="warning.main">
                23
              </Typography>
              <Typography variant="body2" color="textSecondary">
                8 engraving, 15 scanning
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card className={styles.card}>
            <CardContent className={styles.cardContent}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Success Rate
              </Typography>
              <Typography variant="h4" color="success.main">
                97.3%
              </Typography>
              <Box sx={{ mt: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={97.3}
                  color="success"
                  sx={{ height: 8, borderRadius: 5 }}
                  aria-label="Success rate 97.3 percent"
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography variant="caption" color="textSecondary">0%</Typography>
                  <Typography variant="caption" color="textSecondary">100%</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card className={styles.card}>
            <CardContent className={styles.cardContent}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                System Health
              </Typography>
              <Typography variant="h4" color="success.main">
                Optimal
              </Typography>
              <Typography variant="body2" color="textSecondary">
                All services online
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

  {/* Charts */}
  <Grid container spacing={gridSpacing}>
        <Grid item xs={12} md={8}>
          <Paper className={styles.paper}>
            <Typography variant="h6" gutterBottom>
              Weekly Production Overview
            </Typography>
            <ResponsiveContainer width="100%" height={barHeight}>
              <BarChart data={productionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="generated" fill="#1976d2" name="Generated" />
                <Bar dataKey="engraved" fill="#ff9800" name="Engraved" />
                <Bar dataKey="scanned" fill="#4caf50" name="Scanned" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Paper className={styles.paper}>
            <Typography variant="h6" gutterBottom>
              Job Status Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={barHeight}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={pieOuterRadius}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        
        <Grid item xs={12}>
          <Paper className={styles.paper}>
            <Typography variant="h6" gutterBottom>
              Production Trend (Last 7 Days)
            </Typography>
            <ResponsiveContainer width="100%" height={lineHeight}>
              <LineChart data={productionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="generated" 
                  stroke="#1976d2" 
                  strokeWidth={2}
                  name="Generated"
                />
                <Line 
                  type="monotone" 
                  dataKey="engraved" 
                  stroke="#ff9800" 
                  strokeWidth={2}
                  name="Engraved"
                />
                <Line 
                  type="monotone" 
                  dataKey="scanned" 
                  stroke="#4caf50" 
                  strokeWidth={2}
                  name="Scanned"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
      </div>
    </Box>
  );
};

export default Dashboard;