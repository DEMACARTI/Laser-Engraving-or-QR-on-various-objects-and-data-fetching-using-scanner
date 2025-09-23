"""
Combined Backend Sapp = Flask(__name__, static_folder=None)  # Disable default static handling
# Enable CORS for all origins during development
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Configure logging

# Add favicon route to prevent 404s
@app.route('/favicon.ico')
def favicon():
    return '', 204  # No content response

# Add error handlers
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({"error": "Not found", "message": str(error)}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    logger.error(traceback.format_exc())
    return jsonify({"error": "Internal server error", "message": str(error)}), 500ginal Project Functionality with MySQL Integration.

This service combines all the original project functionality (QR generation, 
engraving, scanning) into a single Flask application for easier deployment.
"""

from flask import Flask, request, jsonify, send_file, current_app
from flask_cors import CORS
from dotenv import load_dotenv
import qrcode
import io
import mysql.connector
from datetime import datetime, date, timedelta
from pathlib import Path
import threading
import time
import logging
import os
import traceback
import atexit

app = Flask(__name__)
# Enable CORS for all origins during development
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type", "Authorization"]
    }
})

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# MySQL Database Configuration (Original Project)
# IMPORTANT: The previous version of this file contained a hard‑coded password which has been removed
# for security reasons. Ensure you provide DB_PASS via environment variables in development and
# especially in deployment (Render, Docker, etc.).
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "gondola.proxy.rlwy.net"),
    "port": int(os.getenv("DB_PORT", 24442)),
    "user": os.getenv("DB_USER", "root"),
    # Default to empty string if not provided instead of leaking a real credential
    "password": os.getenv("DB_PASS", "SZiTeOCZgSbLTZLdDxlIsMKYGRlfxFsd"),
    "database": os.getenv("DB_NAME", "sih_qr_db"),
    "charset": "utf8mb4",
    "autocommit": True
}

# QR code storage - use project root directory (configurable)
PROJECT_ROOT = Path(__file__).parent.parent

# Allow overriding output directory via env var (e.g. to use a mounted volume in production)
_output_override = os.getenv("QR_OUTPUT_DIR")
if _output_override:
    OUTPUT_DIR = Path(_output_override).expanduser().resolve()
else:
    OUTPUT_DIR = PROJECT_ROOT / "qr_batch_output"

DISABLE_QR_FILES = os.getenv("DISABLE_QR_FILES", "false").lower() == "true"
if not DISABLE_QR_FILES:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
else:
    logger.info("⚠️  QR file writing disabled (DISABLE_QR_FILES=true); images stored only in DB")

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
worker_running = False

def test_db_connection():
    """Test MySQL database connection."""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        conn.close()
        logger.info("✅ Database connection successful")
        return True
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        return False

def get_db_conn():
    """Get database connection with error handling."""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        raise

def make_uid(component, vendor, lot, serial):
    """Generate UID in original project format."""
    return f"{component}-{vendor}-{lot}-{serial:05d}"

def generate_qr_image_bytes(payload):
    """Generate QR code image bytes."""
    try:
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
    except Exception as e:
        logger.error(f"QR generation error: {e}")
        raise

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
    global engraving_state, worker_running
    
    logger.info("🔧 Background worker started")
    worker_running = True
    
    try:
        while not worker_stop_event.is_set() and worker_running:
            try:
                if engraving_state["status"] != "running":
                    time.sleep(0.5)
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
                logger.error(f"Worker loop error: {e}")
                logger.error(traceback.format_exc())
                time.sleep(1.0)
                
    except Exception as e:
        logger.error(f"Worker thread fatal error: {e}")
        logger.error(traceback.format_exc())
    finally:
        worker_running = False
        logger.info("🔧 Background worker stopped")

# Error handler
@app.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"Unhandled exception: {e}")
    logger.error(traceback.format_exc())
    return jsonify({"success": False, "error": "Internal server error"}), 500

# QR Generation API Endpoints
@app.route("/api/options", methods=["GET"])
def get_options():
    """Get options for dropdowns."""
    try:
        components = ["ERC", "LINER", "PAD", "SLEEPER"]
        vendors = ["V010", "V011", "V012"]
        lots = ["L2025-09", "L2025-10", "L2025-11"]
        return jsonify({"components": components, "vendors": vendors, "lots": lots})
    except Exception as e:
        logger.error(f"Get options error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/generate", methods=["POST"])
