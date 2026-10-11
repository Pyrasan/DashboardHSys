"""
Fix password retrieval for admin users
Run this to check and fix password issues
"""
import sqlite3
import os

# Find database
db_path = os.path.join(os.path.dirname(__file__), "..", "db", "history.db")
db_path = os.path.abspath(db_path)

print(f"Database: {db_path}")
if not os.path.exists(db_path):
    print("Database not found!")
    exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Check if users table has passwords
print("\n=== CHECKING USERS TABLE ===")
cur.execute("SELECT username, password, role FROM users LIMIT 10")
users = cur.fetchall()
for u in users:
    pwd = u["password"]
    print(f"User: {u['username']}, Pwd length: {len(pwd) if pwd else 0}, Role: {u['role']}")

# Check registrations table
print("\n=== CHECKING REGISTRATIONS TABLE (approved) ===")
cur.execute("SELECT username, password, role, status FROM registrations WHERE status='approved' LIMIT 10")
regs = cur.fetchall()
for r in regs:
    pwd = r["password"]
    print(f"User: {r['username']}, Pwd length: {len(pwd) if pwd else 0}, Role: {r['role']}, Status: {r['status']}")

conn.close()
print("\nDone! If passwords are empty, users need to re-register.")
