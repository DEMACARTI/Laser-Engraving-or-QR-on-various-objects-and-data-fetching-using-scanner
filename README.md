# QR Manufacturing System with AI Alert Intelligence

A comprehensive railway QR code manufacturing system with integrated AI-powered alert management for component monitoring, predictive maintenance, and automated notifications.

## 🚀 Quick Start - Single Command Deployment

Run the entire system with one command:

```bash
./run_services.sh
```

This starts all services including:
- **Combined Backend Service** (Port 5002) - Main API with integrated AI alerts
- **Engraving Service** (Port 8004) - Laser engraving control
- **AI Alert System** - Predictive analytics and smart notifications

## 🤖 AI Alert System Features

### Intelligent Alert Types
- **Expiry Warnings** - Component lifecycle management
- **Safety Alerts** - Critical safety notifications  
- **Maintenance Alerts** - Predictive maintenance scheduling
- **Inventory Alerts** - Stock level monitoring
- **Compliance Alerts** - Regulatory compliance tracking
- **Performance Alerts** - System performance monitoring

### Machine Learning Capabilities
- **Random Forest Algorithm** - For predictive analytics
- **Isolation Forest** - For anomaly detection
- **Priority Classification** - 5-level priority system (Critical to Low)
- **Smart Recommendations** - Automated action suggestions

### API Endpoints
- `GET /ai-alerts/list` - List all alerts
- `POST /ai-alerts/generate` - Generate new alerts for UID
- `POST /ai-alerts/{id}/acknowledge` - Acknowledge alerts
- `POST /ai-alerts/{id}/resolve` - Resolve alerts
- `GET /ai-alerts/summary` - Alert summary and statistics

## 🏗️ System Architecture

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   React Frontend    │    │  Combined Backend    │    │  Engraving Service  │
│   (Port 3000)       │◄──►│    (Port 5002)       │◄──►│    (Port 8004)      │
│                     │    │                      │    │                     │
│ • Dashboard         │    │ • QR Generation      │    │ • Laser Control     │
│ • AI Alert UI       │    │ • AI Alert System    │    │ • Pattern Engraving │
│ • Analytics         │    │ • Inventory Mgmt     │    │ • Safety Monitoring │
│ • Management        │    │ • Analytics Engine   │    │                     │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
                                      │
                                      ▼
                           ┌─────────────────────┐
                           │   MySQL Database    │
                           │                     │
                           │ • QR Codes          │
                           │ • AI Alerts         │
                           │ • Inventory Items   │
                           │ • Analytics Data    │
                           └─────────────────────┘
```
