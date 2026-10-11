"""
Test script to check passwords in database
Run: python test_passwords.py
"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "db", "history.db")

if not os.path.exists(db_path):
    print(f"Database not found: {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

# Check registrations table
print("=== REGISTRATIONS TABLE ===")
cur = conn.cursor()
cur.execute("SELECT username, password, role, status FROM registrations LIMIT 10")
rows = cur.fetchall()
if not rows:
    print("No data in registrations table")
else:
    for r in rows:
        pwd = r["password"]
        pwd_display = pwd if pwd and len(pwd) > 0 else "(EMPTY/NULL)"
        print(f"User: {r['username']}, Password: {pwd_display}, Role: {r['role']}, Status: {r['status']}")

# Check users table
print("\n=== USERS TABLE ===")
cur.execute("SELECT username, password, role FROM users LIMIT 10")
rows = cur.fetchall()
if not rows:
    print("No data in users table")
else:
    for r in rows:
        pwd = r["password"]
        pwd_display = pwd if pwd and len(pwd) > 0 else "(EMPTY/NULL)"
        print(f"User: {r['username']}, Password: {pwd_display}, Role: {r['role']}")

conn.close()
print("\nDone!")
