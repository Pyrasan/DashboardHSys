"""
Check if passwords exist in registrations table
"""
import sqlite3
import os

db_path = "db/history.db"
if not os.path.exists(db_path):
    print(f"Database not found: {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Check registrations table
print("=== Registrations Table ===")
cur.execute("SELECT username, password, role, status FROM registrations LIMIT 10")
rows = cur.fetchall()
if not rows:
    print("No data in registrations table")
else:
    for r in rows:
        pwd = r["password"]
        pwd_display = pwd if pwd else "(EMPTY/NULL)"
        print(f"User: {r['username']}, Password: {pwd_display}, Role: {r['role']}, Status: {r['status']}")

# Check users table  
print("\n=== Users Table ===")
cur.execute("SELECT username, password, role FROM users LIMIT 10")
rows = cur.fetchall()
if not rows:
    print("No data in users table")
else:
    for r in rows:
        pwd = r["password"]
        pwd_display = pwd if pwd else "(EMPTY/NULL)"
        print(f"User: {r['username']}, Password: {pwd_display}, Role: {r['role']}")

conn.close()
