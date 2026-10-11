"""
Debug password retrieval - Run: python debug_passwords.py
"""
import sqlite3
import os
import sys

# Find database
db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "db", "history.db"))
print(f"Database: {db_path}")

if not os.path.exists(db_path):
    print("Database not found!")
    sys.exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Check users table (where approved users are)
print("\n=== USERS TABLE (approved users with passwords) ===")
cur.execute("SELECT username, password, role FROM users WHERE role = 'resident' LIMIT 10")
users = cur.fetchall()
if not users:
    print("No users found in users table")
else:
    for u in users:
        pwd = u["password"]
        print(f"User: {u['username']}, Pwd length: {len(pwd) if pwd else 0}, Role: {u['role']}")

# Check registrations table
print("\n=== REGISTRATIONS TABLE (approved) ===")
cur.execute("SELECT username, password, role, status FROM registrations WHERE status = 'approved' LIMIT 10")
regs = cur.fetchall()
if not regs:
    print("No approved registrations found")
else:
    for r in regs:
        pwd = r["password"]
        print(f"User: {r['username']}, Pwd length: {len(pwd) if pwd else 0}, Role: {r['role']}, Status: {r['status']}")

conn.close()
print("\nDone! If pwd length is 0, passwords are missing and users need to re-register.")
