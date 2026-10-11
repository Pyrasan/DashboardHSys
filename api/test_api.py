"""
Test the actual API endpoint
Run: python test_api.py
"""
import sqlite3
import os
import json

# Find database
db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "db", "history.db"))
print(f"Database: {db_path}")

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Simulate is_admin = True
is_admin = True

# Get households
cur.execute("""
    SELECT DISTINCT house_address, username as head_username, name, email, phone, created_at
    FROM registrations
    WHERE status = 'approved' AND role = 'head_of_household' AND house_address IS NOT NULL AND house_address != ''
    ORDER BY house_address
""")
heads = cur.fetchall()

print(f"\nFound {len(heads)} households")

for h in heads[:1]:  # Check first household
    print(f"\nHouse: {h['house_address']}")
    print(f"Head username: {h['head_username']}")
    
    if is_admin:
        # Check users table
        cur.execute("SELECT password FROM users WHERE username = ?", [h["head_username"]])
        pw_row = cur.fetchone()
        if pw_row and pw_row["password"]:
            print(f"Password from users table: {len(pw_row['password'])} chars")
            head_password = pw_row["password"]
        else:
            # Fall back to registrations
            cur.execute("SELECT password FROM registrations WHERE username = ?", [h["head_username"]])
            pw_row = cur.fetchone()
            if pw_row and pw_row["password"]:
                print(f"Password from registrations table: {len(pw_row['password'])} chars")
                head_password = pw_row["password"]
            else:
                print("NO PASSWORD FOUND!")
                head_password = ""
        
        # Build head_data
        head_data = {
            "username": h["head_username"],
            "name": h["name"] if h["name"] else "",
            "email": h["email"] or "",
            "phone": h["phone"] or "",
            "created_at": h["created_at"],
            "password": head_password
        }
        
        print(f"\nHead data with password:")
        print(json.dumps(head_data, indent=2))

conn.close()
print("\nDone!")
