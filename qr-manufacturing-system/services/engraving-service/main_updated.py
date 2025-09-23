"""
Engraving Service - Updated with Original Project MySQL Database Integration.

This service manages laser engraving operations using the same database structure 
and functionality as the original project and generate QR service.
"""

import asyncio
import logging
import threading
import time
import os
from datetime import datetime
from typing import Dict, Any, Optional, List
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
import sys

# MySQL Database Configuration (Same as Generate QR and Scanning services)
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "gondola.proxy.rlwy.net"),
    "port": int(os.getenv("DB_PORT", 24442)),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASS", "SZiTeOCZgSbLTZLdDxlIsMKYGRlfxFsd"),
    "database": os.getenv("DB_NAME", "sih_qr_db"),
    "charset": "utf8mb4",
    "autocommit": True
}

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Engraving Service",
    description="Laser engraving service with MySQL database integration",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db_connection():
    """Get MySQL database connection using same config as Generate QR service."""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except mysql.connector.Error as e:
        logger.error(f"❌ Database connection failed: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

def test_db_connection():
    """Test database connection."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        conn.close()
        logger.info("✅ Database connection successful")
        return True
    except Exception as e:
        logger.error(f"❌ Database connection test failed: {e}")
        return False

# Global engraving state (matching original project)
engraving_state = {
    "status": "idle",  # idle, running, paused, stopped
    "current_job": None,
    "current_item": None,
    "processed_count": 0,
    "total_count": 0,
    "start_time": None,
    "pause_time": None,
    "items": [],
    "simulate": True,
    "delay_seconds": 1.0
}

worker_thread = None
worker_stop_event = threading.Event()

def update_item_status_after_engraving(uid: str, success: bool):
    """Update item status in database after engraving completion."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if success:
            status = "Engraved"
            location = "Engraving Station"
            note = "Laser engraving completed successfully"
        else:
            status = "Engraving Failed"
            location = "Engraving Station"
            note = "Laser engraving failed"
        
        # Insert status into statuses table (same as Generate QR service)
        cursor.execute("""
            INSERT INTO statuses (uid, status, location, note, updated_at)
            VALUES (%s, %s, %s, %s, %s)
        """, (uid, status, location, note, datetime.now()))
        
        conn.commit()
        cursor.close()
        conn.close()
        logger.info(f"✅ Updated database status for {uid}: {status}")
        
    except Exception as e:
        logger.error(f"❌ Failed to update database status for {uid}: {e}")

def engrave_single_item(uid: str, simulate: bool = True):
    """Engrave a single item (simulation or real hardware)."""
    try:
        if simulate:
            # Simulation mode - just wait
            delay = engraving_state.get("delay_seconds", 1.0)
            time.sleep(delay)
            logger.info(f"✅ Simulated engraving completed for {uid}")
            return True
        else:
            # Real hardware mode would go here
            # For now, we'll simulate
            time.sleep(2.0)
            logger.info(f"✅ Hardware engraving completed for {uid}")
            return True
            
    except Exception as e:
        logger.error(f"❌ Engraving failed for {uid}: {e}")
        return False

def worker_loop():
    """Background worker for engraving operations."""
    global engraving_state
    
    while not worker_stop_event.is_set():
        try:
            if engraving_state["status"] != "running":
                time.sleep(0.1)
                continue
            
            items = engraving_state.get("items", [])
            processed = engraving_state.get("processed_count", 0)
            
            if processed >= len(items):
                # Job completed
                engraving_state["status"] = "completed"
                engraving_state["current_item"] = None
                logger.info("✅ Engraving job completed")
                continue
            
            # Get next item to engrave
            current_item = items[processed]
            uid = current_item.get("uid")
            
            if uid:
                engraving_state["current_item"] = uid
                logger.info(f"🔥 Starting engraving for {uid}")
                
                # Perform engraving
                success = engrave_single_item(uid, engraving_state.get("simulate", True))
                
                # Update database status
                update_item_status_after_engraving(uid, success)
                
                if success:
                    engraving_state["processed_count"] += 1
                    logger.info(f"✅ Engraving completed for {uid} ({engraving_state['processed_count']}/{len(items)})")
                else:
                    logger.error(f"❌ Engraving failed for {uid}")
                    # Continue with next item even if one fails
                    engraving_state["processed_count"] += 1
            else:
                # Skip invalid item
                engraving_state["processed_count"] += 1
                
        except Exception as e:
            logger.error(f"Worker error: {e}")
            time.sleep(1.0)

@app.on_event("startup")
async def startup_event():
    """Initialize database connection on startup."""
    try:
        logger.info("🚀 Starting Engraving Service...")
        
        # Test database connection
        if test_db_connection():
            logger.info("✅ Database connection established")
        else:
            raise Exception("Database connection failed")
        
        # Test with simple query
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SHOW TABLES")
            tables = cursor.fetchall()
            cursor.close()
            conn.close()
            logger.info(f"✅ Database test successful, found {len(tables)} tables")
        except Exception as e:
            logger.warning(f"⚠️ Database test failed: {e}")
            
        logger.info("🔧 Engraving Service ready")
        
    except Exception as e:
        logger.error(f"❌ Startup failed: {e}")
        raise

@app.on_event("shutdown") 
async def shutdown_event():
    """Clean up resources on shutdown."""
    try:
        global worker_thread, worker_stop_event
        
        if worker_thread and worker_thread.is_alive():
            worker_stop_event.set()
            worker_thread.join(timeout=5)
            
        logger.info("✅ Engraving Service shutdown complete")
        
    except Exception as e:
        logger.error(f"❌ Shutdown error: {e}")

# Original Project API Endpoints
@app.post("/engrave/start")
async def start_engraving(request: Dict[str, Any]):
    """Start engraving operation (original project API)."""
    try:
        global engraving_state
        
        if engraving_state["status"] == "running":
            return {"error": "Engraving is already running"}, 400
        
        uids = request.get("uids", [])
        simulate = request.get("simulate", True)
        delay_seconds = request.get("delay_seconds", 1.0)
        
        if not uids:
            # Get manufactured items from database (same as Generate QR service)
            try:
                conn = get_db_connection()
                cursor = conn.cursor(dictionary=True)
                cursor.execute("""
                    SELECT DISTINCT i.uid 
                    FROM items i
                    JOIN statuses s ON i.uid = s.uid
                    WHERE s.status = 'Manufactured' 
                    ORDER BY i.created_at DESC 
                    LIMIT 50
                """)
                manufactured_items = cursor.fetchall()
                cursor.close()
                conn.close()
                items = [{"uid": item["uid"]} for item in manufactured_items]
            except Exception as e:
                logger.error(f"❌ Failed to get manufactured items: {e}")
                items = []
        else:
            items = [{"uid": uid} for uid in uids]
        
        if not items:
            return {"error": "No items to engrave"}
        
        # Initialize engraving state
        engraving_state.update({
            "status": "running",
            "items": items,
            "processed_count": 0,
            "total_count": len(items),
            "start_time": datetime.utcnow(),
            "current_item": None,
            "simulate": simulate,
            "delay_seconds": delay_seconds
        })
        
        logger.info(f"🔥 Started engraving job with {len(items)} items (simulate={simulate})")
        
        return {
            "ok": True,
            "message": "Engraving started",
            "total_items": len(items),
            "simulate": simulate
        }
        
    except Exception as e:
        logger.error(f"Failed to start engraving: {e}")
        return {"error": f"Failed to start engraving: {str(e)}"}, 500

@app.post("/engrave/stop")
async def stop_engraving():
    """Stop engraving operation (original project API)."""
    global engraving_state
    
    engraving_state["status"] = "stopped"
    engraving_state["current_item"] = None
    
    logger.info("🛑 Engraving stopped")
    
    return {"ok": True, "message": "Engraving stopped"}

@app.post("/engrave/pause")
async def pause_engraving():
    """Pause engraving operation (original project API)."""
    global engraving_state
    
    if engraving_state["status"] == "running":
        engraving_state["status"] = "paused"
        engraving_state["pause_time"] = datetime.utcnow()
        logger.info("⏸️ Engraving paused")
        return {"ok": True, "message": "Engraving paused"}
    
    return {"error": "No active engraving to pause"}, 400

@app.post("/engrave/resume")
async def resume_engraving():
    """Resume engraving operation (original project API)."""
    global engraving_state
    
    if engraving_state["status"] == "paused":
        engraving_state["status"] = "running"
        engraving_state["pause_time"] = None
        logger.info("▶️ Engraving resumed")
        return {"ok": True, "message": "Engraving resumed"}
    
    return {"error": "No paused engraving to resume"}, 400

@app.get("/engrave/status")
async def get_engraving_status():
    """Get current engraving status (original project API)."""
    global engraving_state
    
    # Calculate progress
    processed = engraving_state.get("processed_count", 0)
    total = engraving_state.get("total_count", 0)
    progress = (processed / total * 100) if total > 0 else 0
    
    # Calculate elapsed time
    start_time = engraving_state.get("start_time")
    elapsed_seconds = 0
    if start_time:
        elapsed_seconds = (datetime.utcnow() - start_time).total_seconds()
    
    status = {
        "status": engraving_state["status"],
        "current_item": engraving_state.get("current_item"),
        "processed_count": processed,
        "total_count": total,
        "progress_percent": round(progress, 1),
        "elapsed_seconds": round(elapsed_seconds, 1),
        "simulate": engraving_state.get("simulate", True),
        "delay_seconds": engraving_state.get("delay_seconds", 1.0)
    }
    
    return status

@app.get("/items/manufactured")
async def get_manufactured_items(limit: int = 50):
    """Get manufactured items (original project API)."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT DISTINCT i.uid, i.component, i.vendor, i.lot, 
                   i.mfg_date, i.warranty_years, i.created_at,
                   s.status, s.location, s.updated_at
            FROM items i
            JOIN statuses s ON i.uid = s.uid
            WHERE s.status = 'Manufactured' 
            ORDER BY i.created_at DESC 
            LIMIT %s
        """, (limit,))
        items = cursor.fetchall()
        cursor.close()
        conn.close()
        return {"success": True, "items": items}
    except Exception as e:
        logger.error(f"Failed to get manufactured items: {e}")
        raise HTTPException(status_code=500, detail="Failed to get manufactured items")

