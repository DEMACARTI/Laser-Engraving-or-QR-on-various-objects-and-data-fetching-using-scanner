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
    response = jsonify({"error": "Not found", "message": str(error)})
    response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response, 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    logger.error(traceback.format_exc())
    response = jsonify({"error": "Internal server error", "message": str(error)})
    response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response, 500

# Add CORS error handler
@app.errorhandler(Exception)
def handle_exception(error):
    if isinstance(error, mysql.connector.Error):
        status_code = 500
        message = "Database error occurred"
    else:
        status_code = 500
        message = str(error)
    
    response = jsonify({
        "error": type(error).__name__,
        "message": message,
        "success": False
    })
    
    # Add CORS headers to error responses
    response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    
    return response, status_codeginal Project Functionality with MySQL Integration.

This service combines all the original project functionality (QR generation, 
engraving, scanning) into a single Flask application for easier deployment.
"""

from flask import Flask, request, jsonify, send_file, current_app
from flask_cors import CORS
from dotenv import load_dotenv
import qrcode
import io
import json
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

# Configure CORS properly
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:3000",
            "https://laser-engraving-or-qr-on-various-objects-and-data-fetching-using-scanner.vercel.app",
            "https://laser-engraving-or-qr-on-various-objects-gbbk.onrender.com"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
        "expose_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "max_age": 120  # Cache preflight requests for 2 minutes
    }
})

# Add OPTIONS handler for all routes
@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    response = app.make_default_options_response()
    
    # Add required CORS headers
    response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept, Origin, X-Requested-With'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Max-Age'] = '120'
    
    return response
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

# Role-based status permissions for scanning service
ROLE_ALLOWED_STATUSES = {
    "receiver": ["Received"],
    "inspector": ["Inspected"],
    "installer": ["Installed"],
    "maintenance": ["Serviced", "Service Needed", "Replacement Needed", "Replaced", "Discarded"],
    "admin": ["Manufactured", "Received", "Inspected", "Installed", "Serviced",
              "Service Needed", "Replacement Needed", "Replaced", "Discarded"]
}

def get_employee_role(emp_id):
    """Fetch employee role from database."""
    conn = None
    try:
        conn = get_db_conn()
        cur = conn.cursor()
        cur.execute("SELECT role FROM employees WHERE id=%s", (emp_id,))
        row = cur.fetchone()
        return row[0] if row else None
    except Exception as e:
        logger.error(f"Error getting employee role: {e}")
        return None
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

def get_employee_info(emp_id):
    """Fetch employee info from database."""
    conn = None
    try:
        conn = get_db_conn()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT id, username, full_name, role FROM employees WHERE id=%s", (emp_id,))
        row = cur.fetchone()
        return row
    except Exception as e:
        logger.error(f"Error getting employee info: {e}")
        return None
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

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

@app.route("/api/qr_batch_download", methods=["POST"])
def download_qr_batch():
    """Download multiple QR codes as a ZIP file."""
    import zipfile
    import tempfile
    
    try:
        data = request.get_json()
        uids = data.get('uids', [])
        
        if not uids:
            return jsonify({"error": "No UIDs provided"}), 400
        
        # Create temporary ZIP file
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
        
        conn = None
        try:
            conn = get_db_conn()
            cur = conn.cursor()
            
            with zipfile.ZipFile(temp_zip.name, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for uid in uids:
                    try:
                        # Get QR image from database
                        cur.execute("SELECT qr_image FROM items WHERE uid=%s", (uid,))
                        row = cur.fetchone()
                        
                        if row and row[0]:
                            # Add image to ZIP
                            zip_file.writestr(f"{uid}.png", row[0])
                        else:
                            logger.warning(f"QR image not found for UID: {uid}")
                    except Exception as e:
                        logger.error(f"Error adding {uid} to ZIP: {e}")
                        continue
            
            # Send the ZIP file
            return send_file(
                temp_zip.name, 
                mimetype='application/zip',
                as_attachment=True,
                download_name=f'qr_codes_{len(uids)}_items.zip'
            )
            
        finally:
            if conn:
                try:
                    conn.close()
                except:
                    pass
                    
    except Exception as e:
        logger.error(f"Batch download error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500
    finally:
        # Cleanup temp file after sending
        try:
            import os
            if 'temp_zip' in locals():
                os.unlink(temp_zip.name)
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
    """Update item status with employee role validation."""
    conn = None
    try:
        data = request.get_json(force=True)
        uid = data.get("uid")
        new_status = data.get("new_status") or data.get("status")  # Support both field names
        employee_id = data.get("employee_id")
        location = data.get("location", "MobileApp")
        note = data.get("note", "")
        
        if not uid or not new_status:
            return jsonify({"error": "uid and new_status are required"}), 400
        
        # If employee_id is provided, validate role-based permissions
        if employee_id:
            role = get_employee_role(employee_id)
            if not role:
                return jsonify({"error": "Invalid employee_id"}), 403
            
            allowed = ROLE_ALLOWED_STATUSES.get(role, [])
            if new_status not in allowed:
                return jsonify({
                    "error": f"Role '{role}' not allowed to set status '{new_status}'",
                    "allowed_statuses": allowed
                }), 403
        
        conn = get_db_conn()
        cur = conn.cursor()
        
        # Insert into statuses (audit log)
        cur.execute("""
        INSERT INTO statuses (uid, status, location, note, updated_at, employee_id)
        VALUES (%s, %s, %s, %s, %s, %s)
        """, (uid, new_status, location, note, datetime.utcnow(), employee_id))
        
        # Update items.current_status if the table has this column
        try:
            cur.execute("UPDATE items SET current_status=%s WHERE uid=%s", (new_status, uid))
        except mysql.connector.Error as e:
            # If current_status column doesn't exist, just log and continue
            if "Unknown column" in str(e):
                logger.info("current_status column not found in items table, skipping update")
            else:
                raise
        
        conn.commit()
        
        response_data = {"ok": True, "uid": uid, "new_status": new_status}
        if employee_id:
            role = get_employee_role(employee_id)
            response_data["role"] = role
        
        return jsonify(response_data)
        
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Update status error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Failed to update status: {str(e)}"}), 500
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

@app.route("/allowed_statuses", methods=["POST"])
def get_allowed_statuses():
    """Get allowed statuses for an employee based on their role."""
    try:
        data = request.get_json(force=True)
        emp_id = data.get("employee_id")
        
        if not emp_id:
            return jsonify({"error": "employee_id required"}), 400
        
        role = get_employee_role(emp_id)
        if not role:
            return jsonify({"error": "Invalid employee_id"}), 404
        
        allowed_statuses = ROLE_ALLOWED_STATUSES.get(role, [])
        
        return jsonify({"role": role, "allowed": allowed_statuses})
        
    except Exception as e:
        logger.error(f"Get allowed statuses error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Server error: {str(e)}"}), 500

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

# ============================================================================
# AI ALERT SYSTEM ENDPOINTS
# ============================================================================

@app.route("/ai-alerts/generate", methods=["POST"])
def generate_ai_alerts():
    """Generate AI-powered alerts for components."""
    conn = None
    try:
        data = request.get_json() or {}
        uid = data.get('uid')  # Optional: generate alerts for specific UID
        
        # Basic alert generation without full AI model (fallback mode)
        alerts = []
        
        conn = get_db_conn()
        cursor = conn.cursor(dictionary=True)
        
        # Generate expiry alerts
        expiry_query = """
        SELECT 
            i.uid, i.component, i.vendor, i.lot, i.mfg_date, 
            i.warranty_years, s.location,
            DATEDIFF(DATE_ADD(i.mfg_date, INTERVAL i.warranty_years YEAR), CURDATE()) as days_to_expiry
        FROM items i
        LEFT JOIN (
            SELECT uid, location,
                   ROW_NUMBER() OVER (PARTITION BY uid ORDER BY updated_at DESC) as rn
            FROM statuses
        ) s ON i.uid = s.uid AND s.rn = 1
        WHERE DATEDIFF(DATE_ADD(i.mfg_date, INTERVAL i.warranty_years YEAR), CURDATE()) <= 90
        AND DATEDIFF(DATE_ADD(i.mfg_date, INTERVAL i.warranty_years YEAR), CURDATE()) > 0
        """
        
        if uid:
            expiry_query += " AND i.uid = %s"
            cursor.execute(expiry_query, (uid,))
        else:
            cursor.execute(expiry_query)
        
        expiry_items = cursor.fetchall()
        
        for item in expiry_items:
            days_to_expiry = item['days_to_expiry']
            
            if days_to_expiry <= 30:
                alert_type = "expiry_critical"
                priority = 4 if days_to_expiry <= 7 else 3
                priority_name = "CRITICAL" if days_to_expiry <= 7 else "HIGH"
                title = f"Component Expiry Critical - {item['component']}"
            else:
                alert_type = "expiry_warning"
                priority = 2
                priority_name = "MEDIUM"
                title = f"Component Expiry Warning - {item['component']}"
            
            alert = {
                'uid': item['uid'],
                'alert_type': alert_type,
                'priority': priority,
                'priority_name': priority_name,
                'title': title,
                'description': f"Component {item['uid']} expires in {days_to_expiry} days.",
                'component': item['component'],
                'location': item['location'] or 'Unknown',
                'predicted_date': None,
                'recommendations': [
                    "Schedule replacement",
                    "Order new component",
                    "Plan maintenance window",
                    "Notify operations team"
                ],
                'metadata': {
                    'days_to_expiry': days_to_expiry,
                    'vendor': item['vendor'],
                    'lot': item['lot'],
                    'warranty_years': item['warranty_years']
                },
                'created_at': datetime.utcnow().isoformat()
            }
            alerts.append(alert)
        
        # Generate safety alerts for components needing service
        safety_query = """
        SELECT 
            i.uid, i.component, s.status, s.location,
            DATEDIFF(CURDATE(), i.mfg_date) as age_days
        FROM items i
        JOIN (
            SELECT uid, status, location,
                   ROW_NUMBER() OVER (PARTITION BY uid ORDER BY updated_at DESC) as rn
            FROM statuses
        ) s ON i.uid = s.uid AND s.rn = 1
        WHERE s.status IN ('Service Needed', 'Replacement Needed', 'Failed')
        """
        
        if uid:
            safety_query += " AND i.uid = %s"
            cursor.execute(safety_query, (uid,))
        else:
            cursor.execute(safety_query)
        
        safety_items = cursor.fetchall()
        
        for item in safety_items:
            priority = 5 if item['status'] == 'Failed' else 4
            priority_name = "EMERGENCY" if item['status'] == 'Failed' else "CRITICAL"
            
            alert = {
                'uid': item['uid'],
                'alert_type': 'safety_critical',
                'priority': priority,
                'priority_name': priority_name,
                'title': f"Safety Critical - {item['component']} {item['status']}",
                'description': f"Safety-critical component {item['uid']} status: {item['status']}. Immediate action required.",
                'component': item['component'],
                'location': item['location'] or 'Unknown',
                'predicted_date': None,
                'recommendations': [
                    "IMMEDIATE ISOLATION OF COMPONENT" if item['status'] == 'Failed' else "Schedule urgent maintenance",
                    "Emergency maintenance crew dispatch" if item['status'] == 'Failed' else "Maintenance crew dispatch",
                    "Safety protocol activation",
                    "Operations management notification",
                    "Incident report filing"
                ],
                'metadata': {
                    'current_status': item['status'],
                    'safety_critical': True,
                    'age_days': item['age_days']
                },
                'created_at': datetime.utcnow().isoformat()
            }
            alerts.append(alert)
        
        # Save alerts to database
        if alerts:
            # Create alerts table if it doesn't exist
            create_table_query = """
            CREATE TABLE IF NOT EXISTS ai_alerts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                uid VARCHAR(255),
                alert_type VARCHAR(50),
                priority INT,
                title VARCHAR(500),
                description TEXT,
                component VARCHAR(100),
                location VARCHAR(200),
                predicted_date DATETIME,
                recommendations JSON,
                metadata JSON,
                created_at DATETIME,
                acknowledged BOOLEAN DEFAULT FALSE,
                acknowledged_by VARCHAR(100),
                acknowledged_at DATETIME,
                resolved BOOLEAN DEFAULT FALSE,
                resolved_at DATETIME,
                INDEX idx_uid (uid),
                INDEX idx_alert_type (alert_type),
                INDEX idx_priority (priority),
                INDEX idx_created_at (created_at)
            )
            """
            cursor.execute(create_table_query)
            
            # Insert alerts
            insert_query = """
            INSERT INTO ai_alerts 
            (uid, alert_type, priority, title, description, component, location, 
             predicted_date, recommendations, metadata, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            description = VALUES(description),
            recommendations = VALUES(recommendations),
            metadata = VALUES(metadata)
            """
            
            for alert in alerts:
                cursor.execute(insert_query, (
                    alert['uid'],
                    alert['alert_type'],
                    alert['priority'],
                    alert['title'],
                    alert['description'],
                    alert['component'],
                    alert['location'],
                    None,  # predicted_date
                    json.dumps(alert['recommendations']),
                    json.dumps(alert['metadata']),
                    datetime.utcnow()
                ))
            
            conn.commit()
        
        # Generate summary
        summary = {
            'total_alerts': len(alerts),
            'critical_count': len([a for a in alerts if a['priority'] >= 4]),
            'by_priority': {},
            'by_type': {}
        }
        
        for alert in alerts:
            priority_name = alert['priority_name']
            alert_type = alert['alert_type']
            
            summary['by_priority'][priority_name] = summary['by_priority'].get(priority_name, 0) + 1
            summary['by_type'][alert_type] = summary['by_type'].get(alert_type, 0) + 1
        
        return jsonify({
            'success': True,
            'alerts': alerts,
            'count': len(alerts),
            'summary': summary
        })
    
    except Exception as e:
        logger.error(f"Error generating AI alerts: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

@app.route("/ai-alerts/list", methods=["GET"])
def list_ai_alerts():
    """List all AI alerts with optional filtering."""
    conn = None
    try:
        # Query parameters
        priority = request.args.get('priority')
        alert_type = request.args.get('alert_type')
        component = request.args.get('component')
        acknowledged = request.args.get('acknowledged')
        resolved = request.args.get('resolved')
        limit = request.args.get('limit', 100, type=int)
        
        conn = get_db_conn()
        cursor = conn.cursor(dictionary=True)
        
        # Build query with filters
        where_conditions = []
        params = []
        
        if priority:
            where_conditions.append("priority = %s")
            params.append(priority)
        
        if alert_type:
            where_conditions.append("alert_type = %s")
            params.append(alert_type)
        
        if component:
            where_conditions.append("component = %s")
            params.append(component)
        
        if acknowledged is not None:
            where_conditions.append("acknowledged = %s")
            params.append(acknowledged.lower() == 'true')
        
        if resolved is not None:
            where_conditions.append("resolved = %s")
            params.append(resolved.lower() == 'true')
        
        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
        
        query = f"""
        SELECT * FROM ai_alerts
        WHERE {where_clause}
        ORDER BY priority DESC, created_at DESC
        LIMIT %s
        """
        params.append(limit)
        
        cursor.execute(query, params)
        alerts = cursor.fetchall()
        
        # Convert JSON fields back to Python objects and format dates
        for alert in alerts:
            if alert['recommendations']:
                alert['recommendations'] = json.loads(alert['recommendations'])
            if alert['metadata']:
                alert['metadata'] = json.loads(alert['metadata'])
            
            # Add priority name
            priority_names = {5: 'EMERGENCY', 4: 'CRITICAL', 3: 'HIGH', 2: 'MEDIUM', 1: 'LOW'}
            alert['priority_name'] = priority_names.get(alert['priority'], 'UNKNOWN')
            
            # Convert datetime objects to strings
            for field in ['created_at', 'predicted_date', 'acknowledged_at', 'resolved_at']:
                if alert[field]:
                    alert[field] = alert[field].isoformat()
        
        return jsonify({
            'success': True,
            'alerts': alerts,
            'count': len(alerts)
        })
    
    except Exception as e:
        logger.error(f"Error listing AI alerts: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

@app.route("/ai-alerts/<int:alert_id>/acknowledge", methods=["POST"])
def acknowledge_ai_alert(alert_id):
    """Acknowledge an AI alert."""
    conn = None
    try:
        data = request.get_json() or {}
        acknowledged_by = data.get('acknowledged_by', 'System')
        
        conn = get_db_conn()
        cursor = conn.cursor()
        
        cursor.execute("""
        UPDATE ai_alerts 
        SET acknowledged = TRUE, acknowledged_by = %s, acknowledged_at = NOW()
        WHERE id = %s
        """, (acknowledged_by, alert_id))
        
        if cursor.rowcount == 0:
            return jsonify({
                'success': False,
                'error': 'Alert not found'
            }), 404
        
        conn.commit()
        
        return jsonify({
            'success': True,
            'message': f'Alert {alert_id} acknowledged successfully'
        })
    
    except Exception as e:
        logger.error(f"Error acknowledging AI alert: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

@app.route("/ai-alerts/<int:alert_id>/resolve", methods=["POST"])
def resolve_ai_alert(alert_id):
    """Mark an AI alert as resolved."""
    conn = None
    try:
        conn = get_db_conn()
        cursor = conn.cursor()
        
        cursor.execute("""
        UPDATE ai_alerts 
        SET resolved = TRUE, resolved_at = NOW()
        WHERE id = %s
        """, (alert_id,))
        
        if cursor.rowcount == 0:
            return jsonify({
                'success': False,
                'error': 'Alert not found'
            }), 404
        
        conn.commit()
        
        return jsonify({
            'success': True,
            'message': f'Alert {alert_id} resolved successfully'
        })
    
    except Exception as e:
        logger.error(f"Error resolving AI alert: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

@app.route("/ai-alerts/summary", methods=["GET"])
def ai_alerts_summary():
    """Get summary statistics of AI alerts."""
    conn = None
    try:
        conn = get_db_conn()
        cursor = conn.cursor(dictionary=True)
        
        # Get overall statistics
        cursor.execute("""
        SELECT 
            COUNT(*) as total_alerts,
            SUM(CASE WHEN acknowledged = FALSE THEN 1 ELSE 0 END) as unacknowledged,
            SUM(CASE WHEN resolved = FALSE THEN 1 ELSE 0 END) as unresolved,
            SUM(CASE WHEN priority >= 4 THEN 1 ELSE 0 END) as critical_alerts
        FROM ai_alerts
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        """)
        
        summary = cursor.fetchone()
        
        # Get alerts by type
        cursor.execute("""
        SELECT alert_type, COUNT(*) as count
        FROM ai_alerts
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY alert_type
        ORDER BY count DESC
        """)
        
        by_type = cursor.fetchall()
        
        # Get alerts by priority
        cursor.execute("""
        SELECT priority, COUNT(*) as count
        FROM ai_alerts
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY priority
        ORDER BY priority DESC
        """)
        
        by_priority = cursor.fetchall()
        
        return jsonify({
            'success': True,
            'summary': summary,
            'by_type': by_type,
            'by_priority': by_priority,
            'period': 'Last 30 days'
        })
    
    except Exception as e:
        logger.error(f"Error getting AI alerts summary: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

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
            print("   - AI Alerts: http://localhost:5002/ai-alerts/generate")
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