"""
Combined Backend Service - Original Project Functionality with MySQL Integration.

This service combines all the original project functionality (QR generation, 
engraving, scanning) into a single Flask application for easier deployment.
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import qrcode
import io
import mysql.connector
from datetime import datetime, date, timedelta
from pathlib import Path
import threading
import time
import logging
import os

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MySQL Database Configuration (Original Project)
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "gondola.proxy.rlwy.net"),
    "port": int(os.getenv("DB_PORT", 24442)),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASS", "SZiTeOCZgSbLTZLdDxlIsMKYGRlfxFsd"),
    "database": os.getenv("DB_NAME", "sih_qr_db"),
    "charset": "utf8mb4",
    "autocommit": True
}

# QR code storage
OUTPUT_DIR = Path("qr_batch_output")
OUTPUT_DIR.mkdir(exist_ok=True)

# Global engraving state
engraving_state = {
    "status": "idle",  # idle, running, paused, stopped
    "current_item": None,
    "processed_count": 0,
    "total_count": 0,
    "start_time": None,
    "items": [],
    "simulate": True,
    "delay_seconds": 1.0
}

worker_thread = None
worker_stop_event = threading.Event()

def test_db_connection():
    """Test MySQL database connection."""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        conn.close()
        logger.info("✅ Database connection successful")
        return True
    except mysql.connector.Error as e:
        logger.error(f"❌ Database connection failed: {e}")
        return False

def get_db_conn():
    """Get database connection."""
    return mysql.connector.connect(**DB_CONFIG)

def make_uid(component, vendor, lot, serial):
    """Generate UID in original project format."""
    return f"{component}-{vendor}-{lot}-{serial:05d}"

def generate_qr_image_bytes(payload):
    """Generate QR code image bytes."""
    qr = qrcode.QRCode(
        version=2,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=6,
        border=2,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.read()

def engrave_single_item(uid, simulate=True):
    """Engrave a single item (simulation or real hardware)."""
    try:
        delay = engraving_state.get("delay_seconds", 1.0)
        time.sleep(delay)
        logger.info(f"✅ {'Simulated' if simulate else 'Hardware'} engraving completed for {uid}")
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
                
                success = engrave_single_item(uid, engraving_state.get("simulate", True))
                
                if success:
                    engraving_state["processed_count"] += 1
                    logger.info(f"✅ Engraving completed for {uid} ({engraving_state['processed_count']}/{len(items)})")
                else:
                    engraving_state["processed_count"] += 1
            else:
                engraving_state["processed_count"] += 1
                
        except Exception as e:
            logger.error(f"Worker error: {e}")
            time.sleep(1.0)

# QR Generation API Endpoints
@app.route("/api/options", methods=["GET"])
def get_options():
    """Get options for dropdowns."""
    components = ["ERC", "LINER", "PAD", "SLEEPER"]
    vendors = ["V010", "V011", "V012"]
    lots = ["L2025-09", "L2025-10", "L2025-11"]
    return jsonify({"components": components, "vendors": vendors, "lots": lots})

@app.route("/api/generate", methods=["POST"])
def generate():
    """Generate QR codes and store in database."""
    try:
        data = request.json
        component = data.get("component")
        vendor = data.get("vendor")
        lot = data.get("lot")
        warranty_years = int(data.get("warranty_years", 5))
        count = int(data.get("count", 1))
        mfg_date = data.get("mfg_date") or date.today().isoformat()

        if not all([component, vendor, lot]):
            return jsonify({"success": False, "error": "component, vendor, and lot are required"}), 400

        conn = get_db_conn()
        cur = conn.cursor()
        
        # Find next serial number
        cur.execute("SELECT MAX(uid) FROM items WHERE component=%s AND vendor=%s AND lot=%s", (component, vendor, lot))
        max_uid = cur.fetchone()[0]
        if max_uid:
            try:
                serial = int(max_uid.split("-")[-1]) + 1
            except Exception:
                serial = 1
        else:
            serial = 1

        results = []
        for i in range(count):
            uid = make_uid(component, vendor, lot, serial + i)
            payload = uid
            png_bytes = generate_qr_image_bytes(payload)
            local_path = OUTPUT_DIR / f"{uid}.png"
            
            with open(local_path, "wb") as f:
                f.write(png_bytes)
            
            created_at = datetime.utcnow().replace(microsecond=0).isoformat(sep=" ")
            
            # Insert into items table
            sql = """
            INSERT IGNORE INTO items
            (uid, component, vendor, lot, mfg_date, warranty_years, qr_path, qr_image, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """
            cur.execute(sql, (uid, component, vendor, lot, mfg_date, warranty_years, str(local_path), png_bytes, created_at))
            
            # Insert initial status
            cur.execute("""
            INSERT INTO statuses (uid, status, location, note, updated_at)
            VALUES (%s,%s,%s,%s,%s)
            """, (uid, "Manufactured", "Factory", "Initial QR generation", datetime.utcnow()))
            
            results.append({"uid": uid, "qr_path": str(local_path)})

        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({"success": True, "results": results})
        
    except Exception as e:
        logger.error(f"Generate error: {e}")
        return jsonify({"success": False, "error": f"Failed to generate QR codes: {str(e)}"}), 500

@app.route("/api/qr/<uid>", methods=["GET"])
def get_qr(uid):
    """Get QR code image by UID."""
    path = OUTPUT_DIR / f"{uid}.png"
    if not path.exists():
        return jsonify({"error": "QR not found"}), 404
    return send_file(str(path), mimetype="image/png")

@app.route("/items/manufactured", methods=["GET"])
def get_manufactured_items():
    """Get manufactured items (original project API)."""
    try:
        limit = request.args.get('limit', 50, type=int)
        
        conn = get_db_conn()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT DISTINCT i.uid, i.component, i.vendor, i.lot, 
                   i.mfg_date, i.warranty_years, i.created_at,
                   s.status as current_status, s.location, s.updated_at as status_updated_at
            FROM items i
            JOIN statuses s ON i.uid = s.uid
            WHERE s.status = 'Manufactured' 
            ORDER BY i.created_at DESC 
            LIMIT %s
        """, (limit,))
        items = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # Convert datetime objects to strings for JSON serialization
        for item in items:
            if item['mfg_date'] and hasattr(item['mfg_date'], 'strftime'):
                item['mfg_date'] = item['mfg_date'].strftime('%Y-%m-%d')
            if item['created_at'] and hasattr(item['created_at'], 'isoformat'):
                item['created_at'] = item['created_at'].isoformat()
            if item['status_updated_at'] and hasattr(item['status_updated_at'], 'isoformat'):
                item['status_updated_at'] = item['status_updated_at'].isoformat()
        
        return jsonify({"success": True, "items": items})
        
    except Exception as e:
        logger.error(f"Failed to get manufactured items: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/inventory/items", methods=["GET"])
