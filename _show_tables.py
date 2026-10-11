import sqlite3
conn = sqlite3.connect('D:\\fate v7\\api\\db\\history.db')
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cur.fetchall()
for t in tables:
    print(f'\n=== {t[0]} ===')
    cur.execute(f"PRAGMA table_info({t[0]})")
    for c in cur.fetchall():
        print(f'  {c[1]:20s} {c[2]:15s}')
conn.close()
