#!/usr/bin/env python3

import requests
import json

def test_scan_endpoint():
    # Test UIDs from the mock data in the frontend
    test_uids = [
        'PAD-V0100-L2025-09-00001',
        'ERC-V001-L2025-09-00001', 
        'LINER-V012-L2025-10-00001'
    ]
    
    for uid in test_uids:
        print(f"\n--- Testing UID: {uid} ---")
        try:
            response = requests.post('http://localhost:5001/scan', 
                                   json={'uid': uid},
                                   timeout=5)
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
        except requests.exceptions.RequestException as e:
            print(f"Error: {e}")

def test_generate_qr():
    print("\n--- Testing QR Generation ---")
    try:
        data = {
            "component": "PAD",
            "vendor": "V0100", 
            "lot": "L2025-09",
            "warranty_years": 5,
            "count": 1,
            "mfg_date": "2025-09-19"
        }
        response = requests.post('http://localhost:5001/api/generate',
                               json=data,
                               timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("Testing Backend API Endpoints...")
    test_generate_qr()  # First generate some data
    test_scan_endpoint()  # Then test scanning