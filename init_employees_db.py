"""
Database initialization script for employees table
Run this script to create the employees table with sample data for the status update functionality
"""

import mysql.connector
import os

# Database configuration - matches the combined backend service
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "gondola.proxy.rlwy.net"),
    "port": int(os.getenv("DB_PORT", 24442)),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASS", "SZiTeOCZgSbLTZLdDxlIsMKYGRlfxFsd"),
    "database": os.getenv("DB_NAME", "sih_qr_db"),
    "charset": "utf8mb4",
    "autocommit": True
}

def create_employees_table():
    """Create employees table and insert sample data."""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Create employees table
        create_table_query = """
        CREATE TABLE IF NOT EXISTS employees (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) NOT NULL,
            role ENUM('receiver', 'inspector', 'installer', 'maintenance', 'admin') NOT NULL,
            email VARCHAR(100) UNIQUE,
            department VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """
        
        cursor.execute(create_table_query)
        print("✅ Employees table created successfully")
        
        # Check if table exists and get its structure
        cursor.execute("SHOW TABLES LIKE 'employees'")
        table_exists = cursor.fetchone() is not None
        
        if table_exists:
            cursor.execute("DESCRIBE employees")
            columns = [column[0] for column in cursor.fetchall()]
            print(f"ℹ️  Existing employees table columns: {columns}")
        
        # Insert sample employees with flexible column handling
        sample_employees = [
            (1, 'John Receiver', 'receiver', 'john.receiver@company.com', 'Receiving'),
            (2, 'Alice Inspector', 'inspector', 'alice.inspector@company.com', 'Quality Control'),
            (3, 'Bob Installer', 'installer', 'bob.installer@company.com', 'Installation'),
            (4, 'Carol Maintenance', 'maintenance', 'carol.maintenance@company.com', 'Maintenance'),
            (5, 'Admin User', 'admin', 'admin@company.com', 'Administration')
        ]
        
        # Try inserting with all columns first
        try:
            insert_query = """
            INSERT INTO employees (id, name, role, email, department) 
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE 
            name = VALUES(name), 
            role = VALUES(role), 
            email = VALUES(email), 
            department = VALUES(department)
            """
            cursor.executemany(insert_query, sample_employees)
            print(f"✅ Inserted {len(sample_employees)} sample employees")
        except mysql.connector.Error as e:
            print(f"⚠️  Full insert failed: {e}")
            # Try with minimal columns
            try:
                minimal_insert = """
                INSERT INTO employees (id, role) 
                VALUES (%s, %s)
                ON DUPLICATE KEY UPDATE role = VALUES(role)
                """
                minimal_data = [(emp[0], emp[2]) for emp in sample_employees]  # id, role
                cursor.executemany(minimal_insert, minimal_data)
                print(f"✅ Inserted {len(sample_employees)} employees with minimal data (id, role)")
            except mysql.connector.Error as e2:
                print(f"❌ Minimal insert also failed: {e2}")
                print("Creating employees manually with available columns...")
                
                # Insert one by one to see what works
                for emp_id, name, role, email, dept in sample_employees:
                    try:
                        cursor.execute("INSERT IGNORE INTO employees (id, role) VALUES (%s, %s)", (emp_id, role))
                        print(f"✅ Inserted employee {emp_id} with role {role}")
                    except Exception as e3:
                        print(f"❌ Failed to insert employee {emp_id}: {e3}")
        
        # Update statuses table to include employee_id column if it doesn't exist
        try:
            cursor.execute("ALTER TABLE statuses ADD COLUMN employee_id INT NULL")
            print("✅ Added employee_id column to statuses table")
        except mysql.connector.Error as e:
            if "Duplicate column name" in str(e):
                print("ℹ️  employee_id column already exists in statuses table")
            else:
                print(f"⚠️  Warning: Could not add employee_id column: {e}")
        
        # Add foreign key constraint (optional, may fail if data doesn't match)
        try:
            cursor.execute("""
            ALTER TABLE statuses 
            ADD CONSTRAINT fk_statuses_employee 
            FOREIGN KEY (employee_id) REFERENCES employees(id) 
            ON DELETE SET NULL
            """)
            print("✅ Added foreign key constraint for employee_id")
        except mysql.connector.Error as e:
            if "Duplicate" in str(e) or "already exists" in str(e):
                print("ℹ️  Foreign key constraint already exists")
            else:
                print(f"⚠️  Warning: Could not add foreign key constraint: {e}")
        
        # Update items table to include current_status column if it doesn't exist
        try:
            cursor.execute("ALTER TABLE items ADD COLUMN current_status VARCHAR(50) DEFAULT 'Manufactured'")
            print("✅ Added current_status column to items table")
        except mysql.connector.Error as e:
            if "Duplicate column name" in str(e):
                print("ℹ️  current_status column already exists in items table")
            else:
                print(f"⚠️  Warning: Could not add current_status column: {e}")
        
        conn.commit()
        
        # Update employees with proper usernames and full names
        update_employees = [
            (1, 'john_receiver', 'John Receiver', 'receiver'),
            (2, 'alice_inspector', 'Alice Inspector', 'inspector'), 
            (3, 'bob_installer', 'Bob Installer', 'installer'),
            (4, 'carol_maintenance', 'Carol Maintenance', 'maintenance'),
            (5, 'admin_user', 'Admin User', 'admin')
        ]
        
        for emp_id, username, full_name, role in update_employees:
            try:
                cursor.execute("""
                INSERT INTO employees (id, username, full_name, role, password_hash) 
                VALUES (%s, %s, %s, %s, 'dummy_hash')
                ON DUPLICATE KEY UPDATE 
                username = VALUES(username),
                full_name = VALUES(full_name),
                role = VALUES(role)
                """, (emp_id, username, full_name, role))
                print(f"✅ Updated employee {emp_id}: {full_name} ({role})")
            except Exception as e:
                print(f"⚠️  Could not update employee {emp_id}: {e}")
        
        # Display sample employees
        cursor.execute("SELECT id, username, full_name, role FROM employees ORDER BY id")
        employees = cursor.fetchall()
        
        print("\n📋 Sample Employees Created:")
        print("ID | Username         | Full Name        | Role")
        print("-" * 60)
        for emp in employees:
            print(f"{emp[0]:<2} | {emp[1]:<15} | {emp[2]:<15} | {emp[3]}")
        
        print("\n🔐 Role Permissions:")
        print("- receiver: Can set status to 'Received'")
        print("- inspector: Can set status to 'Inspected'") 
        print("- installer: Can set status to 'Installed'")
        print("- maintenance: Can set status to 'Serviced', 'Service Needed', 'Replacement Needed', 'Replaced', 'Discarded'")
        print("- admin: Can set any status")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error creating employees table: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("🚀 Initializing employees table for status update functionality...")
    success = create_employees_table()
    if success:
        print("\n✅ Database initialization completed successfully!")
        print("\n💡 You can now use the status update functionality in the scanning page.")
        print("   The employees are ready to update item statuses based on their roles.")
    else:
        print("\n❌ Database initialization failed!")