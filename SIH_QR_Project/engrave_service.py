"""
engrave_service.py

Single-file Flask + background worker to:
- fetch UIDs from your MySQL `items` table (using latest status from `statuses`)
- send engraving commands serial-wise to a laser controller
- wait admin-configurable delay_seconds between each send
- support simulate mode, pause/resume/stop, and status monitoring

DB assumptions (from your generator script):
- items table: columns uid, qr_path, qr_image, ...
- statuses table: (id, uid, status, location, note, updated_at)
  - 'latest' status per uid is determined by max(updated_at).

Test first in simulate mode!
"""
import os
import time
import threading
from datetime import datetime
from flask import Flask, request, jsonify
import mysql.connector

# Optional hardware lib
try:
    import serial
except Exception:
    serial = None

# ---------------- CONFIG (env or defaults) ----------------
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', '127.0.0.1'),
    'port': int(os.environ.get('DB_PORT', 3306)),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASS', '0001'),
    'database': os.environ.get('DB_NAME', 'sih_qr_db')
}

LASER_SERIAL = os.environ.get('LASER_SERIAL', '/dev/ttyUSB0')  # or COM3
LASER_BAUD = int(os.environ.get('LASER_BAUD', '115200'))

DEFAULT_DELAY = float(os.environ.get('DEFAULT_DELAY', '6.0'))

# ---------------- Worker state ----------------
_worker_thread = None
_worker_lock = threading.Lock()
_stop_flag = threading.Event()
_pause_flag = threading.Event()
_current_job = None  # {'uids':[{'uid','qr_path'}], 'delay':x, 'simulate':bool, 'pos':int}

# ---------------- DB helper ----------------
def get_db_conn():
    return mysql.connector.connect(**DB_CONFIG)

# ---------------- Laser controller wrapper ----------------
class LaserController:
    """
    Simpler wrapper:
    - simulate=True -> print commands and return immediate OK
    - simulate=False -> open pyserial to LASER_SERIAL and send lines
    Adjust send_command() if your laser expects G-code or file-transfer.
    """
    def __init__(self, simulate=True, port=LASER_SERIAL, baud=LASER_BAUD, timeout=2):
        self.simulate = bool(simulate)
        self.port = port
        self.baud = baud
        self.timeout = timeout
        self.ser = None
        if not self.simulate:
            if serial is None:
                raise RuntimeError("pyserial not available; install pyserial to use real hardware.")
            self.ser = serial.Serial(self.port, self.baud, timeout=self.timeout)
            time.sleep(1)
            try:
                self.ser.reset_input_buffer(); self.ser.reset_output_buffer()
            except Exception:
                pass

    def send_command(self, cmd: str):
        """
        Send a textual command. Adapt formatting per your device:
        - For simple ASCII protocol: send 'ENGRAVE_UID <uid>'
        - For GRBL: send G-code lines (see earlier guidance)
        """
        if self.simulate:
            print(f"[SIM] -> {cmd}")
            # fake brief processing
            time.sleep(0.15)
            return "OK"
        # real hardware
        payload = (cmd + "\n").encode('utf-8')
        self.ser.write(payload)
        self.ser.flush()
        # try read a line response (may be 'ok' / 'error' / custom)
        try:
            resp = self.ser.readline().decode('utf-8').strip()
            return resp
        except Exception:
            return None

    def close(self):
        if self.ser:
            try:
                if self.ser.is_open: self.ser.close()
            except Exception:
                pass

# ---------------- DB status update (matches your generator schema) ----------------
def mark_status(uid: str, status: str, location: str = "Laser", note: str = ""):
    """
    Insert new row in statuses (uid,status,location,note,updated_at).
    NOTE: We do NOT modify items table in this script; statuses table is the canonical source.
    """
    conn = None
    try:
        conn = get_db_conn()
        cur = conn.cursor()
        now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        cur.execute("INSERT INTO statuses (uid, status, location, note, updated_at) VALUES (%s,%s,%s,%s,%s)",
                    (uid, status, location, note, now))
        conn.commit()
        cur.close()
    except Exception as e:
        print("DB error in mark_status:", e)
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

