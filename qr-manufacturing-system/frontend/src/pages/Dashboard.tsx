import React from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  LinearProgress,
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
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
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
          <Card>
            <CardContent>
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
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Success Rate
              </Typography>
              <Typography variant="h4" color="success.main">
                97.3%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={97.3} 
                color="success"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
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
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Weekly Production Overview
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
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
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Job Status Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
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
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Production Trend (Last 7 Days)
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
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
    </Box>
  );
};

export default Dashboard;