import React, { useState } from 'react';
import styles from '../styles/pages/Settings.module.css';
import {
  Box,
  Typography,
  Grid,
  Paper,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Card,
  CardContent,
  Alert,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Save as SaveIcon,
  RestoreFromTrash as ResetIcon,
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const Settings: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [settings, setSettings] = useState({
    // General Settings
    companyName: 'Manufacturing Corp',
    defaultPrefix: 'PAD-V0100-L2025-09',
    timezone: 'UTC',
    language: 'en',
    
    // QR Generation Settings
    qrSize: 256,
    qrFormat: 'PNG',
    qrErrorCorrection: 'M',
    batchSize: 50,
    
    // Laser Settings
    defaultMaterial: 'Aluminum',
    laserPower: 75,
    engravingSpeed: 100,
    numberOfPasses: 1,
    
    // System Settings
    enableNotifications: true,
    enableAutoBackup: true,
    backupInterval: 24,
    enableLogging: true,
    logLevel: 'INFO',
    
    // Scanner Settings
    scanTimeout: 30,
    enableSound: true,
    enableCameraPreview: true,
    autoValidation: true,
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // TODO: Implement save logic
    console.log('Saving settings:', settings);
  };

  const handleReset = () => {
    // TODO: Implement reset logic
    console.log('Resetting settings to defaults');
  };

  return (
    <Box className={styles.root}>
      <div className={`${styles.container} ${styles.offsetCenter}`}>
        <Typography variant="h4" gutterBottom className={styles.title}>
          System Settings
        </Typography>

  <Paper className={styles.paper} sx={{ width: '100%' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="settings tabs"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="General" />
          <Tab label="QR Generation" />
          <Tab label="Laser Engraving" />
          <Tab label="System" />
          <Tab label="Scanner" />
        </Tabs>

        {/* General Settings */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Company Name"
                value={settings.companyName}
                onChange={(e) => handleSettingChange('companyName', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Default QR Prefix"
                value={settings.defaultPrefix}
                onChange={(e) => handleSettingChange('defaultPrefix', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Timezone</InputLabel>
                <Select
                  value={settings.timezone}
                  onChange={(e) => handleSettingChange('timezone', e.target.value)}
                  label="Timezone"
                >
                  <MenuItem value="UTC">UTC</MenuItem>
                  <MenuItem value="EST">Eastern Time</MenuItem>
                  <MenuItem value="PST">Pacific Time</MenuItem>
                  <MenuItem value="GMT">Greenwich Mean Time</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Language</InputLabel>
                <Select
                  value={settings.language}
                  onChange={(e) => handleSettingChange('language', e.target.value)}
                  label="Language"
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="es">Spanish</MenuItem>
                  <MenuItem value="fr">French</MenuItem>
                  <MenuItem value="de">German</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </TabPanel>

        {/* QR Generation Settings */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Default QR Size (px)"
                value={settings.qrSize}
                onChange={(e) => handleSettingChange('qrSize', parseInt(e.target.value))}
                inputProps={{ min: 64, max: 1024, step: 32 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Default Format</InputLabel>
                <Select
                  value={settings.qrFormat}
                  onChange={(e) => handleSettingChange('qrFormat', e.target.value)}
                  label="Default Format"
                >
                  <MenuItem value="PNG">PNG</MenuItem>
                  <MenuItem value="SVG">SVG</MenuItem>
                  <MenuItem value="PDF">PDF</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Error Correction Level</InputLabel>
                <Select
                  value={settings.qrErrorCorrection}
                  onChange={(e) => handleSettingChange('qrErrorCorrection', e.target.value)}
                  label="Error Correction Level"
                >
                  <MenuItem value="L">Low (7%)</MenuItem>
                  <MenuItem value="M">Medium (15%)</MenuItem>
                  <MenuItem value="Q">Quartile (25%)</MenuItem>
                  <MenuItem value="H">High (30%)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Default Batch Size"
                value={settings.batchSize}
                onChange={(e) => handleSettingChange('batchSize', parseInt(e.target.value))}
                inputProps={{ min: 1, max: 1000 }}
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* Laser Engraving Settings */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Default Material</InputLabel>
                <Select
                  value={settings.defaultMaterial}
                  onChange={(e) => handleSettingChange('defaultMaterial', e.target.value)}
                  label="Default Material"
                >
                  <MenuItem value="Aluminum">Aluminum</MenuItem>
                  <MenuItem value="Steel">Steel</MenuItem>
                  <MenuItem value="Plastic">Plastic</MenuItem>
                  <MenuItem value="Wood">Wood</MenuItem>
                  <MenuItem value="Acrylic">Acrylic</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Default Laser Power (%)"
                value={settings.laserPower}
                onChange={(e) => handleSettingChange('laserPower', parseInt(e.target.value))}
                inputProps={{ min: 1, max: 100 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Engraving Speed (mm/min)"
                value={settings.engravingSpeed}
                onChange={(e) => handleSettingChange('engravingSpeed', parseInt(e.target.value))}
                inputProps={{ min: 10, max: 1000 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Number of Passes"
                value={settings.numberOfPasses}
                onChange={(e) => handleSettingChange('numberOfPasses', parseInt(e.target.value))}
                inputProps={{ min: 1, max: 10 }}
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* System Settings */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Notifications
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableNotifications}
                        onChange={(e) => handleSettingChange('enableNotifications', e.target.checked)}
                      />
                    }
                    label="Enable system notifications"
                  />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Backup & Recovery
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableAutoBackup}
                        onChange={(e) => handleSettingChange('enableAutoBackup', e.target.checked)}
                      />
                    }
                    label="Enable automatic backups"
                  />
                  <TextField
                    fullWidth
                    type="number"
                    label="Backup Interval (hours)"
                    value={settings.backupInterval}
                    onChange={(e) => handleSettingChange('backupInterval', parseInt(e.target.value))}
                    inputProps={{ min: 1, max: 168 }}
                    sx={{ mt: 2 }}
                    disabled={!settings.enableAutoBackup}
                  />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Logging
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableLogging}
                        onChange={(e) => handleSettingChange('enableLogging', e.target.checked)}
                      />
                    }
                    label="Enable system logging"
                  />
                  <FormControl fullWidth sx={{ mt: 2 }} disabled={!settings.enableLogging}>
                    <InputLabel>Log Level</InputLabel>
                    <Select
                      value={settings.logLevel}
                      onChange={(e) => handleSettingChange('logLevel', e.target.value)}
                      label="Log Level"
                    >
                      <MenuItem value="ERROR">Error</MenuItem>
                      <MenuItem value="WARN">Warning</MenuItem>
                      <MenuItem value="INFO">Info</MenuItem>
                      <MenuItem value="DEBUG">Debug</MenuItem>
                    </Select>
                  </FormControl>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Scanner Settings */}
        <TabPanel value={tabValue} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Scan Timeout (seconds)"
                value={settings.scanTimeout}
                onChange={(e) => handleSettingChange('scanTimeout', parseInt(e.target.value))}
                inputProps={{ min: 5, max: 120 }}
              />
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Scanner Options
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableSound}
                        onChange={(e) => handleSettingChange('enableSound', e.target.checked)}
                      />
                    }
                    label="Enable scan sound feedback"
                  />
                  <br />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableCameraPreview}
                        onChange={(e) => handleSettingChange('enableCameraPreview', e.target.checked)}
                      />
                    }
                    label="Show camera preview"
                  />
                  <br />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.autoValidation}
                        onChange={(e) => handleSettingChange('autoValidation', e.target.checked)}
                      />
                    }
                    label="Automatic QR code validation"
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Action Buttons */}
        <Box sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Changes will be applied immediately and saved to the system configuration.
          </Alert>
          <Grid container spacing={2}>
            <Grid item>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
              >
                Save Settings
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                startIcon={<ResetIcon />}
                onClick={handleReset}
              >
                Reset to Defaults
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
      </div>
    </Box>
  );
};

export default Settings;