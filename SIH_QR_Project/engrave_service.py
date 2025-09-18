"""
engrave_service.py

Full updated file (ready-to-run).

Features:
- Flask API endpoints for engraving control (start/pause/resume/stop/status).
- Endpoints for mobile app: update_status, items/manufactured.
- Optional append-to-running-job endpoint.
- Worker sends engraving commands sequentially (simulate or GRBL).
- Worker does NOT update statuses in DB (user-driven updates only).
- Audit CSV (engrave_log.csv) records each send attempt.
"""

import os
import time
import threading
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector

# Optional pyserial for hardware mode
try:
    import serial
    import serial.tools.list_ports
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

# Serial port settings; set LASER_SERIAL="COM3" (Windows) or "/dev/ttyUSB0" (Linux) in env for real hardware
LASER_SERIAL = os.environ.get('LASER_SERIAL', None)
LASER_BAUD = int(os.environ.get('LASER_BAUD', '115200'))

DEFAULT_DELAY = float(os.environ.get('DEFAULT_DELAY', '6.0'))
AUDIT_CSV = os.environ.get('ENGRAVE_LOG', 'engrave_log.csv')

# ---------------- Worker state ----------------
_worker_thread = None
_worker_lock = threading.Lock()
_stop_flag = threading.Event()
_pause_flag = threading.Event()
_current_job = None  # {'uids':[{'uid','qr_path'}], 'delay':x, 'simulate':bool, 'pos':int}

# ---------------- Flask app + CORS ----------------
app = Flask(__name__)
CORS(app)  # DEV: allow all origins; tighten in production

# ---------------- DB helper ----------------
def get_db_conn():
    return mysql.connector.connect(**DB_CONFIG)

# ---------------- Audit CSV helper ----------------
def audit_log(uid: str, result: str):
    try:
        ts = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        line = f"{ts},{uid},{result}\n"
        with open(AUDIT_CSV, "a", encoding="utf-8") as f:
            f.write(line)
    except Exception as e:
        print("audit_log error:", e)

# ---------------- GRBL Controller (for real hardware) ----------------
class GRBLController:
    """
    Minimal GRBL wrapper using pyserial.
    If simulate=True, prints actions instead of opening serial.
    """
    def __init__(self, port=None, baud=115200, simulate=True, timeout=3.0):
        self.port = port
        self.baud = int(baud)
        self.simulate = bool(simulate)
        self.timeout = float(timeout)
        self.ser = None

    @staticmethod
    def list_ports():
        if serial is None:
            return []
        return [p.device for p in serial.tools.list_ports.comports()]

    def open(self):
        if self.simulate:
            print("[GRBL] simulate open")
            return
        if serial is None:
            raise RuntimeError("pyserial not available; install pyserial to use hardware mode.")
        if not self.port:
            raise RuntimeError("No serial port provided for GRBLController (set LASER_SERIAL).")
        self.ser = serial.Serial(self.port, self.baud, timeout=self.timeout)
        time.sleep(1.0)
        try:
            self.ser.reset_input_buffer(); self.ser.reset_output_buffer()
        except Exception:
            pass

    def send_line(self, line: str, wait_ok: bool = True, timeout: float = None):
        if timeout is None:
            timeout = self.timeout
        line_out = (line.strip() + "\n")
        if self.simulate:
            print(f"[SIM GRBL] -> {line_out.strip()}")
            time.sleep(0.03)
            return ["ok"]
        self.ser.write(line_out.encode('utf-8'))
        self.ser.flush()
        if not wait_ok:
            return []
        end = time.time() + timeout
        lines = []
        while time.time() < end:
            raw = self.ser.readline().decode('utf-8', errors='ignore').strip()
            if not raw:
                continue
            lines.append(raw)
            if raw.lower().startswith("ok") or raw.lower().startswith("error"):
                break
        return lines

    def close(self):
        if self.simulate:
            print("[GRBL] simulate close")
            return
        try:
            if self.ser and self.ser.is_open:
                self.ser.close()
        except Exception:
            pass

# ---------------- Simple ASCII LaserController (backwards compat) ----------------
class LaserController:
    """
    Simple wrapper to send ASCII commands (ENGRAVE_UID ...).
    For GRBL-based hardware use GRBLController.
    """
    def __init__(self, simulate=True, port=LASER_SERIAL, baud=LASER_BAUD, timeout=2):
        self.simulate = bool(simulate)
        self.port = port
        self.baud = int(baud)
        self.timeout = timeout
        self.ser = None
        if not self.simulate:
            if serial is None:
                raise RuntimeError("pyserial not available; install pyserial to use real hardware.")
            if not self.port:
                raise RuntimeError("LASER_SERIAL not set; set env LASER_SERIAL to COM port.")
            self.ser = serial.Serial(self.port, self.baud, timeout=self.timeout)
            time.sleep(1)
            try:
                self.ser.reset_input_buffer(); self.ser.reset_output_buffer()
            except Exception:
                pass

    def send_command(self, cmd: str):
        if self.simulate:
            print(f"[SIM] -> {cmd}")
            time.sleep(0.12)
            return "OK"
        payload = (cmd + "\n").encode('utf-8')
        self.ser.write(payload)
        self.ser.flush()
        try:
            resp = self.ser.readline().decode('utf-8').strip()
            return resp
        except Exception:
            return None

    def close(self):
        if self.ser:
            try:
                if self.ser.is_open:
                    self.ser.close()
            except Exception:
                pass

