"""
scanning_service.py

Flask backend for QR scanning workflow:
- Accepts a scanned UID.
- Fetches item info from 'items' and the latest status from 'statuses'.
- Computes expiry date as mfg_date + warranty_years.
"""

import os
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
import mysql.connector

# ---------------- CONFIG ----------------
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': int(os.environ.get('DB_PORT', 3306)),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASS', 'alqawwiy'),
    'database': os.environ.get('DB_NAME', 'sih_qr_db')
}

def get_db_conn():
    return mysql.connector.connect(**DB_CONFIG)

# ---------------- FLASK APP ----------------
app = Flask(__name__)

# ---------------- ROUTES ----------------
@app.route("/scan", methods=["POST"])
def scan_uid():
    """
    Body: { "uid": "UID-0001" }
    Response: item details + latest status + expiry_date
    """
    body = request.get_json(force=True)
    uid = body.get("uid")
    if not uid:
        return jsonify({"error": "Missing uid"}), 400

    sql = """
    SELECT
      i.uid,
      i.component,
      i.vendor,
      i.lot,
      i.mfg_date,
      i.warranty_years,
      DATE_ADD(i.mfg_date, INTERVAL COALESCE(i.warranty_years,0) YEAR) AS expiry_date,
      latest.status AS current_status,
      latest.updated_at AS status_updated_at
    FROM items i
    LEFT JOIN (
      SELECT s1.uid, s1.status, s1.updated_at
      FROM statuses s1
      JOIN (
        SELECT uid, MAX(updated_at) AS mu
        FROM statuses
        GROUP BY uid
      ) s2 ON s1.uid = s2.uid AND s1.updated_at = s2.mu
    ) latest ON latest.uid = i.uid
    WHERE i.uid = %s
    LIMIT 1
    """

    conn = None
    try:
        conn = get_db_conn()
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, (uid,))
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            return jsonify({"ok": False, "error": "UID not found"}), 404

        # Format dates nicely
        def to_iso(dt_value):
            if dt_value is None:
                return None
            if isinstance(dt_value, (datetime,)):
                return dt_value.isoformat(sep=" ")
            return str(dt_value)

        response = {
            "ok": True,
            "uid": row["uid"],
            "component": row["component"],
            "vendor": row["vendor"],
            "lot": row["lot"],
            "mfg_date": to_iso(row["mfg_date"]),
            "warranty_years": row["warranty_years"],
            "expiry_date": to_iso(row["expiry_date"]),
            "current_status": row["current_status"],
            "status_updated_at": to_iso(row["status_updated_at"])
        }
        return jsonify(response)

    except Exception as e:
        if conn:
            conn.close()
        return jsonify({"ok": False, "error": str(e)}), 500

# ---------------- RUN SERVER ----------------
if __name__ == "__main__":
    print("Starting scanning_service...")
    print("DB:", DB_CONFIG["host"], DB_CONFIG["database"])
    app.run(host="0.0.0.0", port=5001, debug=True)
