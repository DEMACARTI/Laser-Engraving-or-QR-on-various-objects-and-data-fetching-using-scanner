#!/usr/bin/env python3

import mysql.connector
import sys

def test_database():
    try:
        # Connect to database
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='your_password',
            database='sih_qr_db'
        )
        cursor = conn.cursor()
        
        # Get current count
        cursor.execute('SELECT COUNT(*) FROM items')
        count = cursor.fetchone()[0]
        print(f'Current items count: {count}')
        
        # Get recent items
        cursor.execute('SELECT item_id, qr_data FROM items ORDER BY item_id DESC LIMIT 5')
        recent = cursor.fetchall()
        print('\nRecent items:')
        for row in recent:
            print(f'ID: {row[0]}, Data: {row[1][:50]}...')
        
        conn.close()
        return count
        
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    test_database()