@app.post("/update_status")
async def update_item_status(request: Dict[str, Any]):
    """Update item status (original project API)."""
    try:
        uid = request.get("uid")
        status = request.get("status")
        location = request.get("location", "System")
        note = request.get("note", "")
        
        if not uid or not status:
            raise HTTPException(status_code=400, detail="uid and status are required")
        
        # Insert status into database (same as Generate QR service)
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Insert status into statuses table
        cursor.execute("""
            INSERT INTO statuses (uid, status, location, note, updated_at)
            VALUES (%s, %s, %s, %s, %s)
        """, (uid, status, location, note, datetime.now()))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"ok": True, "message": "Status updated"}
            
    except Exception as e:
        logger.error(f"Failed to update status: {e}")
        return {"error": f"Failed to update status: {str(e)}"}, 500

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "engraving-service",
        "timestamp": datetime.utcnow().isoformat(),
        "engraving_status": engraving_state["status"]
    }

@app.get("/stats")
async def get_service_stats():
    """Get service statistics."""
    return {
        "service": "engraving-service",
        "version": "1.0.0",
        "status": "running",
        "database": "mysql",
        "engraving_state": engraving_state,
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main_updated:app",
        host="0.0.0.0",
        port=8004,
        reload=True,
        log_level="info"
    )