# ---------------- Engraving single item ----------------
def engrave_single(controller: LaserController, uid: str, qr_path: str = None):
    """
    Send engraving command for a UID.
    IMPORTANT: this function DOES NOT update statuses in DB.
    It only sends the command (simulate or real) and logs to console.
    """
    try:
        # Command format used by worker
        if qr_path:
            cmd = f"ENGRAVE_FILE {qr_path} {uid}"
        else:
            cmd = f"ENGRAVE_UID {uid}"

        resp = controller.send_command(cmd)
        resp_str = "" if resp is None else str(resp).strip()

        # Console-only log (no DB writes)
        if controller.simulate:
            print(f"[worker] simulated send -> {cmd} (resp={resp_str})")
        else:
            print(f"[worker] sent -> {cmd} (resp={resp_str})")

        # Return True if controller returned something not empty/error-like
        if resp is None or resp_str == "" or resp_str.upper().startswith("ERR"):
            return False
        return True

    except Exception as ex:
        print(f"[worker] exception while engraving {uid}: {ex}")
        return False

# ---------------- Worker loop (background) ----------------
def _worker_loop():
    global _current_job
    print("[engrave_worker] started")
    while not _stop_flag.is_set():
        with _worker_lock:
            job = _current_job.copy() if _current_job else None
        if not job:
            time.sleep(0.3)
            continue

        simulate = job.get('simulate', True)
        delay = float(job.get('delay', DEFAULT_DELAY))
        uids = job.get('uids', [])
        pos = int(job.get('pos', 0))

        # open controller once per job
        try:
            controller = LaserController(simulate=simulate)
        except Exception as e:
            print("Cannot open controller:", e)
            with _worker_lock:
                _current_job = None
            break

        try:
            while pos < len(uids) and not _stop_flag.is_set():
                # pause handling
                while _pause_flag.is_set() and not _stop_flag.is_set():
                    time.sleep(0.3)
                if _stop_flag.is_set():
                    break

                entry = uids[pos]
                uid = entry.get('uid')
                qr_path = entry.get('qr_path')
                print(f"[engrave_worker] ({pos+1}/{len(uids)}) engraving {uid}")
                _ok = engrave_single(controller, uid, qr_path)

                # update progress
                with _worker_lock:
                    if _current_job:
                        _current_job['pos'] = pos + 1
                pos += 1

                # wait delay with small sleep so we can pause/stop quickly
                waited = 0.0
                while waited < delay:
                    if _stop_flag.is_set() or _pause_flag.is_set():
                        break
                    time.sleep(0.5); waited += 0.5

            print("[engrave_worker] job finished/stop detected")
        finally:
            controller.close()
            with _worker_lock:
                _current_job = None
    print("[engrave_worker] exiting")

# ---------------- Public API for worker control ----------------
def start_job_from_uids(uids_list, delay_seconds=None, simulate=True):
    """Start a job from an explicit list of uids (strings or dicts)."""
    global _worker_thread, _current_job, _stop_flag
    if isinstance(uids_list, list) and uids_list and isinstance(uids_list[0], str):
        uids_list = [{'uid': x, 'qr_path': None} for x in uids_list]
    if not uids_list:
        raise ValueError("uids_list empty")
    with _worker_lock:
        if _current_job:
            raise RuntimeError("another job is running")
        _current_job = {
            'uids': uids_list,
            'delay': float(delay_seconds) if delay_seconds is not None else DEFAULT_DELAY,
            'simulate': bool(simulate),
            'pos': 0
        }
    _stop_flag.clear()
    # spawn worker thread
    if _worker_thread is None or not _worker_thread.is_alive():
        t = threading.Thread(target=_worker_loop, daemon=True)
        t.start()
        # store reference (so stop/pause can be used)
        globals()['_worker_thread'] = t
    return True

