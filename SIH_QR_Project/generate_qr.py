"""
generate_qr.py

- Generates multiple QR codes with unique UIDs
- Saves PNG images in qr_batch_output/
- Stores metadata (UID, component, vendor, lot, etc.) in qr_metadata.csv

Run:
    python generate_qr.py
"""

import qrcode
import csv
from pathlib import Path
from datetime import date

# ---------------- CONFIG ----------------
OUTPUT_DIR = Path("qr_batch_output")  # Folder to save QR codes
OUTPUT_DIR.mkdir(exist_ok=True)

CSV_FILE = OUTPUT_DIR / "qr_metadata.csv"  # Metadata storage file
COMPONENT = "ERC"       # Options: ERC, LINER, PAD, SLEEPER
VENDOR = "V001"         # Vendor code
LOT = "L2025-09"        # Lot/Batch identifier
COUNT = 20             # Number of QR codes to generate (increase as needed, e.g., 1000)
WARRANTY_YEARS = 5      # Example warranty
# ----------------------------------------

def make_uid(component, vendor, lot, serial):
    """
    Generate a unique ID (UID) for each fitting.
    Example: ERC-V001-L2025-09-00001
    """
    return f"{component}-{vendor}-{lot}-{serial:05d}"

def generate_qr_image(data, out_path):
    """
    Create a QR image (PNG) for given data and save to specified path.
    """
    qr = qrcode.QRCode(
        version=2,  # QR version (size) -> 2 is small but sufficient
        error_correction=qrcode.constants.ERROR_CORRECT_M,  # Medium error correction
        box_size=6,  # Pixel size of each box
        border=2,    # Border thickness
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(out_path)

def main():
    today = date.today().isoformat()

    # Open CSV for writing metadata
    with open(CSV_FILE, mode="w", newline="") as f:
        writer = csv.writer(f)
        # Write header row
        writer.writerow(["UID", "Component", "Vendor", "Lot", "Mfg_Date", "Warranty_Years", "QR_Path"])

        # Generate QR codes in a loop
        for i in range(1, COUNT + 1):
            uid = make_uid(COMPONENT, VENDOR, LOT, i)
            qr_file = OUTPUT_DIR / f"{uid}.png"

            # Payload inside QR (here: UID only)
            qr_payload = uid


            # Generate QR PNG
            generate_qr_image(qr_payload, qr_file)

            # Write metadata to CSV
            writer.writerow([uid, COMPONENT, VENDOR, LOT, today, WARRANTY_YEARS, str(qr_file)])

            print(f"✅ Generated QR: {uid} -> {qr_file}")

    print(f"\nAll {COUNT} QR codes generated successfully!")
    print(f"Metadata stored in: {CSV_FILE}")

if __name__ == "__main__":
    main()
