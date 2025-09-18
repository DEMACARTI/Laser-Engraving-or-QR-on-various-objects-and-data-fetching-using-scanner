"""
engrave_service.py

Flask + background worker for engraving workflow.

Features:
- Fetch UIDs from MySQL (latest status = Manufactured) and queue them sequentially.
- Worker sends engraving commands serial-wise:
    - simulate=True -> prints simulated sends
    - simulate=False -> uses GRBLController (pyserial) to send GRBL commands (M3/M5/G0/G4 etc.)
- Worker DOES NOT update 'Engraving'/'Engraved' statuses in DB.
- Provides endpoints: /engrave/start, /engrave/status, /engrave/pause, /engrave/resume, /engrave/stop
- Appends audit rows to engrave_log.csv for every attempted send (no DB writes).
- Safe pause/resume/stop and basic error handling.
"""

import os
import time
import threading
from datetime import datetime
from flask import Flask, request, jsonify
import mysql.connector

# Optional hardware lib - used only when simulate=False
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

# default serial (override with env LASER_SERIAL before running real jobs)
LASER_SERIAL = os.environ.get('LASER_SERIAL', None)  # e.g. "COM3" on Windows
LASER_BAUD = int(os.environ.get('LASER_BAUD', '115200'))

DEFAULT_DELAY = float(os.environ.get('DEFAULT_DELAY', '6.0'))
AUDIT_CSV = os.environ.get('ENGRAVE_LOG', 'engrave_log.csv')

# ---------------- Worker state ----------------
_worker_thread = None
_worker_lock = threading.Lock()
_stop_flag = threading.Event()
_pause_flag = threading.Event()
_current_job = None  # {'uids':[{'uid','qr_path'}], 'delay':x, 'simulate':bool, 'pos':int}

# ---------------- DB helper ----------------
def get_db_conn():
    return mysql.connector.connect(**DB_CONFIG)

# ---------------- Simple audit log (CSV) ----------------
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
    - If simulate=True, prints actions instead of opening serial.
    - send_line waits for 'ok' or 'error' by default.
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
        # open serial port
        self.ser = serial.Serial(self.port, self.baud, timeout=self.timeout)
        time.sleep(1.0)  # let controller initialize
        try:
            self.ser.reset_input_buffer(); self.ser.reset_output_buffer()
        except Exception:
            pass

    def send_line(self, line: str, wait_ok: bool = True, timeout: float = None):
        """
        Send one line to GRBL. Returns list of response lines.
        If simulate, returns ['ok'].
        """
        if timeout is None:
            timeout = self.timeout
        line_out = (line.strip() + "\n")
        if self.simulate:
            print(f"[SIM GRBL] -> {line_out.strip()}")
            time.sleep(0.03)
            return ["ok"]
        # real serial
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

# ---------------- Legacy simple LaserController (kept for backwards compatibility) ----------------
class LaserController:
    """
    Simple wrapper that either simulates or writes ASCII commands to a serial port.
    Kept for compatibility with older flows that expect 'ENGRAVE_UID' ascii commands.
    For GRBL-based hardware use GRBLController instead.
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
                if self.ser.is_open: self.ser.close()
            except Exception:
                pass

# ---------------- DB status helper (kept for UI-triggered updates) ----------------
def mark_status(uid: str, status: str, location: str = "System", note: str = ""):
    """
    Insert a status row into statuses table.
    This is intended for use by the frontend when users scan QRs and select stages.
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

# ---------------- Engraving single item flows ----------------
def engrave_single_ascii(controller: LaserController, uid: str, qr_path: str = None):
    """
    Backwards-compat ASCII command sender (ENGRAVE_UID ...).
    Used for simulated or simple controller flows.
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
    Simple GRBL-based engraving routine:
    - $X unlock, G21, G90, move to X,Y, M3 S<val>, G4 P<ms>, M5, M400
    - controller: GRBLController instance (opened).
    - Tune x,y,laser_s,dwell_ms/feed values for your fixture and laser power.
    """
    try:
        controller.send_line("$X")    # unlock
        controller.send_line("G21")   # mm
        controller.send_line("G90")   # absolute coords
        controller.send_line("M5")    # ensure laser off

        # Move to start
        controller.send_line(f"G0 X{x:.3f} Y{y:.3f} F6000")
        controller.send_line("G4 P100", wait_ok=False)

        # Laser ON
        controller.send_line(f"M3 S{int(laser_s)}")
        # dwell to burn
        controller.send_line(f"G4 P{int(dwell_ms)}")
        # Laser OFF
        controller.send_line("M5")
        # wait for moves complete
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

        # choose controller based on simulate flag and availability
        controller = None
        try:
            if simulate:
                controller = LaserController(simulate=True)
                controller.opened_as = "ascii_sim"
            else:
                # Use GRBLController for real hardware
                port = os.environ.get('LASER_SERIAL', LASER_SERIAL)
                baud = int(os.environ.get('LASER_BAUD', LASER_BAUD))
                grbl = GRBLController(port=port, baud=baud, simulate=False)
                grbl.open()
                controller = grbl
                controller.opened_as = "grbl"
        except Exception as e:
            print("Cannot open controller:", e)
            # clear job so admin can restart after fixing hardware/config
            with _worker_lock:
                _current_job = None
            time.sleep(1)
            continue

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

                # route to correct engrave flow
                success = False
                if getattr(controller, "opened_as", "") == "grbl":
                    # You can compute per-index coordinates here if you have fixture mapping
                    success = engrave_single_grbl(controller, uid, qr_path,
                                                  laser_s=220, dwell_ms=350, x=10.0, y=10.0)
                else:
                    # fallback ascii/simulated flow
                    lc = LaserController(simulate=simulate)
                    success = engrave_single_ascii(lc, uid, qr_path)

                # update progress
                with _worker_lock:
                    if _current_job:
                        _current_job['pos'] = pos + 1
                pos += 1

                # wait delay in small increments to allow pause/stop
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