def start_job_from_db_query(limit=50, where_clause="latest.status = 'Manufactured'", order_by="i.uid", delay_seconds=None, simulate=True):
    """
    Convenience: select items whose latest status is 'Manufactured' using a JOIN subquery,
    return first `limit` rows ordered by order_by.
    """
    # Query to find latest status per uid and join to items
    sql = f"""
    SELECT i.uid, i.qr_path FROM items i
    JOIN (
      SELECT s1.uid, s1.status FROM statuses s1
      JOIN (
        SELECT uid, MAX(updated_at) AS mu FROM statuses GROUP BY uid
      ) s2 ON s1.uid = s2.uid AND s1.updated_at = s2.mu
    ) latest ON latest.uid = i.uid
    WHERE {where_clause}
    ORDER BY {order_by}
    LIMIT %s
    """
    conn = get_db_conn()
    cur = conn.cursor(dictionary=True)
    cur.execute(sql, (limit,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    uids_list = [{'uid': r['uid'], 'qr_path': r.get('qr_path')} for r in rows]
    if not uids_list:
        raise RuntimeError("No items found matching query (check statuses table & values)")
    return start_job_from_uids(uids_list, delay_seconds=delay_seconds, simulate=simulate)

def stop_job():
    _stop_flag.set()
    return True

def pause_job():
    _pause_flag.set()
    return True

def resume_job():
    _pause_flag.clear()
    return True

def get_status():
    with _worker_lock:
        job = None if _current_job is None else _current_job.copy()
    if not job:
        return {'status': 'idle'}
    return {'status': 'running', 'total': len(job.get('uids',[])), 'done': int(job.get('pos',0)), 'delay': float(job.get('delay', DEFAULT_DELAY)), 'simulate': bool(job.get('simulate', True))}

# ---------------- Flask API (control) ----------------
app = Flask(__name__)

@app.route('/engrave/start', methods=['POST'])
def api_engrave_start():
    """
    Start job: body can contain:
    1) "uids": ["UID-1","UID-2",...]  OR
    2) "query": {"limit":50, "where":"latest.status = 'Manufactured'","order_by":"i.uid"}
    Also include "delay_seconds" and "simulate" booleans.
    """
    body = request.get_json(force=True)
    if not body:
        return jsonify({"error":"missing json"}), 400
    delay = body.get('delay_seconds', None)
    simulate = bool(body.get('simulate', True))
    uids = body.get('uids', None)
    if uids:
        try:
            start_job_from_uids(uids, delay_seconds=delay, simulate=simulate)
        except Exception as e:
            return jsonify({"error": str(e)}), 409
        return jsonify({"ok": True, "mode": "uids", "count": len(uids), "simulate": simulate})

    query = body.get('query', None)
    if query:
        limit = int(query.get('limit', 50))
        where = query.get('where', "latest.status = 'Manufactured'")
        order_by = query.get('order_by', "i.uid")
        try:
            start_job_from_db_query(limit=limit, where_clause=where, order_by=order_by, delay_seconds=delay, simulate=simulate)
        except Exception as e:
            return jsonify({"error": str(e)}), 400
        return jsonify({"ok": True, "mode": "query", "limit": limit, "simulate": simulate})
    return jsonify({"error":"provide 'uids' or 'query' in body"}), 400

@app.route('/engrave/stop', methods=['POST'])
def api_engrave_stop():
    stop_job()
    return jsonify({"ok": True})

@app.route('/engrave/pause', methods=['POST'])
def api_engrave_pause():
    pause_job()
    return jsonify({"ok": True, "action":"paused"})

@app.route('/engrave/resume', methods=['POST'])
def api_engrave_resume():
    resume_job()
    return jsonify({"ok": True, "action":"resumed"})

@app.route('/engrave/status', methods=['GET'])
def api_engrave_status():
    return jsonify(get_status())

# ---------------- Run server ----------------
if __name__ == '__main__':
    # debug-run
    print("Starting engrave_service (Flask + background worker support).")
    print("DB:", DB_CONFIG['host'], DB_CONFIG['database'])
    app.run(host='0.0.0.0', port=5000, debug=True)