# ---------------- DB status helper (for UI-driven updates) ----------------
def mark_status(uid: str, status: str, location: str = "System", note: str = ""):
    """
    Insert a status row into statuses table (uid, status, location, note, updated_at).
    Used by mobile app / frontend when user scans and selects a stage.
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
        raise
    finally:
        if conn:
            conn.close()

# ---------------- Engraving single item (no DB writes) ----------------
def engrave_single_ascii(controller: LaserController, uid: str, qr_path: str = None):
    """
    ASCII-style command sender (ENGRAVE_UID or ENGRAVE_FILE).
    Records audit_log but does NOT write statuses into DB.
    """
    try:
        if qr_path:
            cmd = f"ENGRAVE_FILE {qr_path} {uid}"
        else:
            cmd = f"ENGRAVE_UID {uid}"
        resp = controller.send_command(cmd)
        resp_str = "" if resp is None else str(resp).strip()
        if controller.simulate:
            print(f"[worker] simulated send -> {cmd} (resp={resp_str})")
        else:
            print(f"[worker] sent -> {cmd} (resp={resp_str})")
        success = not (resp is None or resp_str == "" or resp_str.upper().startswith("ERR"))
        audit_log(uid, "OK" if success else f"ERR:{resp_str}")
        return success
    except Exception as ex:
        print(f"[worker] exception while engraving {uid}: {ex}")
        audit_log(uid, f"EXC:{ex}")
        return False

def engrave_single_grbl(controller: GRBLController, uid: str, qr_path: str = None,
                        laser_s: int = 200, dwell_ms: int = 300, x: float = 10.0, y: float = 10.0, feed: int = 1000):
    """
    GRBL-based engraving routine (simple dwell at XY).
    Tune x,y,laser_s,dwell_ms for your fixture.
    """
    try:
        controller.send_line("$X")    # unlock
        controller.send_line("G21")   # mm
        controller.send_line("G90")   # absolute coords
        controller.send_line("M5")    # ensure laser off

        controller.send_line(f"G0 X{x:.3f} Y{y:.3f} F6000")
        controller.send_line("G4 P100", wait_ok=False)

        controller.send_line(f"M3 S{int(laser_s)}")
        controller.send_line(f"G4 P{int(dwell_ms)}")
        controller.send_line("M5")
        controller.send_line("M400")

        audit_log(uid, "OK")
        if controller.simulate:
            print(f"[worker] simulated GRBL send for {uid} (S={laser_s},dwell={dwell_ms}ms) at ({x},{y})")
        else:
            print(f"[worker] GRBL send for {uid} OK (S={laser_s},dwell={dwell_ms}ms) at ({x},{y})")
        return True
    except Exception as ex:
        print(f"[worker] GRBL exception while engraving {uid}: {ex}")
        audit_log(uid, f"GRBL_EXC:{ex}")
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

        # open controller based on simulate flag
        controller = None
        try:
            if simulate:
                controller = LaserController(simulate=True)
                controller.opened_as = "ascii_sim"
            else:
                port = os.environ.get('LASER_SERIAL', LASER_SERIAL)
                baud = int(os.environ.get('LASER_BAUD', LASER_BAUD))
                grbl = GRBLController(port=port, baud=baud, simulate=False)
                grbl.open()
                controller = grbl
                controller.opened_as = "grbl"
        except Exception as e:
            print("Cannot open controller:", e)
            # clear job and allow admin to fix and restart
            with _worker_lock:
                _current_job = None
            time.sleep(1)
            continue

        try:
            while pos < len(uids) and not _stop_flag.is_set():
                # handle pause
                while _pause_flag.is_set() and not _stop_flag.is_set():
                    time.sleep(0.3)
                if _stop_flag.is_set():
                    break

                entry = uids[pos]
                uid = entry.get('uid')
                qr_path = entry.get('qr_path')
                print(f"[engrave_worker] ({pos+1}/{len(uids)}) engraving {uid}")

                # route to appropriate engrave function
                success = False
                if getattr(controller, "opened_as", "") == "grbl":
                    success = engrave_single_grbl(controller, uid, qr_path,
                                                  laser_s=220, dwell_ms=350, x=10.0, y=10.0)
                else:
                    # ascii flow (simulate or simple ASCII controller)
                    # create a LaserController instance for ascii operations (simulated or real ASCII)
                    lc = LaserController(simulate=simulate)
                    success = engrave_single_ascii(lc, uid, qr_path)
                    lc.close()

                # update in-memory progress
                with _worker_lock:
                    if _current_job:
                        _current_job['pos'] = pos + 1
                pos += 1

                # wait delay with small increments so pause/stop is responsive
                waited = 0.0
                while waited < delay:
                    if _stop_flag.is_set() or _pause_flag.is_set():
                        break
                    time.sleep(0.5); waited += 0.5

            print("[engrave_worker] job finished/stop detected")
        finally:
            try:
                if controller:
                    controller.close()
            except Exception:
                pass
            with _worker_lock:
                _current_job = None
    print("[engrave_worker] exiting")

# ---------------- Job control functions ----------------
def start_job_from_uids(uids_list, delay_seconds=None, simulate=True):
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
    if _worker_thread is None or not _worker_thread.is_alive():
        t = threading.Thread(target=_worker_loop, daemon=True)
        t.start()
        globals()['_worker_thread'] = t
    return True

def start_job_from_db_query(limit=50, where_clause="latest.status = 'Manufactured'", order_by="i.uid", delay_seconds=None, simulate=True):
    sql = f"""
    SELECT i.uid, i.qr_path FROM items i
    JOIN (
      SELECT s1.uid, s1.updated_at FROM statuses s1
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
    return {
        'status': 'running',
        'total': len(job.get('uids', [])),
        'done': int(job.get('pos', 0)),
        'delay': float(job.get('delay', DEFAULT_DELAY)),
        'simulate': bool(job.get('simulate', True))
    }

# ---------------- Append helper (optional) ----------------
def append_uids_to_current_job(uids_list):
    global _current_job
    if isinstance(uids_list, list) and uids_list and isinstance(uids_list[0], str):
        uids_list = [{'uid': x, 'qr_path': None} for x in uids_list]
    with _worker_lock:
        if not _current_job:
            raise RuntimeError("no job is currently running")
        _current_job['uids'].extend(uids_list)
    return True

# ---------------- Flask API endpoints ----------------
@app.route('/engrave/start', methods=['POST'])
def api_engrave_start():
    body = request.get_json(force=True)
    if not body:
        return jsonify({"error": "missing json"}), 400
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
    return jsonify({"error": "provide 'uids' or 'query' in body"}), 400

@app.route('/engrave/stop', methods=['POST'])
def api_engrave_stop():
    stop_job()
    return jsonify({"ok": True})

@app.route('/engrave/pause', methods=['POST'])
def api_engrave_pause():
    pause_job()
    return jsonify({"ok": True, "action": "paused"})

@app.route('/engrave/resume', methods=['POST'])
def api_engrave_resume():
    resume_job()
    return jsonify({"ok": True, "action": "resumed"})

@app.route('/engrave/status', methods=['GET'])
def api_engrave_status():
    return jsonify(get_status())

@app.route('/engrave/append', methods=['POST'])
def api_engrave_append():
    body = request.get_json(force=True)
    uids = body.get('uids')
    if not uids or not isinstance(uids, list):
        return jsonify({"error": "provide 'uids' list"}), 400
    try:
        append_uids_to_current_job(uids)
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "append failed: " + str(e)}), 500
    return jsonify({"ok": True, "appended": len(uids)})

