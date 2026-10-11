"""
Test backend password retrieval
Run: python test_backend.py
"""
import sqlite3
import os
import sys

# Find database
db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "db", "history.db"))
print(f"Using database: {db_path}")

if not os.path.exists(db_path):
    print("Database not found!")
    sys.exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Get heads
print("\n=== GETTING HOUSEHOLDS (simulating backend) ===")
cur.execute("""
    SELECT DISTINCT house_address, username as head_username, name, email, phone, created_at
    FROM registrations
    WHERE status = 'approved' AND role = 'head_of_household' AND house_address IS NOT NULL AND house_address != ''
    ORDER BY house_address
""")
heads = cur.fetchall()

print(f"Found {len(heads)} households")

for h in heads[:2]:  # Check first 2
    print(f"\nHouse: {h['house_address']}")
    print(f"  Head: {h['head_username']}")
    
    # Simulate is_admin = True
    is_admin = True
    
    if is_admin:
        # Check users table
        cur.execute("SELECT password FROM users WHERE username = ?", [h["head_username"]])
        pw_row = cur.fetchone()
        if pw_row and pw_row["password"]:
            print(f"  Password from users table: {len(pw_row['password'])} chars")
            head_password = pw_row["password"]
        else:
            # Fall back to registrations
            cur.execute("SELECT password FROM registrations WHERE username = ?", [h["head_username"]])
            pw_row = cur.fetchone()
            if pw_row and pw_row["password"]:
                print(f"  Password from registrations table: {len(pw_row['password'])} chars")
                head_password = pw_row["password"]
            else:
                print("  NO PASSWORD FOUND!")
                head_password = ""

conn.close()
print("\nDone! If 'NO PASSWORD FOUND', check if user is in BOTH tables with passwords.")
