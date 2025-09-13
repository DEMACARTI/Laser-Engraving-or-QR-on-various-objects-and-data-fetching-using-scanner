"""
app.py

Flask API for QR demo:
- Loads qr_batch_output/qr_metadata.csv (created by the QR generator script)
- Stores records into fittings_api.db (SQLite)
- Exposes endpoints to GET item metadata and POST status updates.

Run:
    python app.py

Notes:
- Ensure qr_batch_output/qr_metadata.csv exists (from previous QR generator step).
- This is a demo server for hackathon presentation; production needs auth, TLS, input validation, rate-limits.
"""

import os
import sqlite3
from pathlib import Path
from datetime import datetime
from flask import Flask, jsonify, request, abort
from flask_cors import CORS
import pandas as pd

# ---------------- CONFIG ----------------
CSV_PATH = Path("qr_batch_output/qr_metadata.csv")
DB_PATH = Path("fittings_api.db")
APP_HOST = "0.0.0.0"
APP_PORT = 5000
# ----------------------------------------

app = Flask(__name__)
CORS(app)

# ---------- DB helper functions ----------
def init_db_from_csv(csv_path=CSV_PATH, db_path=DB_PATH):
    """
    If DB doesn't exist, load CSV into SQLite and create a statuses table.
    If DB exists, do nothing.
    """
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}. Run QR generator first.")

    if db_path.exists():
        return  # DB already initialized

    # Read CSV using pandas for safety
    df = pd.read_csv(csv_path)

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Create items table
    cur.execute("""
    CREATE TABLE items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT UNIQUE,
        component TEXT,
        vendor TEXT,
        lot TEXT,
        mfg_date TEXT,
        warranty_years INTEGER,
        qr_path TEXT
    )
    """)

    # Insert CSV rows into items
    insert_q = """
    INSERT INTO items (uid, component, vendor, lot, mfg_date, warranty_years, qr_path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """
    for _, row in df.iterrows():
        cur.execute(insert_q, (
            row.get("UID") or row.get("uid"),
            row.get("Component") or row.get("component"),
            row.get("Vendor") or row.get("vendor"),
            row.get("Lot") or row.get("lot"),
            row.get("Mfg_Date") or row.get("mfg_date"),
            int(row.get("Warranty_Years") or row.get("warranty_years") or 0),
            row.get("QR_Path") or row.get("qr_path")
        ))

    # Create statuses table
    cur.execute("""
    CREATE TABLE statuses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT,
        status TEXT,
        location TEXT,
        note TEXT,
        updated_at TEXT
    )
    """)
    conn.commit()
    conn.close()
    print(f"[init] Created DB {db_path} from CSV {csv_path}")


def get_db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Initialize DB on startup
try:
    init_db_from_csv()
except FileNotFoundError as e:
    print("WARNING:", e)
    # We let server run so you can still create DB manually later, but endpoints depending on DB will error.
except Exception as e:
    print("ERROR initializing DB:", e)


# ---------- API endpoints ----------
@app.route("/api/item/<string:uid>", methods=["GET"])
def get_item(uid):
    """
    Return metadata and latest status for given UID.
    """
    conn = get_db_conn()
    cur = conn.cursor()

    cur.execute("SELECT * FROM items WHERE uid = ?", (uid,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "UID not found"}), 404

    item = dict(row)

    # Fetch latest status if any
    cur.execute("SELECT status, location, note, updated_at FROM statuses WHERE uid = ? ORDER BY updated_at DESC, id DESC LIMIT 1", (uid,))
    srow = cur.fetchone()
    if srow:
        item["latest_status"] = dict(srow)
    else:
        item["latest_status"] = None

    conn.close()
    return jsonify(item)


