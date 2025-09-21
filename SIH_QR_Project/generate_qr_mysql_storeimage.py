"""
generate_qr_mysql_storeimage.py

🚆 SIH QR Project — Final Version

- Generates QR codes for railway fittings
- Saves PNGs locally + stores image as BLOB in MySQL
- Inserts metadata into `items` table
- Inserts initial status ("Manufactured") into `statuses` table

Run:
    python generate_qr_mysql_storeimage.py

Notes:
- For demo, payload = UID only (Google Lens shows UID). You can switch to URL if needed.
- In production, consider storing images in file storage (S3/MinIO) and only saving paths in DB.
"""

import qrcode
from pathlib import Path
from datetime import datetime, date
import mysql.connector
import io

# ---------------- CONFIG ----------------
OUTPUT_DIR = Path("qr_batch_output")
OUTPUT_DIR.mkdir(exist_ok=True)

DB_CONFIG = {
    "host": "gondola.proxy.rlwy.net",
    "port": 24442,
    "user": "root",        # 👈 change if using another user
    "password": "SZiTeOCZgSbLTZLdDxlIsMKYGRlfxFsd",    # 👈 your MySQL password
    "database": "sih_qr_db"
}

COMPONENT = "PAD"       # ERC / LINER / PAD / SLEEPER
VENDOR = "V0101"
LOT = "L2025-09"
COUNT = 1             # how many QR to generate
WARRANTY_YEARS = 5

BATCH_SIZE = 50         # commit every N rows (optimize inserts)

QR_VERSION = 2
BOX_SIZE = 6
BORDER = 2
ERROR_CORRECTION = qrcode.constants.ERROR_CORRECT_M

PAYLOAD_IS_URL = False
BASE_URL = "http://127.0.0.1:5000/api/item/"
# ----------------------------------------


# ---------- UID + QR generation ----------
def make_uid(component, vendor, lot, serial):
    """UID format: COMPONENT-VENDOR-LOT-00001"""
    return f"{component}-{vendor}-{lot}-{serial:05d}"

def make_qr_payload(uid):
    """Return payload string for QR — UID or URL"""
    return BASE_URL + uid if PAYLOAD_IS_URL else uid

def generate_qr_image_bytes(payload):
    """Generate QR as PNG bytes"""
    qr = qrcode.QRCode(
        version=QR_VERSION,
        error_correction=ERROR_CORRECTION,
        box_size=BOX_SIZE,
        border=BORDER,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.read()
# ----------------------------------------


# ---------- DB setup ----------
def ensure_db_and_tables():
    """Ensure database + required tables exist"""
    conn = mysql.connector.connect(**DB_CONFIG)
    cur = conn.cursor()

    # items table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(128) UNIQUE,
        component VARCHAR(64),
        vendor VARCHAR(64),
        lot VARCHAR(64),
        mfg_date DATE,
        warranty_years INT,
        qr_path VARCHAR(255),
        qr_image LONGBLOB,
        created_at DATETIME,
        INDEX(uid(64)),
        INDEX(lot)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)

    # statuses table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS statuses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(128),
        status VARCHAR(64),
        location VARCHAR(128),
        note TEXT,
        updated_at DATETIME,
        FOREIGN KEY (uid) REFERENCES items(uid) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)

    conn.commit()
    cur.close()
    conn.close()

def insert_items_batch(rows):
    """Insert multiple rows into items table"""
    sql = """
    INSERT IGNORE INTO items
    (uid, component, vendor, lot, mfg_date, warranty_years, qr_path, qr_image, created_at)
    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """
    conn = mysql.connector.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.executemany(sql, rows)
    conn.commit()
    cur.close()
    conn.close()

def insert_initial_status(uid, status="Manufactured", location="Factory", note="Initial QR generation"):
    """Insert the very first status row for a new UID"""
    sql = """
    INSERT INTO statuses (uid, status, location, note, updated_at)
    VALUES (%s,%s,%s,%s,%s)
    """
    conn = mysql.connector.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute(sql, (uid, status, location, note, datetime.utcnow()))
    conn.commit()
    cur.close()
    conn.close()
# ----------------------------------------


# ---------- Main ----------
def main():
    print("🚀 Starting QR generation + DB insertion...")
    ensure_db_and_tables()

    batch = []
    total = 0
    today_date = date.today().isoformat()

    for i in range(1, COUNT + 1):
        uid = make_uid(COMPONENT, VENDOR, LOT, i)
        payload = make_qr_payload(uid)
        png_bytes = generate_qr_image_bytes(payload)

        # also save locally for demo/printing
        local_path = OUTPUT_DIR / f"{uid}.png"
        with open(local_path, "wb") as f:
            f.write(png_bytes)

        created_at = datetime.utcnow().replace(microsecond=0).isoformat(sep=" ")
        row = (
            uid, COMPONENT, VENDOR, LOT, today_date,
            WARRANTY_YEARS, str(local_path), png_bytes, created_at
        )
        batch.append(row)
        total += 1

        # batch insert
        if len(batch) >= BATCH_SIZE:
            insert_items_batch(batch)
            # insert status for each UID in this batch
            for r in batch:
                insert_initial_status(r[0])
            print(f"✅ Inserted {len(batch)} items + statuses")
            batch = []

    # flush remaining
    if batch:
        insert_items_batch(batch)
        for r in batch:
            insert_initial_status(r[0])
        print(f"✅ Inserted {len(batch)} items + statuses")

    print(f"\n🎉 Done — generated {total} QR codes and inserted into MySQL (items + statuses)")

if __name__ == "__main__":
    main()
