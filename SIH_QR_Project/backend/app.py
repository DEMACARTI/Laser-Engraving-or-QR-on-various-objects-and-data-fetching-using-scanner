from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import qrcode
import io
import mysql.connector
from datetime import datetime, date
from pathlib import Path

app = Flask(__name__)
CORS(app)

DB_CONFIG = {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "alqawwiy",
    "database": "sih_qr_db"
}

# Test database connection on startup
def test_db_connection():
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        conn.close()
        print("✅ Database connection successful")
        return True
    except mysql.connector.Error as e:
        print(f"❌ Database connection failed: {e}")
        return False

OUTPUT_DIR = Path("../qr_batch_output")
OUTPUT_DIR.mkdir(exist_ok=True)

# Helper to generate UID
def make_uid(component, vendor, lot, serial):
    return f"{component}-{vendor}-{lot}-{serial:05d}"

# Helper to generate QR code as bytes
def generate_qr_image_bytes(payload):
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

# API to get options for dropdowns
@app.route("/api/options", methods=["GET"])
def get_options():
    # In real app, fetch from DB or config
    components = ["ERC", "LINER", "PAD", "SLEEPER"]
    vendors = ["V010", "V011", "V012"]
    lots = ["L2025-09", "L2025-10", "L2025-11"]
    return jsonify({"components": components, "vendors": vendors, "lots": lots})

# API to generate QR and store in DB
@app.route("/api/generate", methods=["POST"])
def generate():
    data = request.json
    component = data.get("component")
    vendor = data.get("vendor")
    lot = data.get("lot")
    warranty_years = int(data.get("warranty_years", 5))
    count = int(data.get("count", 1))
    mfg_date = data.get("mfg_date") or date.today().isoformat()

    # Find next serial number
    conn = mysql.connector.connect(**DB_CONFIG)
    cur = conn.cursor()
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
        sql = """
        INSERT IGNORE INTO items
        (uid, component, vendor, lot, mfg_date, warranty_years, qr_path, qr_image, created_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """
        cur.execute(sql, (uid, component, vendor, lot, mfg_date, warranty_years, str(local_path), png_bytes, created_at))
        conn.commit()
        # Insert initial status
        cur.execute("""
        INSERT INTO statuses (uid, status, location, note, updated_at)
        VALUES (%s,%s,%s,%s,%s)
        """, (uid, "Manufactured", "Factory", "Initial QR generation", datetime.utcnow()))
        conn.commit()
        results.append({"uid": uid, "qr_path": str(local_path)})
    cur.close()
    conn.close()
    return jsonify({"success": True, "results": results})

# API to get manufactured items
@app.route("/items/manufactured", methods=["GET"])
def get_manufactured_items():
    limit = request.args.get('limit', 100, type=int)
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT uid, component, vendor, lot, mfg_date, warranty_years, qr_path, created_at
            FROM items 
            ORDER BY created_at DESC 
            LIMIT %s
        """, (limit,))
        items = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(items)
    except mysql.connector.Error as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500

# API to scan/lookup item by UID
@app.route("/scan", methods=["POST"])
def scan_uid():
    data = request.json
    uid = data.get("uid", "").strip()
    
    if not uid:
        return jsonify({"success": False, "error": "UID is required"}), 400
    
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cur = conn.cursor(dictionary=True)
        
        # Get item details
        cur.execute("""
            SELECT uid, component, vendor, lot, mfg_date, warranty_years, created_at
            FROM items 
            WHERE uid = %s
        """, (uid,))
        item = cur.fetchone()
        
        if not item:
            cur.close()
            conn.close()
            return jsonify({"success": False, "error": "UID not found in database"})
        
        # Get current status
        cur.execute("""
            SELECT status, location, note, updated_at
            FROM statuses 
            WHERE uid = %s 
            ORDER BY updated_at DESC 
            LIMIT 1
        """, (uid,))
        status = cur.fetchone()
        
        cur.close()
        conn.close()
        
        # Calculate expiry date
        from datetime import datetime, timedelta
        mfg_date = datetime.strptime(str(item['mfg_date']), '%Y-%m-%d')
        expiry_date = mfg_date + timedelta(days=365 * item['warranty_years'])
        
        # Format response to match expected frontend format
        response_item = {
            "uid": item["uid"],
            "component": item["component"],
            "vendor": item["vendor"],
            "lot": item["lot"],
            "mfg_date": str(item["mfg_date"]),
            "warranty_years": item["warranty_years"],
            "expiry_date": expiry_date.strftime('%Y-%m-%d'),
            "current_status": status["status"] if status else "Unknown",
            "status_updated_at": str(status["updated_at"]) if status else "Unknown",
            "location": status["location"] if status else "Unknown"
        }
        
        return jsonify({"success": True, "item": response_item})
        
    except mysql.connector.Error as e:
        return jsonify({"success": False, "error": f"Database error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500

# API to get QR image by UID
@app.route("/api/qr/<uid>", methods=["GET"])
def get_qr(uid):
    path = OUTPUT_DIR / f"{uid}.png"
    if not path.exists():
        return jsonify({"error": "QR not found"}), 404
    return send_file(str(path), mimetype="image/png")

if __name__ == "__main__":
    print("Starting Flask server...")
    if test_db_connection():
        print("Starting server on http://localhost:5001")
        app.run(host="0.0.0.0", port=5001, debug=False)  # Disable debug mode to avoid watchdog issues
    else:
        print("Cannot start server due to database connection issues")
