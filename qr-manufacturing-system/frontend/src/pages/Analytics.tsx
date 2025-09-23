import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

// Mock data
const monthlyData = [
  { month: 'Jan', generated: 2400, engraved: 2200, scanned: 2100 },
  { month: 'Feb', generated: 1800, engraved: 1700, scanned: 1650 },
  { month: 'Mar', generated: 3200, engraved: 3000, scanned: 2950 },
  { month: 'Apr', generated: 2800, engraved: 2600, scanned: 2550 },
  { month: 'May', generated: 3600, engraved: 3400, scanned: 3350 },
  { month: 'Jun', generated: 3200, engraved: 3100, scanned: 3050 },
];

const efficiencyData = [
  { name: 'QR Generation', efficiency: 98.5 },
  { name: 'Laser Engraving', efficiency: 94.2 },
  { name: 'Quality Scanning', efficiency: 96.8 },
  { name: 'System Uptime', efficiency: 99.2 },
];

const materialUsage = [
  { name: 'Aluminum', value: 45, color: '#8884d8' },
  { name: 'Plastic', value: 25, color: '#82ca9d' },
  { name: 'Wood', value: 20, color: '#ffc658' },
  { name: 'Steel', value: 10, color: '#ff7300' },
];

const Analytics: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Analytics & Reports
      </Typography>

      {/* Key Performance Indicators */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Monthly QR Codes
              </Typography>
              <Typography variant="h4" color="primary">
                18,200
              </Typography>
              <Typography variant="body2" color="success.main">
                +12% vs last month
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Avg. Processing Time
              </Typography>
              <Typography variant="h4" color="info.main">
                2.4s
              </Typography>
              <Typography variant="body2" color="success.main">
                -0.3s improvement
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                System Efficiency
              </Typography>
              <Typography variant="h4" color="success.main">
                97.2%
              </Typography>
              <Typography variant="body2" color="success.main">
                +1.8% this month
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Error Rate
              </Typography>
              <Typography variant="h4" color="error.main">
                0.4%
              </Typography>
              <Typography variant="body2" color="success.main">
                -0.2% reduction
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        {/* Monthly Production Trend */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Monthly Production Trend
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="generated" 
                  stackId="1"
                  stroke="#1976d2" 
                  fill="#1976d2"
                  fillOpacity={0.6}
                  name="Generated"
                />
                <Area 
                  type="monotone" 
                  dataKey="engraved" 
                  stackId="1"
                  stroke="#ff9800" 
                  fill="#ff9800"
                  fillOpacity={0.6}
                  name="Engraved"
                />
                <Area 
                  type="monotone" 
                  dataKey="scanned" 
                  stackId="1"
                  stroke="#4caf50" 
                  fill="#4caf50"
                  fillOpacity={0.6}
                  name="Scanned"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Material Usage */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Material Usage Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={materialUsage}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                >
                  {materialUsage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* System Efficiency */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
             System Efficiency Metrics
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={efficiencyData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip formatter={(value) => [`${value}%`, 'Efficiency']} />
                <Bar dataKey="efficiency" fill="#4caf50" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Production Timeline */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Production Success Rate
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[85, 100]} />
                <Tooltip formatter={(value, name) => [`${((value as number / 
                  monthlyData.find(d => d.month === 'Jun')?.generated!) * 100).toFixed(1)}%`, 
                  `${name} Success Rate`]} />
                <Line 
                  type="monotone" 
                  dataKey="engraved" 
                  stroke="#ff9800" 
                  strokeWidth={3}
                  name="Engraving"
                />
                <Line 
                  type="monotone" 
                  dataKey="scanned" 
                  stroke="#4caf50" 
                  strokeWidth={3}
                  name="Quality Check"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Performance Metrics Table */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Detailed Performance Metrics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="textSecondary">
                      Total Operations
                    </Typography>
                    <Typography variant="h5">54,600</Typography>
                    <Typography variant="body2" color="success.main">
                      This Month
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="textSecondary">
                      Failed Operations
                    </Typography>
                    <Typography variant="h5">218</Typography>
                    <Typography variant="body2" color="error.main">
                      0.4% Failure Rate
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="textSecondary">
                      Avg. Queue Time
                    </Typography>
                    <Typography variant="h5">1.2min</Typography>
                    <Typography variant="body2" color="info.main">
                      Per Job
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="textSecondary">
                      Peak Throughput
                    </Typography>
                    <Typography variant="h5">450/hr</Typography>
                    <Typography variant="body2" color="primary.main">
                      QR Codes
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Analytics;