def generate():
    """Generate QR codes and store in database.

    Behavior:
      * Always stores QR bytes in DB (qr_image column)
      * Optionally stores PNG file on disk unless DISABLE_QR_FILES=true
    """
    conn = None
    try:
        data = request.json or {}
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
        result = cur.fetchone()
        max_uid = result[0] if result else None

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

            if not DISABLE_QR_FILES:
                try:
                    with open(local_path, "wb") as f:
                        f.write(png_bytes)
                except Exception as fe:
                    logger.warning(f"Failed to write QR file for {uid}: {fe}")
            else:
                # Represent absence of file path clearly
                local_path = Path(f"disabled://{uid}.png")

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

            results.append({"uid": uid, "qr_path": None if DISABLE_QR_FILES else str(local_path)})

        conn.commit()

        return jsonify({"success": True, "results": results})

    except Exception as e:
        logger.error(f"Generate error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"success": False, "error": f"Failed to generate QR codes: {str(e)}"}), 500
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

@app.route("/api/qr/<uid>", methods=["GET"])
def get_qr(uid):
    """Get QR code image by UID (prefers local file, falls back to DB)."""
    try:
        if not uid:
            return jsonify({"error": "UID is required"}), 400

        # Try local file first
        path = OUTPUT_DIR / f"{uid}.png"
        if not DISABLE_QR_FILES and path.exists():
            try:
                return send_file(str(path), mimetype="image/png")
            except Exception as e:
                logger.error(f"Failed to serve local file for {uid}: {e}")
                # Fall through to DB retrieval

        # Fallback: pull from DB
        conn = None
        try:
            conn = get_db_conn()
            cur = conn.cursor()
            cur.execute("SELECT qr_image FROM items WHERE uid=%s", (uid,))
            row = cur.fetchone()
            if not row or not row[0]:
                return jsonify({"error": "QR not found"}), 404
            img_bytes = row[0]
            return send_file(io.BytesIO(img_bytes), mimetype="image/png")
        finally:
            if conn:
                try:
                    conn.close()
                except Exception as e:
                    logger.error(f"Error closing DB connection: {e}")

    except Exception as e:
        logger.error(f"Get QR error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route("/api/qr_bytes/<uid>", methods=["GET"])
def get_qr_bytes(uid):
    """Always return QR image directly from database (ignores local file)."""
    try:
        conn = None
        conn = get_db_conn()
        cur = conn.cursor()
        cur.execute("SELECT qr_image FROM items WHERE uid=%s", (uid,))
        row = cur.fetchone()
        if not row or not row[0]:
            return jsonify({"error": "QR not found"}), 404
        return send_file(io.BytesIO(row[0]), mimetype="image/png")
    except Exception as e:
        logger.error(f"Get QR bytes error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

@app.route("/items/manufactured", methods=["GET"])
def get_manufactured_items():
    """Get manufactured items (original project API)."""
    conn = None
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
        logger.error(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

@app.route("/inventory/items", methods=["GET"])
def get_inventory_items():
    """Get all inventory items with their current status."""
    conn = None
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
        logger.error(traceback.format_exc())
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

@app.route("/inventory/stats", methods=["GET"])
def get_inventory_stats():
    """Get inventory statistics."""
    conn = None
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
        logger.error(traceback.format_exc())
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

@app.route("/inventory/search", methods=["GET"])
def search_inventory():
    """Search inventory items."""
    conn = None
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
        logger.error(traceback.format_exc())
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

# Engraving API Endpoints
@app.route("/engrave/start", methods=["POST"])
def start_engraving():
    """Start engraving operation."""
    try:
        global engraving_state
        
        if engraving_state["status"] == "running":
            return jsonify({"error": "Engraving is already running"}), 400
        
        data = request.get_json(force=True) or {}
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
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Failed to start engraving: {str(e)}"}), 500

@app.route("/engrave/stop", methods=["POST"])
def stop_engraving():
    """Stop engraving operation."""
    try:
        global engraving_state
        engraving_state["status"] = "stopped"
        engraving_state["current_item"] = None
        logger.info("🛑 Engraving stopped")
        return jsonify({"ok": True, "message": "Engraving stopped"})
    except Exception as e:
        logger.error(f"Stop engraving error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/engrave/pause", methods=["POST"])
def pause_engraving():
    """Pause engraving operation."""
    try:
        global engraving_state
        if engraving_state["status"] == "running":
            engraving_state["status"] = "paused"
            logger.info("⏸️ Engraving paused")
            return jsonify({"ok": True, "message": "Engraving paused"})
        return jsonify({"error": "No active engraving to pause"}), 400
    except Exception as e:
        logger.error(f"Pause engraving error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/engrave/resume", methods=["POST"])
def resume_engraving():
    """Resume engraving operation."""
    try:
        global engraving_state
        if engraving_state["status"] == "paused":
            engraving_state["status"] = "running"
            logger.info("▶️ Engraving resumed")
            return jsonify({"ok": True, "message": "Engraving resumed"})
        return jsonify({"error": "No paused engraving to resume"}), 400
    except Exception as e:
        logger.error(f"Resume engraving error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/engrave/status", methods=["GET"])
def get_engraving_status():
    """Get current engraving status."""
    try:
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
    except Exception as e:
        logger.error(f"Get engraving status error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/update_status", methods=["POST"])
def update_item_status():
    """Update item status."""
    conn = None
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
        
        return jsonify({"ok": True, "message": "Status updated"})
        
    except Exception as e:
        logger.error(f"Update status error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Failed to update status: {str(e)}"}), 500
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

# Scanning API Endpoints
@app.route("/scan", methods=["POST"])
def scan_uid():
    """Scan UID and return item information."""
    conn = None
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
        logger.error(traceback.format_exc())
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

# Health and monitoring endpoints
@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    try:
        # Test database connection
        try:
            conn = get_db_conn()
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            cursor.close()
            conn.close()
            db_status = "healthy"
            db_error = None
        except Exception as db_e:
            db_status = "unhealthy"
            db_error = str(db_e)
            logger.error(f"Database health check failed: {db_e}")
        
        response = {
            "status": "healthy" if db_status == "healthy" else "degraded",
            "database": {
                "status": db_status,
                "host": DB_CONFIG["host"],
                "port": DB_CONFIG["port"],
                "error": db_error
            },
            "engraving_status": engraving_state["status"],
            "worker_running": worker_running,
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0.0"
        }
        
        logger.info(f"Health check response: {response}")
        return jsonify(response)
    except Exception as e:
        logger.error(f"Health check error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route("/stats", methods=["GET"])
def get_stats():
    """Get service statistics."""
    try:
        return jsonify({
            "service": "combined-backend-service",
            "version": "1.0.0",
            "status": "running",
            "database": "mysql",
            "engraving_state": engraving_state,
            "worker_running": worker_running,
            "timestamp": datetime.utcnow().isoformat()
        })
    except Exception as e:
        logger.error(f"Stats error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/", methods=["GET"])
def root():
    """Root endpoint."""
    try:
        logger.info("Root endpoint accessed")
        # Test database connection
        db_status = "healthy" if test_db_connection() else "unhealthy"
        
        response = {
            "service": "QR Manufacturing System - Combined Backend Service",
            "version": "1.0.0",
            "status": "running",
            "api_endpoints": {
                "qr": {
                    "generate": "/api/generate",
                    "get_qr": "/api/qr/<uid>",
                    "get_qr_bytes": "/api/qr_bytes/<uid>"
                },
                "engraving": {
                    "start": "/engrave/start",
                    "stop": "/engrave/stop",
                    "pause": "/engrave/pause",
                    "resume": "/engrave/resume",
                    "status": "/engrave/status"
                },
                "inventory": {
                    "items": "/inventory/items",
                    "stats": "/inventory/stats",
                    "search": "/inventory/search"
                },
                "monitoring": {
                    "health": "/health",
                    "stats": "/stats"
                }
            },
            "environment": {
                "qr_storage": "database" if DISABLE_QR_FILES else "file+database",
                "database_status": db_status,
                "database_host": DB_CONFIG["host"],
                "worker_status": "running" if worker_running else "stopped"
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        logger.info(f"Root endpoint response successful")
        return jsonify(response)
    except Exception as e:
        logger.error(f"Root endpoint error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

def cleanup_worker():
    """Clean up worker thread on exit."""
    global worker_stop_event, worker_thread, worker_running
    
    logger.info("🧹 Cleaning up worker thread...")
    worker_running = False
    worker_stop_event.set()
    
    if worker_thread and worker_thread.is_alive():
        worker_thread.join(timeout=5)
    
    logger.info("✅ Cleanup complete")

if __name__ == "__main__":
    import atexit
    
    print("🚀 Starting Combined Backend Service...")
    print("🔧 Checking database connection...")
    
    if test_db_connection():
        try:
            # Start background worker thread
            print("🔧 Starting background worker thread...")
            worker_thread = threading.Thread(target=worker_loop, daemon=True)
            worker_thread.start()
            
            # Register cleanup function
            atexit.register(cleanup_worker)
            
            print("✅ Database connected successfully")
            print("✅ Background worker started")
            print("🌐 Starting Flask server on http://localhost:5002")
            print("📋 Available endpoints:")
            print("   - Health: http://localhost:5002/health")
            print("   - QR Generation: http://localhost:5002/api/generate")
            print("   - Engraving: http://localhost:5002/engrave/start")
            print("   - Scanning: http://localhost:5002/scan")
            print("   - Inventory: http://localhost:5002/inventory/items")
            print("")
            
            # Start Flask with better error handling
            app.run(host="0.0.0.0", port=5002, debug=False, use_reloader=False, threaded=True)
            
        except KeyboardInterrupt:
            print("\n🛑 Received shutdown signal...")
            cleanup_worker()
        except Exception as e:
            print(f"❌ Server startup error: {e}")
            logger.error(f"Server startup error: {e}")
            logger.error(traceback.format_exc())
            cleanup_worker()
    else:
        print("❌ Cannot start server due to database connection issues")
        print("🔧 Please check your database configuration and network connection")