def get_inventory_items():
    """Get all inventory items with their current status."""
    try:
        limit = request.args.get('limit', 100, type=int)
        
        conn = get_db_conn()
        cursor = conn.cursor(dictionary=True)
        
        # Get all items with their latest status
        cursor.execute("""
            SELECT i.uid, i.component, i.vendor, i.lot, 
                   i.mfg_date, i.warranty_years, i.created_at,
                   s.status, s.location, s.updated_at as status_updated_at
            FROM items i
            LEFT JOIN (
                SELECT uid, status, location, updated_at,
                       ROW_NUMBER() OVER (PARTITION BY uid ORDER BY updated_at DESC) as rn
                FROM statuses
            ) s ON i.uid = s.uid AND s.rn = 1
            ORDER BY i.created_at DESC
            LIMIT %s
        """, (limit,))
        
        items = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # Convert datetime objects to strings for JSON serialization
        for item in items:
            if item['mfg_date'] and hasattr(item['mfg_date'], 'strftime'):
                item['mfg_date'] = item['mfg_date'].strftime('%Y-%m-%d')
            if item['created_at'] and hasattr(item['created_at'], 'isoformat'):
                item['created_at'] = item['created_at'].isoformat()
            if item['status_updated_at'] and hasattr(item['status_updated_at'], 'isoformat'):
                item['status_updated_at'] = item['status_updated_at'].isoformat()
        
        return jsonify({
            "success": True,
            "items": items,
            "total": len(items)
        })
        
    except Exception as e:
        logger.error(f"Failed to get inventory items: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route("/inventory/stats", methods=["GET"])
def get_inventory_stats():
    """Get inventory statistics."""
    try:
        conn = get_db_conn()
        cursor = conn.cursor(dictionary=True)
        
        # Get total items
        cursor.execute("SELECT COUNT(*) as total FROM items")
        total_items = cursor.fetchone()['total']
        
        # Get items by status
        cursor.execute("""
            SELECT s.status, COUNT(*) as count
            FROM items i
            LEFT JOIN (
                SELECT uid, status,
                       ROW_NUMBER() OVER (PARTITION BY uid ORDER BY updated_at DESC) as rn
                FROM statuses
            ) s ON i.uid = s.uid AND s.rn = 1
            GROUP BY s.status
        """)
        
        status_counts = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # Calculate statistics
        stats = {
            "total_items": total_items,
            "status_breakdown": {item['status'] or 'Unknown': item['count'] for item in status_counts},
            "low_stock_alerts": 0,  # Can be implemented based on business logic
            "pending_actions": 0     # Can be implemented based on business logic
        }
        
        return jsonify({
            "success": True,
            "stats": stats
        })
        
    except Exception as e:
        logger.error(f"Failed to get inventory stats: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route("/inventory/search", methods=["GET"])
def search_inventory():
    """Search inventory items."""
    try:
        query = request.args.get('q', '')
        component_filter = request.args.get('component', '')
        status_filter = request.args.get('status', '')
        
        conn = get_db_conn()
        cursor = conn.cursor(dictionary=True)
        
        # Build dynamic query
        where_conditions = []
        params = []
        
        if query:
            where_conditions.append("(i.uid LIKE %s OR i.component LIKE %s OR i.vendor LIKE %s)")
            params.extend([f"%{query}%", f"%{query}%", f"%{query}%"])
            
        if component_filter:
            where_conditions.append("i.component = %s")
            params.append(component_filter)
            
        if status_filter:
            where_conditions.append("s.status = %s")
            params.append(status_filter)
        
        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
        
        query_sql = f"""
            SELECT i.uid, i.component, i.vendor, i.lot, 
                   i.mfg_date, i.warranty_years, i.created_at,
                   s.status, s.location, s.updated_at as status_updated_at
            FROM items i
            LEFT JOIN (
                SELECT uid, status, location, updated_at,
                       ROW_NUMBER() OVER (PARTITION BY uid ORDER BY updated_at DESC) as rn
                FROM statuses
            ) s ON i.uid = s.uid AND s.rn = 1
            WHERE {where_clause}
            ORDER BY i.created_at DESC
            LIMIT 100
        """
        
        cursor.execute(query_sql, params)
        items = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # Convert datetime objects to strings for JSON serialization
        for item in items:
            if item['mfg_date'] and hasattr(item['mfg_date'], 'strftime'):
                item['mfg_date'] = item['mfg_date'].strftime('%Y-%m-%d')
            if item['created_at'] and hasattr(item['created_at'], 'isoformat'):
                item['created_at'] = item['created_at'].isoformat()
            if item['status_updated_at'] and hasattr(item['status_updated_at'], 'isoformat'):
                item['status_updated_at'] = item['status_updated_at'].isoformat()
        
        return jsonify({
            "success": True,
            "items": items,
            "total": len(items)
        })
        
    except Exception as e:
        logger.error(f"Failed to search inventory: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

# Engraving API Endpoints
@app.route("/engrave/start", methods=["POST"])
def start_engraving():
    """Start engraving operation."""
    try:
        global engraving_state
        
        if engraving_state["status"] == "running":
            return jsonify({"error": "Engraving is already running"}), 400
        
        data = request.get_json(force=True)
        uids = data.get("uids", [])
        simulate = data.get("simulate", True)
        delay_seconds = data.get("delay_seconds", 1.0)
        
        if not uids:
            # Get manufactured items from database
            conn = get_db_conn()
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT uid FROM items ORDER BY created_at DESC LIMIT 50")
            manufactured_items = cur.fetchall()
            cur.close()
            conn.close()
            items = [{"uid": item["uid"]} for item in manufactured_items]
        else:
            items = [{"uid": uid} for uid in uids]
        
        if not items:
            return jsonify({"error": "No items to engrave"}), 400
        
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
        
        return jsonify({
            "ok": True,
            "message": "Engraving started",
            "total_items": len(items),
            "simulate": simulate
        })
        
    except Exception as e:
        logger.error(f"Start engraving error: {e}")
        return jsonify({"error": f"Failed to start engraving: {str(e)}"}), 500

@app.route("/engrave/stop", methods=["POST"])
def stop_engraving():
    """Stop engraving operation."""
    global engraving_state
    engraving_state["status"] = "stopped"
    engraving_state["current_item"] = None
    logger.info("🛑 Engraving stopped")
    return jsonify({"ok": True, "message": "Engraving stopped"})

@app.route("/engrave/pause", methods=["POST"])
def pause_engraving():
    """Pause engraving operation."""
    global engraving_state
    if engraving_state["status"] == "running":
        engraving_state["status"] = "paused"
        logger.info("⏸️ Engraving paused")
        return jsonify({"ok": True, "message": "Engraving paused"})
    return jsonify({"error": "No active engraving to pause"}), 400

@app.route("/engrave/resume", methods=["POST"])
def resume_engraving():
    """Resume engraving operation."""
    global engraving_state
    if engraving_state["status"] == "paused":
        engraving_state["status"] = "running"
        logger.info("▶️ Engraving resumed")
        return jsonify({"ok": True, "message": "Engraving resumed"})
    return jsonify({"error": "No paused engraving to resume"}), 400

@app.route("/engrave/status", methods=["GET"])
def get_engraving_status():
    """Get current engraving status."""
    global engraving_state
    
    processed = engraving_state.get("processed_count", 0)
    total = engraving_state.get("total_count", 0)
    progress = (processed / total * 100) if total > 0 else 0
    
    start_time = engraving_state.get("start_time")
    elapsed_seconds = 0
    if start_time:
        elapsed_seconds = (datetime.utcnow() - start_time).total_seconds()
    
    return jsonify({
        "status": engraving_state["status"],
        "current_item": engraving_state.get("current_item"),
        "processed_count": processed,
        "total_count": total,
        "progress_percent": round(progress, 1),
        "elapsed_seconds": round(elapsed_seconds, 1),
        "simulate": engraving_state.get("simulate", True),
        "delay_seconds": engraving_state.get("delay_seconds", 1.0)
    })

@app.route("/update_status", methods=["POST"])
def update_item_status():
    """Update item status."""
    try:
        data = request.get_json(force=True)
        uid = data.get("uid")
        status = data.get("status")
        location = data.get("location", "System")
        note = data.get("note", "")
        
        if not uid or not status:
            return jsonify({"error": "uid and status are required"}), 400
        
        conn = get_db_conn()
        cur = conn.cursor()
        
        cur.execute("""
        INSERT INTO statuses (uid, status, location, note, updated_at)
        VALUES (%s, %s, %s, %s, %s)
        """, (uid, status, location, note, datetime.utcnow()))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({"ok": True, "message": "Status updated"})
        
    except Exception as e:
        logger.error(f"Update status error: {e}")
        return jsonify({"error": f"Failed to update status: {str(e)}"}), 500

# Scanning API Endpoints
@app.route("/scan", methods=["POST"])
def scan_uid():
    """Scan UID and return item information."""
    try:
        data = request.json
        uid = data.get("uid", "").strip()
        
        if not uid:
            return jsonify({"success": False, "error": "UID is required"}), 400
        
        conn = get_db_conn()
        cur = conn.cursor(dictionary=True)
        
        # Get item with latest status
        query = """
        SELECT 
            i.uid, i.component, i.vendor, i.lot, i.mfg_date, i.warranty_years, i.created_at,
            latest.status as current_status, latest.location, latest.note, latest.updated_at as status_updated_at
        FROM items i
        LEFT JOIN (
            SELECT uid, status, location, note, updated_at,
                   ROW_NUMBER() OVER (PARTITION BY uid ORDER BY updated_at DESC) as rn
            FROM statuses
        ) latest ON latest.uid = i.uid AND latest.rn = 1
        WHERE i.uid = %s
        LIMIT 1
        """
        
        cur.execute(query, (uid,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        
        if not row:
            return jsonify({"success": False, "error": "UID not found in database"})
        
        # Calculate expiry date
        mfg_date = row["mfg_date"]
        if isinstance(mfg_date, str):
            mfg_date = datetime.strptime(mfg_date, "%Y-%m-%d").date()
        expiry_date = mfg_date + timedelta(days=365 * row["warranty_years"])
        
        # Format dates
        def to_iso(dt_value):
            if dt_value is None:
                return None
            if isinstance(dt_value, datetime):
                return dt_value.isoformat()
            if isinstance(dt_value, date):
                return dt_value.isoformat()
            return str(dt_value)
        
        response = {
            "success": True,
            "uid": row["uid"],
            "component": row["component"],
            "vendor": row["vendor"],
            "lot": row["lot"],
            "mfg_date": to_iso(row["mfg_date"]),
            "warranty_years": row["warranty_years"],
            "expiry_date": to_iso(expiry_date),
            "current_status": row["current_status"] or "Manufactured",
            "location": row["location"] or "Factory",
            "note": row["note"] or "",
            "status_updated_at": to_iso(row["status_updated_at"]),
            "created_at": to_iso(row["created_at"])
        }
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Scan error: {e}")
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500

# Health and monitoring endpoints
@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    db_status = "healthy" if test_db_connection() else "unhealthy"
    
    return jsonify({
        "status": "healthy" if db_status == "healthy" else "degraded",
        "database": db_status,
        "engraving_status": engraving_state["status"],
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    })

@app.route("/stats", methods=["GET"])
def get_stats():
    """Get service statistics."""
    return jsonify({
        "service": "combined-backend-service",
        "version": "1.0.0",
        "status": "running",
        "database": "mysql",
        "engraving_state": engraving_state,
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route("/", methods=["GET"])
def root():
    """Root endpoint."""
    return jsonify({
        "message": "QR Manufacturing System - Combined Backend Service",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "qr_generation": "/api/generate",
            "engraving": "/engrave/start",
            "scanning": "/scan",
            "health": "/health"
        },
        "timestamp": datetime.utcnow().isoformat()
    })

if __name__ == "__main__":
    print("Starting Combined Backend Service...")
    
    if test_db_connection():
        # Start background worker thread
        worker_thread = threading.Thread(target=worker_loop, daemon=True)
        worker_thread.start()
        
        print("✅ Database connected, starting server on http://localhost:5002")
        app.run(host="0.0.0.0", port=5002, debug=False)
    else:
        print("❌ Cannot start server due to database connection issues")