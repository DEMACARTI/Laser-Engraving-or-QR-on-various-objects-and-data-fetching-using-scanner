#!/usr/bin/env python3
"""
Service Launcher - Start all QR Manufacturing System services
This script starts both the combined backend service and the engraving service
"""

import subprocess
import threading
import time
import os
import signal
import sys
from pathlib import Path

# Get the project root directory
PROJECT_ROOT = Path(__file__).parent.absolute()
VENV_PYTHON = PROJECT_ROOT / ".venv" / "bin" / "python"

# Service configurations
SERVICES = {
    "combined_backend": {
        "name": "Combined Backend Service",
        "script": PROJECT_ROOT / "qr-manufacturing-system" / "combined_backend_service.py",
        "port": 5002,
        "cwd": PROJECT_ROOT / "qr-manufacturing-system"
    },
    "engraving_service": {
        "name": "Engraving Service", 
        "script": PROJECT_ROOT / "qr-manufacturing-system" / "services" / "engraving-service" / "main_updated.py",
        "port": 8004,
        "cwd": PROJECT_ROOT / "qr-manufacturing-system" / "services" / "engraving-service",
        "env": {"PYTHONPATH": str(PROJECT_ROOT / "qr-manufacturing-system" / "services" / "engraving-service")}
    }
}

class ServiceManager:
    def __init__(self):
        self.processes = {}
        self.running = True
        
    def start_service(self, service_id, config):
        """Start a single service"""
        print(f"🚀 Starting {config['name']}...")
        
        try:
            env = os.environ.copy()
            if 'env' in config:
                env.update(config['env'])
            
            process = subprocess.Popen(
                [str(VENV_PYTHON), str(config['script'])],
                cwd=str(config['cwd']),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True,
                bufsize=1
            )
            
            self.processes[service_id] = {
                'process': process,
                'config': config
            }
            
            # Start output monitoring thread
            threading.Thread(
                target=self.monitor_service_output,
                args=(service_id, process),
                daemon=True
            ).start()
            
            print(f"✅ {config['name']} started (PID: {process.pid})")
            return True
            
        except Exception as e:
            print(f"❌ Failed to start {config['name']}: {e}")
            return False
    
    def monitor_service_output(self, service_id, process):
        """Monitor service output and print important messages"""
        config = self.processes[service_id]['config']
        
        while self.running and process.poll() is None:
            try:
                # Read stdout
                line = process.stdout.readline()
                if line:
                    line = line.strip()
                    # Print important messages
                    if any(keyword in line.lower() for keyword in [
                        'running on', 'started', 'ready', 'error', 'failed', 
                        'database', 'connection', 'listening'
                    ]):
                        print(f"[{config['name']}] {line}")
                
                time.sleep(0.1)
            except:
                break
    
    def check_service_health(self, service_id):
        """Check if a service is healthy"""
        if service_id not in self.processes:
            return False
        
        process = self.processes[service_id]['process']
        return process.poll() is None
    
    def stop_all_services(self):
        """Stop all services gracefully"""
        print("\n🛑 Stopping all services...")
        self.running = False
        
        for service_id, service_info in self.processes.items():
            process = service_info['process']
            config = service_info['config']
            
            if process.poll() is None:
                print(f"🔄 Stopping {config['name']}...")
                process.terminate()
                
                # Wait for graceful shutdown
                try:
                    process.wait(timeout=5)
                    print(f"✅ {config['name']} stopped gracefully")
                except subprocess.TimeoutExpired:
                    print(f"⚠️  Force killing {config['name']}...")
                    process.kill()
                    process.wait()
    
    def start_all_services(self):
        """Start all services"""
        print("🎯 QR Manufacturing System - Service Launcher")
        print("=" * 60)
        
        # Check if virtual environment exists
        if not VENV_PYTHON.exists():
            print(f"❌ Virtual environment not found at: {VENV_PYTHON}")
            print("Please ensure the virtual environment is set up correctly.")
            return False
        
        # Start services with delay between them
        for service_id, config in SERVICES.items():
            if not config['script'].exists():
                print(f"❌ Service script not found: {config['script']}")
                continue
                
            success = self.start_service(service_id, config)
            if not success:
                print(f"❌ Failed to start {config['name']}")
                return False
            
            # Wait a bit between service starts
            time.sleep(2)
        
        print("\n" + "=" * 60)
        print("🎉 All services started successfully!")
        print("\n📊 Service Status:")
        
        for service_id, config in SERVICES.items():
            if service_id in self.processes:
                status = "🟢 Running" if self.check_service_health(service_id) else "🔴 Stopped"
                print(f"   {config['name']}: {status} (Port {config['port']})")
        
        print("\n🌐 Service URLs:")
        print("   Combined Backend: http://localhost:5002")
        print("   Engraving Service: http://localhost:8004")
        
        print("\n📝 API Endpoints:")
        print("   Health Check: http://localhost:5002/health")
        print("   Manufactured Items: http://localhost:5002/items/manufactured")
        print("   Engraving Status: http://localhost:8004/engrave/status")
        
        print("\n⌨️  Press Ctrl+C to stop all services")
        print("=" * 60)
        
        return True
    
    def run(self):
        """Main run loop"""
        try:
            if not self.start_all_services():
                return False
            
            # Keep the main thread alive and monitor services
            while self.running:
                time.sleep(1)
                
                # Check if any service died
                for service_id, service_info in self.processes.items():
                    if not self.check_service_health(service_id):
                        config = service_info['config']
                        print(f"⚠️  {config['name']} has stopped unexpectedly!")
                
        except KeyboardInterrupt:
            print("\n\n⌨️  Keyboard interrupt received")
        except Exception as e:
            print(f"\n❌ Unexpected error: {e}")
        finally:
            self.stop_all_services()
            print("\n👋 All services stopped. Goodbye!")

def signal_handler(sig, frame):
    """Handle shutdown signals"""
    print(f"\n🛑 Received signal {sig}")
    sys.exit(0)

def main():
    # Set up signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Start service manager
    manager = ServiceManager()
    success = manager.run()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()