# Mobile / UI status update endpoint
@app.route('/update_status', methods=['POST'])
def api_update_status():
    body = request.get_json(force=True)
    uid = body.get('uid')
    status = body.get('status')
    location = body.get('location', 'MobileApp')
    note = body.get('note', '')
    if not uid or not status:
        return jsonify({"error": "provide uid and status"}), 400
    try:
        mark_status(uid, status, location, note)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify({"ok": True})

# Endpoint to list Manufactured items
@app.route('/items/manufactured', methods=['GET'])
def api_manufactured():
    limit = int(request.args.get('limit', 100))
    conn = get_db_conn()
    cur = conn.cursor(dictionary=True)
    sql = """
      SELECT i.uid, i.qr_path FROM items i
      JOIN (
        SELECT s1.uid, s1.updated_at FROM statuses s1
        JOIN (SELECT uid, MAX(updated_at) AS mu FROM statuses GROUP BY uid) s2
        ON s1.uid = s2.uid AND s1.updated_at = s2.mu
      ) latest ON latest.uid = i.uid
      WHERE latest.status='Manufactured'
      ORDER BY i.uid
      LIMIT %s
    """
    cur.execute(sql, (limit,))
    rows = cur.fetchall()
    cur.close(); conn.close()
    return jsonify(rows)

# ---------------- Run server ----------------
if __name__ == '__main__':
    print("Starting engrave_service (Flask + background worker support).")
    print("DB:", DB_CONFIG['host'], DB_CONFIG['database'])
    # Note: host 0.0.0.0 allows mobile devices on LAN to reach this machine.
    app.run(host='0.0.0.0', port=5000, debug=True)
