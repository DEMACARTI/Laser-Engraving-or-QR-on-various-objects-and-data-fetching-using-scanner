import mysql.connector
from datetime import datetime

DB_CONFIG = {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "alqawwiy",
    "database": "sih_qr_db"
}

# List of existing QR codes we want to add to database
qr_codes = [
    {"uid": "ERC-V001-L2025-09-00001", "component": "ERC", "vendor": "V001", "lot": "L2025-09"},
    {"uid": "PAD-V010-L2025-09-00001", "component": "PAD", "vendor": "V010", "lot": "L2025-09"},
    {"uid": "SLEEPER-U001-L2025-09-00001", "component": "SLEEPER", "vendor": "U001", "lot": "L2025-09"},
    {"uid": "LINER-V012-L2025-11-00003", "component": "LINER", "vendor": "V012", "lot": "L2025-11"}
]

try:
    conn = mysql.connector.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    for qr in qr_codes:
        # Check if already exists
        cur.execute("SELECT uid FROM items WHERE uid = %s", (qr["uid"],))
        if cur.fetchone():
            print(f"✅ {qr['uid']} already exists")
            continue
            
        created_at = datetime.now().replace(microsecond=0).isoformat(sep=" ")
        sql = """
        INSERT INTO items
        (uid, component, vendor, lot, mfg_date, warranty_years, qr_path, created_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """
        cur.execute(sql, (
            qr["uid"], qr["component"], qr["vendor"], qr["lot"], 
            "2025-09-20", 5, f"../qr_batch_output/{qr['uid']}.png", created_at
        ))
        
        # Add initial status
        cur.execute("""
        INSERT INTO statuses (uid, status, location, note, updated_at)
        VALUES (%s,%s,%s,%s,%s)
        """, (qr["uid"], "Manufactured", "Factory", "Added for testing", datetime.now()))
        
        conn.commit()
        print(f"✅ Added {qr['uid']} to database")
    
    cur.close()
    conn.close()
    print("🎉 Database setup complete!")
    
except Exception as e:
    print(f"❌ Error: {e}")
