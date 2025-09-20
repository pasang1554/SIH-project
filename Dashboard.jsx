// Dashboard.jsx - React Web Dashboard
import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Box,
  AppBar,
  Toolbar,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Badge,
  Avatar,
  Chip,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Agriculture,
  People,
  Notifications,
  Analytics,
  Settings,
  Menu as MenuIcon,
  CloudQueue,
  Warning,
  CheckCircle,
} from '@mui/icons-material';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { MapContainer, TileLayer, Marker, Popup, Polygon } from 'react-leaflet';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2E7D32',
      light: '#4CAF50',
      dark: '#1B5E20',
    },
    secondary: {
      main: '#FF6F00',
      light: '#FFB74D',
      dark: '#E65100',
       },
    success: {
      main: '#4CAF50',
    },
    warning: {
      main: '#FF9800',
    },
    error: {
      main: '#F44336',
    },
    background: {
      default: '#F5F5F5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
});

const Dashboard = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [dateRange, setDateRange] = useState('week');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedRegion, dateRange]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`/api/admin/dashboard?region=${selectedRegion}&range=${dateRange}`);
      const data = await response.json();
      setDashboardData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Farmers', icon: <People />, path: '/farmers' },
    { text: 'Farms', icon: <Agriculture />, path: '/farms' },
    { text: 'Analytics', icon: <Analytics />, path: '/analytics' },
    { text: 'Alerts', icon: <Notifications />, path: '/alerts' },
    { text: 'Settings', icon: <Settings />, path: '/settings' },
  ];

  const StatCard = ({ title, value, change, icon, color }) => (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div" sx={{ mb: 1 }}>
              {value}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Chip
                label={`${change > 0 ? '+' : ''}${change}%`}
                size="small"
                color={change > 0 ? 'success' : 'error'}
                sx={{ fontWeight: 'bold' }}
              />
              <Typography variant="body2" color="textSecondary" sx={{ ml: 1 }}>
                vs last period
              </Typography>
            </Box>
          </Box>
          <Avatar
            sx={{
              bgcolor: color,
              width: 56,
              height: 56,
              position: 'absolute',
              top: -10,
              right: 16,
            }}
          >
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex' }}>
        {/* App Bar */}
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setDrawerOpen(!drawerOpen)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
              Smart Agriculture Platform - Admin Dashboard
            </Typography>
            <FormControl sx={{ m: 1, minWidth: 120 }} size="small">
              <Select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                sx={{ color: 'white', borderColor: 'white' }}
              >
                <MenuItem value="all">All Regions</MenuItem>
                <MenuItem value="north">North</MenuItem>
                <MenuItem value="south">South</MenuItem>
                <MenuItem value="east">East</MenuItem>
                <MenuItem value="west">West</MenuItem>
              </Select>
            </FormControl>
            <IconButton color="inherit">
              <Badge badgeContent={4} color="error">
                <Notifications />
              </Badge>
            </IconButton>
          </Toolbar>
        </AppBar>

        {/* Drawer */}
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          sx={{
            width: 240,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 240,
              boxSizing: 'border-box',
              top: '64px',
            },
          }}
        >
          <List>
            {menuItems.map((item) => (
              <ListItem button key={item.text}>
                <ListItemIcon sx={{ color: 'primary.main' }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItem>
            ))}
          </List>
        </Drawer>

        {/* Main Content */}
        <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Farmers"
                value={dashboardData?.totalFarmers || '0'}
                change={12}
                icon={<People />}
                color="primary.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Active Farms"
                value={dashboardData?.activeFarms || '0'}
                change={8}
                icon={<Agriculture />}
                color="success.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Yield Increase"
                value={`${dashboardData?.yieldIncrease || '0'}%`}
                change={15}
                icon={<Analytics />}
                color="secondary.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Active Alerts"
                value={dashboardData?.activeAlerts || '0'}
                change={-5}
                icon={<Warning />}
                color="warning.main"
              />
            </Grid>
          </Grid>

          {/* Charts Row */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Crop Health Map */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 2, height: 400 }}>
                <Typography variant="h6" gutterBottom>
                  Regional Crop Health Map
                </Typography>
                <Box sx={{ height: 350 }}>
                  <MapContainer
                    center={[20.5937, 78.9629]}
                    zoom={5}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    {dashboardData?.farms?.map((farm) => (
                      <Marker key={farm.id} position={[farm.lat, farm.lng]}>
                        <Popup>
                          <div>
                            <strong>{farm.name}</strong>
                            <br />
                            Health Score: {farm.healthScore}%
                            <br />
                            Area: {farm.area} hectares
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </Box>
              </Paper>
            </Grid>

            {/* Weather Overview */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, height: 400 }}>
                <Typography variant="h6" gutterBottom>
                  Weather Alerts
                </Typography>
                <List>
                  {dashboardData?.weatherAlerts?.map((alert, index) => (
                    <ListItem key={index} sx={{ px: 0 }}>
                      <ListItemIcon>
                        <CloudQueue color={alert.severity === 'high' ? 'error' : 'warning'} />
                      </ListItemIcon>
                      <ListItemText
                        primary={alert.title}
                        secondary={`${alert.affectedRegions} regions affected`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
          </Grid>

          {/* Analytics Charts */}
          <Grid container spacing={3}>
            {/* Productivity Trends */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Productivity Trends
                </Typography>
                <Box sx={{ height: 300 }}>
                  <Line
                    data={{
                      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                      datasets: [
                        {
                          label: 'Average Yield (tons/hectare)',
                          data: [2.1, 2.3, 2.5, 2.8, 3.1, 3.3],
                          borderColor: theme.palette.primary.main,
                          backgroundColor: theme.palette.primary.light,
                          tension: 0.4,
                        },
                        {
                          label: 'Target Yield',
                          data: [2.5, 2.5, 2.5, 3.0, 3.0, 3.0],
                          borderColor: theme.palette.secondary.main,
                          borderDash: [5, 5],
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                        },
                      },
                    }}
                  />
                </Box>
              </Paper>
            </Grid>

            {/* Crop Distribution */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Crop Distribution
                </Typography>
                <Box sx={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <Doughnut
                    data={{
                      labels: ['Rice', 'Wheat', 'Cotton', 'Sugarcane', 'Pulses', 'Others'],
                      datasets: [
                        {
                          data: [30, 25, 15, 12, 10, 8],
                          backgroundColor: [
                            '#4CAF50',
                            '#8BC34A',
                            '#CDDC39',
                            '#FFC107',
                            '#FF9800',
                            '#FF5722',
                          ],
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'right',
                        },
                      },
                    }}
                  />
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Recent Activities */}
          <Grid container spacing={3} sx={{ mt: 3 }}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Recent Activities
                </Typography>
                <List>
                  {dashboardData?.recentActivities?.map((activity, index) => (
                    <ListItem key={index} divider={index < dashboardData.recentActivities.length - 1}>
                      <ListItemIcon>
                        {activity.type === 'success' ? (
                          <CheckCircle color="success" />
                        ) : (
                          <Warning color="warning" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={activity.message}
                        secondary={activity.timestamp}
                      />
                      <Button size="small" variant="outlined">
                        View Details
                      </Button>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default Dashboard;