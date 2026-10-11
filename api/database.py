import sqlite3
import json
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DB_DIR = BASE_DIR / "db"
DB_DIR.mkdir(exist_ok=True)

HISTORY_DB = DB_DIR / "history.db"
SECURITY_DB = BASE_DIR.parent / "db" / "security_log.db"

def get_history_db():
    conn = sqlite3.connect(str(HISTORY_DB))
    conn.row_factory = sqlite3.Row
    return conn

def get_security_db():
    db_path = str(SECURITY_DB)
    if not os.path.exists(db_path):
        return None
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_history_db():
    conn = get_history_db()
    cur = conn.cursor()
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS deteksi (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT,
            message TEXT,
            ts INTEGER
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS perintah (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT,
            message TEXT,
            ts INTEGER
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            house_number TEXT,
            email TEXT,
            phone TEXT,
            status TEXT DEFAULT 'pending',
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            approved_at INTEGER,
            approved_by TEXT
        )
    """)
    
    cur.execute("SELECT id FROM users WHERE username = 'admin'")
    if not cur.fetchone():
        cur.execute("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", 
                   ("admin", "admin123", "admin"))
    
    cur.execute("SELECT id FROM users WHERE username = 'user'")
    if not cur.fetchone():
        cur.execute("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", 
                   ("user", "user123", "user"))
    
    conn.commit()
    conn.close()

init_history_db()
