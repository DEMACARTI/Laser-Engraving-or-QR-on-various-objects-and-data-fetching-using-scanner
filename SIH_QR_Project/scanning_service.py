"""
scanning_service.py

Features:
1) /scan → fetch QR info + expiry calculation
2) /allowed_statuses → check employee role & return allowed statuses
3) /update_status → update status with audit logging

DB: MySQL (sih_qr_db)
"""

from flask import Flask, request, jsonify
import mysql.connector
from datetime import datetime, timedelta

# ---------------- DB CONFIG ----------------
DB_CONFIG = {
    'host': '127.0.0.1',
    'user': 'root',
    'password': '0001',
    'database': 'sih_qr_db'
}

def get_db_conn():
    """Helper: create DB connection"""
    return mysql.connector.connect(**DB_CONFIG)

# ---------------- ROLE → ALLOWED STATUSES ----------------
ROLE_ALLOWED = {
    "receiver": ["Received"],
    "inspector": ["Inspected"],
    "installer": ["Installed"],
    "maintenance": ["Serviced", "Service Needed", "Replacement Needed", "Replaced", "Discarded"],
    "admin": ["Manufactured","Received","Inspected","Installed","Serviced",
              "Service Needed","Replacement Needed","Replaced","Discarded"]
}

def get_employee_role(emp_id):
    """Fetch employee role from DB"""
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("SELECT role FROM employees WHERE id=%s", (emp_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row[0] if row else None

# ---------------- FLASK APP ----------------
app = Flask(__name__)

# -------- 1) SCAN ENDPOINT -----------------
@app.route('/scan', methods=['POST'])
def scan_qr():
    """
    Input: { "uid": "UID-0001" }
    Output: details + calculated expiry date
    """
    data = request.get_json(force=True)
    uid = data.get("uid")

    if not uid:
        return jsonify({"error": "uid required"}), 400

    conn = get_db_conn()
    cur = conn.cursor(dictionary=True)

    try:
        # Fetch item details
        cur.execute("SELECT * FROM items WHERE uid=%s", (uid,))
        item = cur.fetchone()
        if not item:
            return jsonify({"error": "Item not found"}), 404

        # Calculate expiry = mfg_date + warranty_years
        expiry_date = None
        if item.get("mfg_date") and item.get("warranty_years"):
            expiry_date = item["mfg_date"] + timedelta(days=365*item["warranty_years"])

        # Fetch latest status
        cur.execute("""
            SELECT status, updated_at FROM statuses
            WHERE uid=%s ORDER BY updated_at DESC LIMIT 1
        """, (uid,))
        status_row = cur.fetchone()

        return jsonify({
            "uid": uid,
            "component": item.get("component_type"),
            "vendor": item.get("vendor_id"),
            "lot_no": item.get("lot_no"),
            "serial_no": item.get("serial_no"),
            "mfg_date": str(item.get("mfg_date")),
            "warranty_years": item.get("warranty_years"),
            "expiry_date": str(expiry_date) if expiry_date else None,
            "current_status": status_row["status"] if status_row else item.get("current_status"),
            "last_updated": str(status_row["updated_at"]) if status_row else None
        })

    finally:
        cur.close()
        conn.close()

# -------- 2) ALLOWED STATUSES ENDPOINT -----------------
@app.route('/allowed_statuses', methods=['POST'])
def allowed_statuses():
    """
    Input: { "employee_id": 2 }
    Output: { "role": "inspector", "allowed": ["Inspected"] }
    """
    data = request.get_json(force=True)
    emp_id = data.get("employee_id")

    if not emp_id:
        return jsonify({"error": "employee_id required"}), 400

    role = get_employee_role(emp_id)
    if not role:
        return jsonify({"error": "Invalid employee_id"}), 404

    return jsonify({"role": role, "allowed": ROLE_ALLOWED.get(role, [])})

# -------- 3) UPDATE STATUS ENDPOINT -----------------
@app.route('/update_status', methods=['POST'])
def update_status():
    """
    Input JSON: { "uid": "UID-0001", "new_status": "Inspected", "employee_id": 2, "note": "ok" }
    - Inserts row in 'statuses'
    - Updates 'items.current_status'
    """
    data = request.get_json(force=True)
    uid = data.get("uid")
    new_status = data.get("new_status")
    employee_id = data.get("employee_id")
    note = data.get("note", "")

    if not uid or not new_status or not employee_id:
        return jsonify({"error": "uid, new_status, employee_id required"}), 400

    # Step 1: get role
    role = get_employee_role(employee_id)
    if not role:
        return jsonify({"error": "Invalid employee"}), 403

    # Step 2: check allowed statuses
    allowed = ROLE_ALLOWED.get(role, [])
    if new_status not in allowed:
        return jsonify({
            "error": f"Role '{role}' not allowed to set status '{new_status}'",
            "allowed_statuses": allowed
        }), 403

    # Step 3: DB update
    conn = get_db_conn()
    cur = conn.cursor()
    try:
        now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')

        # Insert into statuses (audit log)
        cur.execute("""
            INSERT INTO statuses (uid, status, location, note, updated_at, employee_id)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (uid, new_status, "MobileApp", note, now, employee_id))

        # Update items.current_status
        cur.execute("UPDATE items SET current_status=%s WHERE uid=%s", (new_status, uid))

        conn.commit()
        return jsonify({"ok": True, "uid": uid, "new_status": new_status, "role": role})

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# ---------------- MAIN ENTRY ----------------
if __name__ == '__main__':
    print("Starting scanning_service (with scan + modify status)...")
    app.run(host='0.0.0.0', port=5001, debug=True)