@app.route("/api/item/<string:uid>/status", methods=["POST"])
def update_status(uid):
    """
    Update status for given UID.
    JSON body example:
    {
      "status": "Received",
      "location": "Depot A",
      "note": "Qty OK, 1 piece missing"
    }
    """
    if not request.is_json:
        return jsonify({"error": "Expected JSON body"}), 400
    body = request.get_json()

    status = body.get("status")
    location = body.get("location", "")
    note = body.get("note", "")

    if not status:
        return jsonify({"error": "Missing 'status' in body"}), 400

    conn = get_db_conn()
    cur = conn.cursor()

    # verify UID exists
    cur.execute("SELECT 1 FROM items WHERE uid = ?", (uid,))
    if not cur.fetchone():
        conn.close()
        return jsonify({"error": "UID not found"}), 404

    updated_at = datetime.utcnow().isoformat()
    cur.execute("INSERT INTO statuses (uid, status, location, note, updated_at) VALUES (?, ?, ?, ?, ?)",
                (uid, status, location, note, updated_at))
    conn.commit()
    conn.close()

    return jsonify({"ok": True, "uid": uid, "status": status, "updated_at": updated_at})

##new
@app.route("/api/bundle/<string:bundle_id>", methods=["GET"])
def get_bundle(bundle_id):
    """
    Optional: If you created bundles table or a bundle CSV, implement retrieval here.
    For the demo we check if items table has many UIDs with that bundle prefix.
    Example bundle_id could be 'BUNDLE-ERC-V001-L2025-09-001' if you created bundle payloads.
    """
    conn = get_db_conn()
    cur = conn.cursor()
    # Simple heuristic: return items whose uid contains bundle_id substring or share same lot
    cur.execute("SELECT * FROM items WHERE uid LIKE ?", (f"%{bundle_id}%",))
    rows = cur.fetchall()
    if not rows:
        # fallback: try matching by lot portion if bundle_id is like 'BUNDLE-ERC-V001-L2025-09-001'
        # extract lot-like substring
        parts = bundle_id.split("-")
        if len(parts) >= 4:
            possible_lot = parts[3]  # may be L2025 or L2025-09
            cur.execute("SELECT * FROM items WHERE lot = ?", (possible_lot,))
            rows = cur.fetchall()

    if not rows:
        conn.close()
        return jsonify({"error": "Bundle not found or no matching items"}), 404

    items = [dict(r) for r in rows]
    conn.close()
    return jsonify({"bundle_id": bundle_id, "count": len(items), "items": items})


# Simple health check
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "db_exists": DB_PATH.exists()})


# ---------- Run server ----------
if __name__ == "__main__":
    print(f"Starting Flask server on http://{APP_HOST}:{APP_PORT} ...")
    app.run(host=APP_HOST, port=APP_PORT, debug=True)

@app.route("/api/item/<string:uid>/history", methods=["GET"])
def get_item_history(uid):
    """
    Return full status history (timeline) for a given UID.
    Example response:
    {
      "uid": "ERC-V001-L2025-09-00001",
      "history": [
        {"status":"Manufactured","location":"Factory","note":"Initial QR generation","updated_at":"2025-09-12T12:34:56"},
        {"status":"Received","location":"Depot A","note":"Batch checked","updated_at":"2025-09-13T09:21:33"},
        {"status":"Installed","location":"Track Section B","note":"Fitted successfully","updated_at":"2025-09-15T15:00:00"}
      ]
    }
    """
    conn = get_conn()
    cur = conn.cursor(dictionary=True)
    try:
        # Check if UID exists in items table
        cur.execute("SELECT 1 FROM items WHERE uid = %s", (uid,))
        if not cur.fetchone():
            return jsonify({"error": f"UID {uid} not found"}), 404

        # Fetch all statuses in chronological order
        cur.execute(
            "SELECT status, location, note, updated_at FROM statuses WHERE uid = %s ORDER BY updated_at ASC, id ASC",
            (uid,)
        )
        rows = cur.fetchall()
        return jsonify({"uid": uid, "history": rows})
    finally:
        cur.close()
        conn.close()
