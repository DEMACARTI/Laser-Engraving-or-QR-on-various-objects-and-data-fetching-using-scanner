import React, { useMemo, useState } from 'react';
import styles from '../../styles/pages/Analytics.module.css';
import { Box, Typography, Grid, Paper, Card, CardContent, CircularProgress, Alert, FormControl, InputLabel, Select, MenuItem, useMediaQuery, useTheme } from '@mui/material';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar, LineChart, Line } from 'recharts';
import { fetchInventoryStats, fetchManufacturedItems, fetchServiceStats } from './api';
import { statusBreakdownToPieData, computeMonthlyCounts } from './utils';
import { useQuery } from 'react-query';

const AnalyticsPage: React.FC = () => {
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down('sm'));
  const chartHeight = isSm ? 220 : 300;
  const pieRadius = isSm ? 60 : 80;
  const [limit, setLimit] = useState(500);
  const [autoRefresh, setAutoRefresh] = useState<'off' | '30s' | '60s'>('60s');

  const invQuery = useQuery(['inventory-stats'], fetchInventoryStats, { refetchInterval: autoRefresh === 'off' ? false : autoRefresh === '30s' ? 30000 : 60000 });
  const svcQuery = useQuery(['service-stats'], fetchServiceStats, { refetchInterval: autoRefresh === 'off' ? false : autoRefresh === '30s' ? 30000 : 60000 });
  const mfgQuery = useQuery(['manufactured', limit], () => fetchManufacturedItems(limit), { refetchInterval: autoRefresh === 'off' ? false : autoRefresh === '30s' ? 30000 : 60000 });

  const loading = invQuery.isLoading || svcQuery.isLoading || mfgQuery.isLoading;
  const error = invQuery.error || svcQuery.error || mfgQuery.error;
  const inventoryStats = invQuery.data?.stats;
  const serviceStats = svcQuery.data;
  const manufactured = useMemo(() => mfgQuery.data ?? [], [mfgQuery.data]);

  const monthlyData = useMemo(() => computeMonthlyCounts(manufactured), [manufactured]);
  const materialUsage = useMemo(() => statusBreakdownToPieData(inventoryStats?.status_breakdown || {}), [inventoryStats]);

  if (loading) {
    return (
      <Box className={styles.root} display="flex" alignItems="center" justifyContent="center" minHeight={320}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box className={styles.root}>
        <div className={`${styles.container} ${styles.offsetCenter}`}>
          <Alert severity="error">{(error as Error).message}</Alert>
        </div>
      </Box>
    );
  }

  return (
    <Box className={styles.root}>
      <div className={`${styles.container} ${styles.offsetCenter}`}>
        <Typography variant="h4" gutterBottom className={styles.title}>
          Analytics & Reports
        </Typography>

        <Grid container spacing={2} className={styles.section}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="limit-label">Manufactured Limit</InputLabel>
              <Select labelId="limit-label" label="Manufactured Limit" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                <MenuItem value={100}>100</MenuItem>
                <MenuItem value={250}>250</MenuItem>
                <MenuItem value={500}>500</MenuItem>
                <MenuItem value={1000}>1000</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="refresh-label">Auto Refresh</InputLabel>
              <Select labelId="refresh-label" label="Auto Refresh" value={autoRefresh} onChange={(e) => setAutoRefresh(e.target.value as any)}>
                <MenuItem value={'off'}>Off</MenuItem>
                <MenuItem value={'30s'}>Every 30s</MenuItem>
                <MenuItem value={'60s'}>Every 60s</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* KPIs based on real data */}
        <Grid container spacing={3} className={styles.section} alignItems="stretch">
          <Grid item xs={12} sm={6} md={3}>
            <Card className={styles.card}>
              <CardContent className={styles.cardContent}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Total Items
                </Typography>
                <Typography variant="h4" color="primary">
                  {inventoryStats?.total_items ?? 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  In inventory
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card className={styles.card}>
              <CardContent className={styles.cardContent}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Manufactured (sample)
                </Typography>
                <Typography variant="h4" color="info.main">
                  {manufactured.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Last fetch
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card className={styles.card}>
              <CardContent className={styles.cardContent}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Worker Status
                </Typography>
                <Typography variant="h5" color={serviceStats?.worker_running ? 'success.main' : 'error.main'}>
                  {serviceStats?.worker_running ? 'Running' : 'Stopped'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Backend worker
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card className={styles.card}>
              <CardContent className={styles.cardContent}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Engraving State
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {serviceStats?.engraving_state?.status ?? 'unknown'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Updated {new Date(serviceStats?.timestamp || Date.now()).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Charts */}
        <Grid container spacing={3} className={styles.section}>
          {/* Monthly Production Trend (generated approximated) */}
          <Grid item xs={12} md={8}>
            <Paper className={styles.paper}>
              <Typography variant="h6" gutterBottom>
                Monthly Production Trend
              </Typography>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="generated" stackId="1" stroke="#1976d2" fill="#1976d2" fillOpacity={0.6} name="Generated" />
                  <Area type="monotone" dataKey="engraved" stackId="1" stroke="#ff9800" fill="#ff9800" fillOpacity={0.6} name="Engraved" />
                  <Area type="monotone" dataKey="scanned" stackId="1" stroke="#4caf50" fill="#4caf50" fillOpacity={0.6} name="Scanned" />
                </AreaChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Status Breakdown as Pie */}
          <Grid item xs={12} md={4}>
            <Paper className={styles.paper}>
              <Typography variant="h6" gutterBottom>
                Status Breakdown
              </Typography>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <PieChart>
                  <Pie data={materialUsage} cx="50%" cy="50%" outerRadius={pieRadius} dataKey="value" label={({ name, value }) => `${name}: ${value}` }>
                    {materialUsage.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Efficiency proxy using total items by status (bar) */}
          <Grid item xs={12} md={6}>
            <Paper className={styles.paper}>
              <Typography variant="h6" gutterBottom>
                Items per Status
              </Typography>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={Object.entries(inventoryStats?.status_breakdown || {}).map(([name, value]) => ({ name, value }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#4caf50" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Recent trend (line) using monthly generated */}
          <Grid item xs={12} md={6}>
            <Paper className={styles.paper}>
              <Typography variant="h6" gutterBottom>
                Recent Generated Trend
              </Typography>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="generated" stroke="#1976d2" strokeWidth={3} name="Generated" />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      </div>
    </Box>
  );
};

export default AnalyticsPage;
