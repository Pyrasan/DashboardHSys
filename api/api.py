import os
import json
import sqlite3
import asyncio
import time
import io
import numpy as np
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status, Request, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from paho.mqtt import client as mqtt_client
import socketio
import face_recognition
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = BASE_DIR / "public"

try:
    from .frame_buffer import get_frame_camera_entry, get_frame_camera_exit, get_system_health
except ImportError:
    from frame_buffer import get_frame_camera_entry, get_frame_camera_exit, get_system_health

def generate_stream(get_frame_func, camera_name):
    """Generate MJPEG stream for a camera"""
    try:
        while True:
            try:
                frame_data = get_frame_func()
                if frame_data:
                    frame = frame_data.get('frame')
                    if frame:
                        yield (b'--frame\r\n'
                               b'Content-Type: image/jpeg\r\n'
                               b'Content-Length: ' + str(len(frame)).encode() + b'\r\n\r\n' +
                               frame + b'\r\n')
                time.sleep(0.05)  # ~20 FPS max
            except GeneratorExit:
                break
    except asyncio.CancelledError:
        pass

DATABASE_PATH = BASE_DIR / "db" / "history.db"
PARENT_DB = BASE_DIR / "db" / "security_log.db"

MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_TOPICS = ["gate/detection", "gate/command"]

TAMU_DATA_FILE = BASE_DIR / "G_data.json"
VP_DATA_FILE = BASE_DIR / "VP_data.json"
VP_ENCODINGS_FILE = BASE_DIR / "VP_encode.json"
ADDRESSES_FILE = BASE_DIR / "addresses.json"
RESIDENT_FACE_DIR = BASE_DIR / "backend" / "Penduduk"
RESIDENT_ENCODE_FILE = BASE_DIR / "R_encode.json"
RESIDENT_DATA_FILE = BASE_DIR / "R_data.json"
AVATAR_DIR = PUBLIC_DIR / "uploads" / "avatars"

RESIDENT_FACE_DIR.mkdir(parents=True, exist_ok=True)
AVATAR_DIR.mkdir(parents=True, exist_ok=True)

sessions = {}
session_timeout = 24 * 60 * 60 * 1000

class LoginRequest(BaseModel):
    username: str
    password: str

class SessionResponse(BaseModel):
    ok: bool
    username: str
    role: str
    sessionId: str

class UserResponse(BaseModel):
    ok: bool
    user: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class HistoryEntry(BaseModel):
    topic: str
    message: str
    ts: int

class HistoryResponse(BaseModel):
    ok: bool
    data: List[HistoryEntry] = []

class TamuRequest(BaseModel):
    name: Optional[str] = None
    plate: Optional[str] = None
    face_encoding: Optional[Dict[str, Any]] = None
    credits: int = 1
    catatan: Optional[str] = None

class VPCheckRequest(BaseModel):
    face_encoding: Optional[List[float]] = None
    plate: Optional[str] = None
    mode: Optional[str] = "MASUK"

class CommandRequest(BaseModel):
    command: str

def get_db():
    conn = sqlite3.connect(str(DATABASE_PATH), timeout=20)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=5000")
    return conn

def create_session(username: str, role: str):
    session_id = os.urandom(16).hex()
    sessions[session_id] = {
        "username": username,
        "role": role,
        "expires_at": time.time() + 3600
    }
    return session_id

def create_notification(username: str, title: str, message: str, notif_type: str = 'general', related_id: str = None):
    """Create a notification for a user"""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO notifications (username, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)",
            [username, title, message, notif_type, related_id]
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error creating notification: {e}")

def create_message(from_username: str, to_username: str, subject: str, message: str):
    """Create a message from one user to another"""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO messages (from_username, to_username, subject, message) VALUES (?, ?, ?, ?)",
            [from_username, to_username, subject, message]
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error creating message: {e}")

def get_session(session_id: str):
    if not session_id:
        return None
    session = sessions.get(session_id)
    if not session:
        return None
    if time.time() > session["expires_at"]:
        del sessions[session_id]
        return None
    return session

def require_auth(request: Request = None):
    session_id = None
    if request:
        session_id = request.headers.get("X-Session-Id")
    if not session_id:
        raise HTTPException(status_code=401, detail="Unauthorized", headers={"X-Session-Id": ""})
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return session

def require_admin(request: Request = None):
    session_id = None
    if request:
        session_id = request.headers.get("X-Session-Id")
    if not session_id:
        raise HTTPException(status_code=403, detail="Forbidden - Admin only", headers={"X-Session-Id": ""})
    session = get_session(session_id)
    if not session or session["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden - Admin only")
    return session

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db_on_startup()
    start_mqtt()
    yield

def init_db_on_startup():
    DATABASE_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(str(DATABASE_PATH), timeout=20)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    cur = conn.cursor()
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS detection (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT,
            message TEXT,
            ts INTEGER
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS command (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT,
            message TEXT,
            ts INTEGER
        )
    """)
    
    try:
        cur.execute("ALTER TABLE registrations ADD COLUMN house_address TEXT")
    except:
        pass
    try:
        cur.execute("ALTER TABLE registrations ADD COLUMN plates TEXT")
    except:
        pass
    try:
        cur.execute("ALTER TABLE registrations ADD COLUMN role TEXT DEFAULT 'household_member'")
    except:
        pass
    try:
        cur.execute("ALTER TABLE registrations ADD COLUMN parent_username TEXT")
    except:
        pass
    try:
        cur.execute("ALTER TABLE registrations ADD COLUMN approved_by_head_at INTEGER")
    except:
        pass
    try:
        cur.execute("ALTER TABLE registrations ADD COLUMN approved_by_head TEXT")
    except:
        pass
    try:
        cur.execute("ALTER TABLE notifications ADD COLUMN type TEXT DEFAULT 'general'")
    except:
        pass
    try:
        cur.execute("ALTER TABLE notifications ADD COLUMN related_id TEXT")
    except:
        pass

    cur.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            title TEXT,
            message TEXT,
            is_read INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            house_address TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            plates TEXT NOT NULL,
            parent_username TEXT,
            status TEXT DEFAULT 'pending',
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            approved_at INTEGER,
            approved_by TEXT
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            title TEXT,
            message TEXT,
            type TEXT DEFAULT 'general',
            related_id TEXT,
            is_read INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_username TEXT NOT NULL,
            to_username TEXT NOT NULL,
            subject TEXT,
            message TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at INTEGER DEFAULT (strftime('%%s', 'now'))
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
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            house_address TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            plates TEXT NOT NULL,
            role TEXT DEFAULT 'household_member',
            parent_username TEXT,
            status TEXT DEFAULT 'pending',
            approved_by_head_at INTEGER,
            approved_by_head TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            approved_at INTEGER,
            approved_by TEXT
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            title TEXT,
            message TEXT,
            is_read INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    """)
    
    # Migrate old role names in registrations table
    try:
        cur.execute("UPDATE registrations SET role = 'head_of_household' WHERE role = 'resident_H'")
        cur.execute("UPDATE registrations SET role = 'household_member' WHERE role = 'resident_HM'")
        if cur.rowcount > 0:
            print(f"[MIGRATE] Updated {cur.rowcount} registrations from old role names")
    except Exception as e:
        print(f"[MIGRATE] Role migration error: {e}")

    # Migrate old role names in users table (non-admin)
    try:
        cur.execute("UPDATE users SET role = 'head_of_household' WHERE role = 'resident_H'")
        cur.execute("UPDATE users SET role = 'household_member' WHERE role = 'resident_HM'")
    except Exception as e:
        print(f"[MIGRATE] Users role migration error: {e}")

    conn.commit()
    conn.close()

app = FastAPI(title="SecurePass API", lifespan=lifespan)

# Serve uploaded files (VP face images, etc.)
(PUBLIC_DIR / "uploads").mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(PUBLIC_DIR / "uploads")), name="uploads")

# Serve frontend dist
DIST_DIR = PUBLIC_DIR / "dist"
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="static-assets")

# Socket.IO is optional - skip if there are issues
try:
    sio = socketio.AsyncServer(cors_allowed_origins="*", async_mode="asgi")
    sio_app = socketio.ASGIApp(sio)
    mgr = {"mqtt_client": None}
    
    @sio.on("connect")
    async def connect(sid, environ):
        print(f"Client connected: {sid}")
    
    @sio.on("disconnect")
    async def disconnect(sid):
        print(f"Client disconnected: {sid}")
except Exception as e:
    print(f"[Socket.IO] Not available: {e}")
    sio = None
    sio_app = app

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def on_mqtt_connect(client, userdata, flags, rc):
    if rc == 0:
        print("[MQTT] Connected successfully")
        for topic in MQTT_TOPICS:
            client.subscribe(topic)
    else:
        print(f"[MQTT] Connection failed with code {rc}")

def on_mqtt_message(client, userdata, msg):
    if msg.topic != "gate/detection":
        return
    payload = msg.payload.decode()
    # Simulation already writes directly to DB — skip duplicate
    try:
        p = json.loads(payload)
        if p.get("source") == "simulation":
            return
    except Exception:
        pass
    entry = {
        "topic": msg.topic,
        "message": payload,
        "ts": int(time.time() * 1000)
    }
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("INSERT INTO detection (topic, message, ts) VALUES (?, ?, ?)",
                [entry["topic"], entry["message"], entry["ts"]])
    conn.commit()
    conn.close()

def start_mqtt():
    try:
        mqtt_client_instance = mqtt_client.Client()
        mqtt_client_instance.on_connect = on_mqtt_connect
        mqtt_client_instance.on_message = on_mqtt_message
        mqtt_client_instance.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client_instance.loop_start()
        mgr["mqtt_client"] = mqtt_client_instance
    except Exception as e:
        print(f"[MQTT] Connection error: {e}")

@app.get("/")
async def root():
    index_path = PUBLIC_DIR / "dist" / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "SecurePass API", "version": "1.0.0"}

@app.get("/stream/entry")
async def stream_entry():
    """Live stream from entry camera"""
    return StreamingResponse(
        generate_stream(get_frame_camera_entry, "Entry"),
        media_type='multipart/x-mixed-replace; boundary=frame'
    )

@app.get("/stream/exit")
async def stream_exit():
    """Live stream from exit camera"""
    return StreamingResponse(
        generate_stream(get_frame_camera_exit, "Exit"),
        media_type='multipart/x-mixed-replace; boundary=frame'
    )

@app.get("/api/camera/status")
async def camera_status():
    """Get camera and system status"""
    try:
        status = get_system_status()
        return {"ok": True, "cameras": status.get('cameras', {}), "systems": status.get('systems', {})}
    except Exception as e:
        return {"ok": True, "cameras": {"entry": {"status": "unknown"}, "exit": {"status": "unknown"}}, "systems": {}}

@app.get("/api/system/health")
async def system_health():
    """Get system health (CPU, RAM, disk, uptime)"""
    try:
        health = get_system_health()
        if health:
            return {"ok": True, "health": health}
        return {"ok": False, "error": "Health data unavailable"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@app.post("/api/system/heartbeat")
async def system_heartbeat(system: str = None):
    """Heartbeat from gate controller or other systems"""
    try:
        if system == 'gate_controller':
            set_system_status('gate_controller', 'running')
        elif system == 'mqtt':
            set_system_status('mqtt', 'connected')
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@app.post("/api/auth/login")
async def login(request: LoginRequest):
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE username = ? AND password = ?", 
                [request.username, request.password])
    user = cur.fetchone()
    conn.close()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    session_id = create_session(user["username"], user["role"])
    print(f"[Login] User: {user['username']}, Role: {user['role']}")
    
    return {
        "ok": True,
        "user": {"username": user["username"], "role": user["role"]},
        "sessionId": session_id
    }

@app.post("/api/auth/logout")
async def logout(request: Request = None):
    session_id = request.headers.get("X-Session-Id") if request else None
    if session_id and session_id in sessions:
        del sessions[session_id]
    return {"ok": True}

@app.get("/api/auth/me")
async def auth_me(request: Request = None):
    session_id = request.headers.get("X-Session-Id") if request else None
    session = get_session(session_id)
    if not session:
        return {"authenticated": False, "user": None}
    return {"authenticated": True, "user": {"username": session["username"], "role": session["role"]}}

def send_notification(username: str, title: str, message: str):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("INSERT INTO notifications (username, title, message) VALUES (?, ?, ?)",
                   [username, title, message])
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Notification] Error: {e}")

@app.post("/api/auth/register")
async def register(
    username: str = Form(...),
    password: str = Form(...),
    name: str = Form(""),
    house_address: str = Form(""),
    email: str = Form(""),
    phone: str = Form(""),
    plates: str = Form(""),
    role: str = Form("household_member"),
    parent_username: str = Form(""),
    face_image: UploadFile = File(None),
):
    try:
        if not username or not password:
            return {"ok": False, "error": "Username and password are required"}

        if len(password) < 6:
            return {"ok": False, "error": "Password must be at least 6 characters"}

        if role == "head_of_household":
            if not house_address:
                return {"ok": False, "error": "House address is required for head of household"}

        if role == "household_member":
            if not parent_username:
                return {"ok": False, "error": "Parent username (head of household) is required"}

        # Normalize plates: strip spaces, uppercase
        if plates:
            plates = ", ".join(normalize_plate(p) for p in plates.split(",") if p.strip())

        conn = get_db()
        try:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()

            cur.execute("SELECT id FROM users WHERE username = ?", [username])
            if cur.fetchone():
                return {"ok": False, "error": "Username already exists"}

            cur.execute("SELECT id, status FROM registrations WHERE username = ?", [username])
            existing = cur.fetchone()
            if existing:
                if existing["status"] in ("pending", "approved"):
                    return {"ok": False, "error": "Registration already exists or pending for this username"}
                # Status is 'rejected' - allow re-registration by deleting old record
                print(f"[Register] Deleting rejected registration for {username}", flush=True)
                cur.execute("DELETE FROM registrations WHERE username = ?", [username])

            if role == "household_member" and parent_username:
                cur.execute("""
                    SELECT id FROM registrations
                    WHERE username = ? AND role = 'head_of_household' AND status = 'approved'
                """, [parent_username])
                head = cur.fetchone()
                if not head:
                    return {"ok": False, "error": "Head of household not found or not approved"}

            cur.execute("""
                INSERT INTO registrations (username, password, name, house_address, email, phone, plates, role, parent_username, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            """, [username, password, name, house_address, email, phone, plates, role, parent_username])

            # Handle face image if provided
            face_encoding = None
            face_filename = None
            if face_image and face_image.filename:
                face_image.file.seek(0)
                face_filename = save_resident_face_image(username, name, face_image)
                if face_filename:
                    face_image.file.seek(0)
                    face_encoding = encode_face_image(face_image)
                    if face_encoding:
                        encodings = load_resident_encodings()
                        encodings[username] = face_encoding
                        save_resident_encodings(encodings)
                    else:
                        print(f"[Register] Warning: No face detected in uploaded image for {username}")

            conn.commit()
        finally:
            conn.close()

        result = {"ok": True, "message": "Registration submitted."}
        if role == "head_of_household":
            result["message"] += " Please wait for admin approval."
        else:
            result["message"] += " Waiting for head of household approval."

        if face_image and face_image.filename:
            if face_encoding:
                result["message"] += " Face registered successfully."
            else:
                result["warning"] = "Face image saved but no face detected. You may need to upload a clearer photo."

        return result
    except sqlite3.IntegrityError as e:
        print(f"[Register] Integrity error: {e}", flush=True)
        return {"ok": False, "error": "Username already exists or database error"}
    except Exception as e:
        print(f"[Register] Error: {e}", flush=True)
        return {"ok": False, "error": str(e)}

@app.get("/api/registrations/pending")
async def get_pending_registrations(request: Request = None):
    require_admin(request)

    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM registrations WHERE status = 'pending' ORDER BY created_at DESC
    """)
    rows = cur.fetchall()
    conn.close()

    return {
        "ok": True,
        "data": [{"id": r["id"], "username": r["username"], "name": r["name"],
                  "house_address": r["house_address"], "email": r["email"],
                  "phone": r["phone"], "role": r["role"],
                  "parent_username": r["parent_username"],
                  "approved_by_head_at": r["approved_by_head_at"],
                  "created_at": r["created_at"],
                  "face_image": get_resident_face_path(r["username"]),
                  "avatar_url": get_avatar_path(r["username"])} for r in rows]
    }

@app.get("/api/registrations/head-pending")
async def get_head_pending_registrations(request: Request = None):
    session = require_auth(request)
    
    if session["role"] != "head_of_household":
        raise HTTPException(status_code=403, detail="Only head of household can view")
    
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM registrations 
        WHERE status = 'pending' AND role = 'household_member' AND parent_username = ?
        ORDER BY created_at DESC
    """, [session["username"]])
    rows = cur.fetchall()
    conn.close()
    
    return {
        "ok": True,
        "data": [{"id": r["id"], "username": r["username"], "name": r["name"],
                  "house_address": r["house_address"], "email": r["email"],
                  "phone": r["phone"], "created_at": r["created_at"]} for r in rows]
    }

@app.get("/api/notifications")
async def get_notifications(request: Request = None):
    session = require_auth(request)
    
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM notifications 
        WHERE username = ?
        ORDER BY created_at DESC
        LIMIT 50
    """, [session["username"]])
    rows = cur.fetchall()
    conn.close()
    
    return {
        "ok": True,
        "data": [{"id": r["id"], "title": r["title"], "message": r["message"],
                  "type": r["type"], "related_id": r["related_id"],
                  "is_read": r["is_read"], "created_at": r["created_at"]} for r in rows]
    }

@app.post("/api/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: int, request: Request = None):
    session = require_auth(request)
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE notifications SET is_read = 1 WHERE id = ? AND username = ?",
               [notif_id, session["username"]])
    conn.commit()
    conn.close()
    
    return {"ok": True}

@app.post("/api/notifications/read-all")
async def mark_all_notifications_read(request: Request = None):
    session = require_auth(request)
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE notifications SET is_read = 1 WHERE username = ?",
               [session["username"]])
    conn.commit()
    conn.close()
    
    return {"ok": True}

# ============ INTERNAL NOTIFICATION ENDPOINT ============

@app.post("/api/notifications/create")
async def create_notification_endpoint(request: Request = None):
    """Internal endpoint to create notifications from backend"""
    try:
        data = await request.json()
        username = data.get("username")
        title = data.get("title")
        message = data.get("message")
        notif_type = data.get("type", "general")
        related_id = data.get("related_id")
        
        if not username or not title or not message:
            return {"ok": False, "error": "Missing required fields"}
        
        create_notification(username, title, message, notif_type, related_id)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# ============ MESSAGE ENDPOINTS ============

@app.get("/api/messages")
async def get_messages(request: Request = None, folder: str = 'inbox'):
    session = require_auth(request)
    
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    if folder == 'sent':
        cur.execute("""
            SELECT * FROM messages 
            WHERE from_username = ?
            ORDER BY created_at DESC
            LIMIT 50
        """, [session["username"]])
    else:
        cur.execute("""
            SELECT * FROM messages 
            WHERE to_username = ?
            ORDER BY created_at DESC
            LIMIT 50
        """, [session["username"]])
    
    rows = cur.fetchall()
    conn.close()
    
    return {
        "ok": True,
        "data": [{
            "id": r["id"],
            "from_username": r["from_username"],
            "to_username": r["to_username"],
            "subject": r["subject"],
            "message": r["message"],
            "is_read": r["is_read"],
            "created_at": r["created_at"]
        } for r in rows]
    }

@app.post("/api/messages/send")
async def send_message(request: Request = None):
    session = require_auth(request)
    data = await request.json()
    
    to_username = data.get("to_username")
    subject = data.get("subject", "")
    message = data.get("message", "")
    
    if not to_username or not message:
        return {"ok": False, "error": "Recipient and message are required"}
    
    # Only head_of_household can send to admin
    if session["role"] == "household_member":
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT role FROM users WHERE username = ?", [to_username])
        to_user = cur.fetchone()
        conn.close()
        if not to_user or to_user[0] != "admin":
            return {"ok": False, "error": "Members can only send messages to admin"}
    
    create_message(session["username"], to_username, subject, message)
    
    # Create notification for recipient
    create_notification(to_username, "New Message", f"You have a new message from {session['username']}", "message")
    
    return {"ok": True, "message": "Message sent successfully"}

@app.post("/api/messages/{msg_id}/read")
async def mark_message_read(msg_id: int, request: Request = None):
    session = require_auth(request)
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE messages SET is_read = 1 WHERE id = ? AND to_username = ?",
               [msg_id, session["username"]])
    conn.commit()
    conn.close()
    
    return {"ok": True}

@app.get("/api/messages/recipients")
async def get_message_recipients(request: Request = None):
    session = require_auth(request)
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    if session["role"] == "admin":
        cur.execute("""
            SELECT r.username, r.name, r.house_address
            FROM registrations r
            WHERE r.status = 'approved' AND r.role IN ('head_of_household', 'household_member')
            ORDER BY r.name, r.username
        """)
        rows = cur.fetchall()
        conn.close()
        return {
            "ok": True,
            "data": [{"username": r["username"], "name": r["name"] or r["username"], "house_address": r["house_address"] or ""} for r in rows]
        }
    else:
        conn.close()
        return {
            "ok": True,
            "data": [{"username": "admin", "name": "Admin", "house_address": ""}]
        }

@app.post("/api/registrations/{reg_id}/approve")
async def approve_registration(reg_id: int, request: Request = None):
    require_admin(request)

    conn = get_db()
    try:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        cur.execute("SELECT * FROM registrations WHERE id = ? AND status = 'pending'", [reg_id])
        reg = cur.fetchone()

        if not reg:
            return {"ok": False, "error": "Registration not found or already processed"}

        if reg["role"] == "household_member" and not reg["approved_by_head_at"]:
            return {"ok": False, "error": "Waiting for head of household approval"}

        admin_session = get_session(request.headers.get("X-Session-Id"))
        user_role = reg["role"] if reg["role"] else "household_member"

        cur.execute("""
            INSERT INTO users (username, password, role) VALUES (?, ?, ?)
        """, [reg["username"], reg["password"], user_role])

        print(f"[Admin] Approving registration: {reg['username']} with role: {user_role}")

        cur.execute("""
            UPDATE registrations SET status = 'approved', approved_at = ?, approved_by = ?
            WHERE id = ?
        """, [int(time.time()), admin_session["username"], reg_id])

        # Add to R_data.json for face recognition system
        plates_list = [normalize_plate(p) for p in reg["plates"].split(",") if p.strip()] if reg["plates"] else []
        r_data = load_resident_data()
        r_data["penduduk"][reg["username"]] = {
            "nama": reg["name"] or reg["username"],
            "plat_nomor": plates_list
        }
        save_resident_data(r_data)

        conn.commit()

        # Create notification for admin
        create_notification("admin", "New Registration Approved",
                          f"Registration for {reg['username']} ({reg['role']}) has been approved",
                          "registration", str(reg_id))

        # Notify head if member approved
        if reg["role"] == "household_member" and reg["parent_username"]:
            create_notification(reg["parent_username"], "New Member Approved",
                              f"{reg['name'] or reg['username']} has been approved for your household",
                              "registration", str(reg_id))
    finally:
        conn.close()

    return {"ok": True, "message": "Registration approved"}

@app.post("/api/registrations/{reg_id}/head-approve")
async def head_approve_registration(reg_id: int, request: Request = None):
    session = require_auth(request)

    if session["role"] != "head_of_household":
        raise HTTPException(status_code=403, detail="Only head of household can approve")

    conn = get_db()
    try:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        cur.execute("SELECT * FROM registrations WHERE id = ? AND status = 'pending' AND role = 'household_member'", [reg_id])
        reg = cur.fetchone()

        if not reg:
            return {"ok": False, "error": "Registration not found or already processed"}

        if reg["parent_username"] != session["username"]:
            return {"ok": False, "error": "You can only approve members of your household"}

        cur.execute("""
            UPDATE registrations SET approved_by_head_at = ?, approved_by_head = ?
            WHERE id = ?
        """, [int(time.time()), session["username"], reg_id])

        conn.commit()

        create_notification("admin", "New Registration Pending",
                          f"Member {reg['username']} has been approved by head {session['username']}, waiting for admin approval",
                          "registration", str(reg_id))

    finally:
        conn.close()

    return {"ok": True, "message": "Member approved. Waiting for admin final approval."}

@app.post("/api/registrations/{reg_id}/reject")
async def reject_registration(reg_id: int, request: Request = None):
    session = require_auth(request)

    conn = get_db()
    try:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        cur.execute("SELECT * FROM registrations WHERE id = ? AND status = 'pending'", [reg_id])
        reg = cur.fetchone()

        if not reg:
            return {"ok": False, "error": "Registration not found or already processed"}

        if session["role"] == "head_of_household":
            if reg["role"] != "household_member" or reg["parent_username"] != session["username"]:
                return {"ok": False, "error": "You can only reject members of your household"}
        elif session["role"] not in ["admin"]:
            return {"ok": False, "error": "Forbidden"}

        cur.execute("""
            UPDATE registrations SET status = 'rejected', approved_at = ?, approved_by = ?
            WHERE id = ?
        """, [int(time.time()), session["username"], reg_id])

        print(f"[Reject] Updated rows: {cur.rowcount}, reg_id: {reg_id}, user: {reg['username']}", flush=True)

        cur.execute("SELECT status FROM registrations WHERE id = ?", [reg_id])
        verify_row = cur.fetchone()
        print(f"[Reject] Status after update: {verify_row['status'] if verify_row else 'NOT FOUND'}", flush=True)

        conn.commit()
    finally:
        conn.close()

    create_notification(reg["username"], "Registration Rejected",
                      f"Your registration has been rejected by {session['username']}",
                      "registration", str(reg_id))

    return {"ok": True, "message": "Registration rejected"}

@app.get("/api/auth/resident-info")
async def get_resident_info(request: Request = None):
    session_id = request.headers.get("X-Session-Id") if request else None
    session = get_session(session_id)
    
    if not session:
        return {"ok": False, "error": "Not authenticated"}
    
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    cur.execute("""
        SELECT * FROM registrations 
        WHERE username = ? AND status = 'approved'
    """, [session["username"]])
    
    row = cur.fetchone()
    conn.close()
    
    if row and row["name"]:
        def get_col(r, key, default=""):
            try:
                val = r[key]
                return val if val is not None else default
            except:
                return default
        
        return {
            "ok": True,
            "data": {
                "name": row["name"],
                "house_number": get_col(row, "house_address", "") or get_col(row, "house_number", ""),
                "email": get_col(row, "email", ""),
                "phone": get_col(row, "phone", ""),
                "username": session["username"],
                "role": session["role"]
            }
        }
    
    return {
        "ok": True,
        "data": {
            "name": session["username"],
            "house_number": "",
            "email": "",
            "phone": "",
            "username": session["username"],
            "role": session["role"]
        }
    }

@app.get("/api/profile/{username}")
async def get_profile(username: str, request: Request = None):
    session = require_auth(request)
    
    is_admin = session["role"] == "admin"
    is_self = session["username"] == username
    
    if not is_admin and not is_self:
        return {"ok": False, "error": "You can only view your own profile"}
    
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    cur.execute("""
        SELECT r.*, u.role as user_role
        FROM registrations r
        LEFT JOIN users u ON r.username = u.username
        WHERE r.username = ? AND r.status = 'approved'
    """, [username])
    reg = cur.fetchone()
    
    if not reg:
        cur.execute("SELECT * FROM users WHERE username = ?", [username])
        user_row = cur.fetchone()
        conn.close()
        if not user_row:
            return {"ok": False, "error": "User not found"}
        return {
            "ok": True,
            "data": {
                "username": user_row["username"],
                "name": user_row["username"],
                "email": "",
                "phone": "",
                "role": user_row["role"],
                "house_address": "",
                "face_image": None,
                "avatar_url": get_avatar_path(user_row["username"])
            }
        }
    
    face_image = get_resident_face_path(username)
    avatar_url = get_avatar_path(username)
    
    house_address = reg["house_address"] or ""
    if not house_address and reg["parent_username"]:
        cur.execute("SELECT house_address FROM registrations WHERE username = ? AND status = 'approved'", [reg["parent_username"]])
        parent = cur.fetchone()
        if parent and parent["house_address"]:
            house_address = parent["house_address"]
    
    conn.close()
    
    return {
        "ok": True,
        "data": {
            "username": reg["username"],
            "name": reg["name"] or "",
            "email": reg["email"] or "",
            "phone": reg["phone"] or "",
            "role": reg["role"] or reg["user_role"],
            "house_address": house_address,
            "face_image": face_image,
            "avatar_url": avatar_url
        }
    }

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    new_username: Optional[str] = None
    password: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

@app.put("/api/profile/{username}")
async def update_profile(username: str, request: Request = None, body: ProfileUpdateRequest = None):
    session = require_auth(request)
    
    is_admin = session["role"] == "admin"
    is_self = session["username"] == username
    
    if not is_admin and not is_self:
        return {"ok": False, "error": "You can only edit your own profile"}
    
    if body is None:
        return {"ok": False, "error": "Invalid request body"}
    
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    cur.execute("SELECT * FROM users WHERE username = ?", [username])
    user_row = cur.fetchone()
    if not user_row:
        conn.close()
        return {"ok": False, "error": "User not found"}
    
    cur.execute("SELECT * FROM registrations WHERE username = ? AND status = 'approved'", [username])
    reg_row = cur.fetchone()
    
    new_username = body.new_username.strip() if body.new_username else None
    
    if new_username and new_username != username:
        cur.execute("SELECT username FROM users WHERE username = ?", [new_username])
        if cur.fetchone():
            conn.close()
            return {"ok": False, "error": "Username already taken"}
    
    if body.password:
        if len(body.password) < 6:
            conn.close()
            return {"ok": False, "error": "Password must be at least 6 characters"}
        cur.execute("UPDATE users SET password = ? WHERE username = ?", [body.password, username])
        if reg_row:
            cur.execute("UPDATE registrations SET password = ? WHERE username = ?", [body.password, username])
    
    if body.name is not None and reg_row:
        cur.execute("UPDATE registrations SET name = ? WHERE username = ?", [body.name, username])
    if body.email is not None and reg_row:
        cur.execute("UPDATE registrations SET email = ? WHERE username = ?", [body.email, username])
    if body.phone is not None and reg_row:
        cur.execute("UPDATE registrations SET phone = ? WHERE username = ?", [body.phone, username])
    
    if new_username and new_username != username:
        cur.execute("UPDATE users SET username = ? WHERE username = ?", [new_username, username])
        if reg_row:
            cur.execute("UPDATE registrations SET username = ? WHERE username = ?", [new_username, username])
            cur.execute("SELECT username FROM registrations WHERE parent_username = ? AND status = 'approved'", [username])
            members = cur.fetchall()
            for m in members:
                cur.execute("UPDATE registrations SET parent_username = ? WHERE username = ?", [new_username, m["username"]])
        
        r_data = load_resident_data()
        if username in r_data.get("penduduk", {}):
            r_data["penduduk"][new_username] = r_data["penduduk"].pop(username)
            save_resident_data(r_data)
        
        encodings = load_resident_encodings()
        if username in encodings:
            encodings[new_username] = encodings.pop(username)
            save_resident_encodings(encodings)
        
        for f in RESIDENT_FACE_DIR.iterdir():
            if f.name.startswith(f"{username} - "):
                new_name = f.name.replace(f"{username} - ", f"{new_username} - ", 1)
                f.rename(RESIDENT_FACE_DIR / new_name)
                break
        
        old_avatar = AVATAR_DIR / f"{username}.jpg"
        if old_avatar.exists():
            old_avatar.rename(AVATAR_DIR / f"{new_username}.jpg")
        
        cur.execute("UPDATE notifications SET username = ? WHERE username = ?", [new_username, username])
        cur.execute("UPDATE messages SET from_username = ? WHERE from_username = ?", [new_username, username])
        cur.execute("UPDATE messages SET to_username = ? WHERE to_username = ?", [new_username, username])
        
        if session["username"] == username:
            session["username"] = new_username
        
        username = new_username
    
    conn.commit()
    conn.close()
    
    return {"ok": True, "message": "Profile updated successfully", "username": username}

@app.post("/api/profile/{username}/avatar")
async def upload_avatar(username: str, request: Request = None, avatar: UploadFile = File(None)):
    session = require_auth(request)
    
    is_admin = session["role"] == "admin"
    is_self = session["username"] == username
    
    if not is_admin and not is_self:
        return {"ok": False, "error": "You can only change your own avatar"}
    
    if not avatar or not avatar.filename:
        return {"ok": False, "error": "No image file provided"}
    
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if avatar.content_type not in allowed_types:
        return {"ok": False, "error": "Only JPG, PNG, and WebP images are allowed"}
    
    try:
        contents = await avatar.read()
        img = Image.open(__import__("io").BytesIO(contents))
        
        if img.mode in ('RGBA', 'LA', 'P'):
            if img.mode in ('RGBA', 'LA'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            else:
                img = img.convert('RGB')
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        img = img.resize((256, 256), Image.LANCZOS)
        
        avatar_path = AVATAR_DIR / f"{username}.jpg"
        img.save(str(avatar_path), "JPEG", quality=90)
        
        return {"ok": True, "message": "Avatar uploaded successfully", "avatar_url": f"/uploads/avatars/{username}.jpg"}
    except Exception as e:
        return {"ok": False, "error": f"Failed to process image: {str(e)}"}

@app.get("/api/residents")
async def get_residents(request: Request = None):
    require_admin(request)
    
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    cur.execute("""
        SELECT r.*, u.role as user_role, u.created_at as user_created_at
        FROM registrations r
        LEFT JOIN users u ON r.username = u.username
        WHERE r.status = 'approved' AND u.role IN ('head_of_household', 'household_member')
        ORDER BY r.house_address, u.role, r.approved_at DESC
    """)
    rows = cur.fetchall()
    conn.close()
    
    return {
        "ok": True,
        "data": [{
            "id": r["id"],
            "username": r["username"],
            "password": r["password"],
            "name": r["name"] or "",
            "house_address": r["house_address"] or "",
            "email": r["email"] or "",
            "phone": r["phone"] or "",
            "plates": r["plates"] or "",
            "role": r["role"],
            "parent_username": r["parent_username"],
            "created_at": r["created_at"],
            "approved_at": r["approved_at"],
            "approved_by": r["approved_by"]
        } for r in rows]
    }

@app.get("/api/residents/households")
async def get_households(request: Request = None):
    session = require_auth(request)
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    is_admin = session["role"] == "admin"
    
    # For non-admin, resolve their house_address
    user_house = None
    if not is_admin:
        cur.execute("SELECT house_address, parent_username FROM registrations WHERE username = ? AND status = 'approved'", [session["username"]])
        user_row = cur.fetchone()
        if user_row:
            user_house = user_row["house_address"]
            if not user_house and user_row["parent_username"]:
                cur.execute("SELECT house_address FROM registrations WHERE username = ? AND status = 'approved'", [user_row["parent_username"]])
                parent_row = cur.fetchone()
                if parent_row:
                    user_house = parent_row["house_address"]
    
    cur.execute("""
        SELECT DISTINCT house_address, username as head_username, name, email, phone, created_at
        FROM registrations
        WHERE status = 'approved' AND role = 'head_of_household' AND house_address IS NOT NULL AND house_address != ''
        ORDER BY house_address
    """)
    heads = cur.fetchall()
    households = []
    
    for h in heads:
        # Skip if non-admin and this is not their household
        if not is_admin and user_house and h["house_address"] != user_house:
            continue
        
        cur.execute("""
            SELECT id, username, name, email, phone, plates, created_at
            FROM registrations
            WHERE status = 'approved' AND parent_username = ?
        """, [h["head_username"]])
        members = cur.fetchall()
        
        vp_data = load_vp_data()
        house_vp = []
        for tid, vp_user in vp_data.get("vp", {}).items():
            if vp_user.get("house_address") == h["house_address"]:
                house_vp.append({"id": tid, "name": vp_user.get("name", ""), "plates": vp_user.get("plates", [vp_user.get("plate", "")]), "credits": vp_user.get("credits", 0), "active": vp_user.get("active", False)})
            elif vp_user.get("created_by") == h["head_username"]:
                if not any(t["id"] == tid for t in house_vp):
                    house_vp.append({"id": tid, "name": vp_user.get("name", ""), "plates": vp_user.get("plates", [vp_user.get("plate", "")]), "credits": vp_user.get("credits", 0), "active": vp_user.get("active", False)})
        
        # Get head plates
        head_plates = ""
        cur.execute("SELECT plates FROM registrations WHERE username = ?", [h["head_username"]])
        pw_row = cur.fetchone()
        if pw_row and pw_row["plates"]:
            head_plates = pw_row["plates"]
        
        head_data = {
            "username": h["head_username"],
            "name": h["name"] if h["name"] else "",
            "email": h["email"] or "",
            "phone": h["phone"] or "",
            "plates": head_plates,
            "created_at": h["created_at"],
            "password": "",
            "face_image": get_resident_face_path(h["head_username"]),
            "avatar_url": get_avatar_path(h["head_username"])
        }
        
        if is_admin:
            cur.execute("SELECT password FROM users WHERE username = ?", [h["head_username"]])
            pw_row = cur.fetchone()
            if pw_row and pw_row["password"]:
                head_data["password"] = pw_row["password"]
            else:
                cur.execute("SELECT password FROM registrations WHERE username = ?", [h["head_username"]])
                pw_row = cur.fetchone()
                if pw_row and pw_row["password"]:
                    head_data["password"] = pw_row["password"]

        members_data = []
        for m in members:
            member_password = ""
            if is_admin:
                cur.execute("SELECT password FROM users WHERE username = ?", [m["username"]])
                pw_row = cur.fetchone()
                if pw_row and pw_row["password"]:
                    member_password = pw_row["password"]
                else:
                    cur.execute("SELECT password FROM registrations WHERE id = ?", [m["id"]])
                    pw_row = cur.fetchone()
                    if pw_row and pw_row["password"]:
                        member_password = pw_row["password"]

            members_data.append({
                "id": m["id"],
                "username": m["username"],
                "name": m["name"] or "",
                "phone": m["phone"] or "",
                "email": m["email"] or "",
                "plates": m["plates"] or "",
                "created_at": m["created_at"],
                "password": member_password,
                "face_image": get_resident_face_path(m["username"]),
                "avatar_url": get_avatar_path(m["username"])
            })
        
        households.append({
            "house_address": h["house_address"],
            "head": head_data,
            "members": members_data,
            "vp": house_vp
        })
    
    conn.close()
    return {"ok": True, "data": households}

@app.get("/api/residents/faces/{filename}")
async def get_resident_face(filename: str):
    """Serve resident face image file."""
    file_path = RESIDENT_FACE_DIR / filename
    if file_path.exists() and file_path.is_file():
        return FileResponse(str(file_path), media_type="image/jpeg")
    raise HTTPException(status_code=404, detail="Face image not found")

@app.get("/api/residents/heads")
async def get_heads_for_registration(request: Request = None):
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT username, house_address, name, plates
        FROM registrations
        WHERE status = 'approved' AND role = 'head_of_household'
        ORDER BY name, username
    """)
    heads = cur.fetchall()
    conn.close()
    
    return {"ok": True, "data": [{"username": h["username"], "house_address": h["house_address"], "name": h["name"] or h["username"], "plates": h["plates"] or ""} for h in heads]}

@app.get("/api/residents/household-plates")
async def get_household_plates(request: Request = None, head_username: str = ""):
    """Return plates for a household. For head_of_household/household_member, returns their own plates.
    For admin, requires head_username parameter."""
    session = require_auth(request)
    
    username = head_username if session["role"] == "admin" and head_username else session["username"]
    
    conn = get_db()
    try:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT plates, parent_username FROM registrations WHERE username = ? AND status = 'approved'", [username])
        row = cur.fetchone()
        plates = []
        if row and row["plates"]:
            plates = [p.strip() for p in row["plates"].split(",") if p.strip()]
        elif row and row["parent_username"]:
            cur.execute("SELECT plates FROM registrations WHERE username = ? AND status = 'approved'", [row["parent_username"]])
            parent = cur.fetchone()
            if parent and parent["plates"]:
                plates = [p.strip() for p in parent["plates"].split(",") if p.strip()]
    finally:
        conn.close()
    
    return {"ok": True, "plates": plates}

@app.get("/api/test-password")
async def test_password():
    import sqlite3
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT username, password FROM users WHERE username = 'cepis'")
    row = cur.fetchone()
    conn.close()
    if row:
        return {"ok": True, "username": row["username"], "password_length": len(row["password"]) if row["password"] else 0, "has_password": bool(row["password"])}
    return {"ok": False, "error": "User not found"}

@app.post("/api/residents/{username}/reset-password")
async def reset_resident_password(username: str, request: Request = None):
    require_admin(request)
    
    data = await request.json()
    new_password = data.get("new_password")
    
    if not new_password or len(new_password) < 6:
        return {"ok": False, "error": "Password must be at least 6 characters"}
    
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    cur.execute("SELECT * FROM users WHERE username = ? AND role = 'resident'", [username])
    user = cur.fetchone()
    
    if not user:
        conn.close()
        return {"ok": False, "error": "Resident not found"}
    
    cur.execute("UPDATE users SET password = ? WHERE username = ?", [new_password, username])
    cur.execute("UPDATE registrations SET password = ? WHERE username = ?", [new_password, username])
    
    conn.commit()
    conn.close()
    
    return {"ok": True, "message": "Password reset successfully"}

@app.put("/api/residents/{username}/plates")
async def update_resident_plates(username: str, request: Request = None):
    """Update plates for a resident household. Admin can update any, head_of_household can update their own."""
    session = require_auth(request)
    
    try:
        body = await request.json()
    except:
        return {"ok": False, "error": "Invalid request body"}
    
    plates = body.get("plates", [])
    if not isinstance(plates, list):
        return {"ok": False, "error": "plates must be a list"}
    
    plates = [normalize_plate(p) for p in plates if p.strip()]
    plates_str = ", ".join(plates)
    
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    # Check user exists
    cur.execute("SELECT username, role, parent_username, house_address FROM registrations WHERE username = ? AND status = 'approved'", [username])
    user_row = cur.fetchone()
    if not user_row:
        conn.close()
        return {"ok": False, "error": "User not found"}
    
    # Authorization: admin can update any, head_of_household can update their own household
    if session["role"] != "admin":
        if session["role"] != "head_of_household":
            conn.close()
            return {"ok": False, "error": "Forbidden"}
        # Check it's the head user themselves or a member of their household
        if session["username"] != username:
            cur.execute("SELECT parent_username FROM registrations WHERE username = ? AND status = 'approved'", [username])
            target = cur.fetchone()
            if not target or target["parent_username"] != session["username"]:
                conn.close()
                return {"ok": False, "error": "Can only update plates in your own household"}
    
    # Update plates in registrations
    cur.execute("UPDATE registrations SET plates = ? WHERE username = ?", [plates_str, username])
    
    # If user is a head of household, propagate plates to all members
    usernames_to_update = [username]
    if user_row["role"] == "head_of_household":
        cur.execute("SELECT username FROM registrations WHERE parent_username = ? AND status = 'approved'", [username])
        members = cur.fetchall()
        for m in members:
            cur.execute("UPDATE registrations SET plates = ? WHERE username = ?", [plates_str, m["username"]])
            usernames_to_update.append(m["username"])
    
    conn.commit()
    conn.close()
    
    # Update R_data.json for all affected users
    r_data = load_resident_data()
    for uname in usernames_to_update:
        if uname in r_data.get("penduduk", {}):
            r_data["penduduk"][uname]["plat_nomor"] = plates
    save_resident_data(r_data)
    
    return {"ok": True, "message": "Plates updated successfully", "plates": plates}

@app.delete("/api/residents/{username}")
async def delete_resident(username: str, request: Request = None):
    require_admin(request)

    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Get user info from users table
    cur.execute("SELECT role FROM users WHERE username = ?", [username])
    user = cur.fetchone()

    if not user:
        conn.close()
        # Still try to clean up any orphaned data
        delete_resident_face(username)
        return {"ok": False, "error": "User not found"}

    role = user["role"]

    # Collect all usernames to clean up (head + their members)
    usernames_to_clean = [username]
    if role == "head_of_household":
        cur.execute("SELECT username FROM registrations WHERE parent_username = ?", [username])
        members = cur.fetchall()
        for m in members:
            member_username = m["username"]
            usernames_to_clean.append(member_username)
            cur.execute("DELETE FROM users WHERE username = ?", [member_username])
            cur.execute("DELETE FROM registrations WHERE username = ?", [member_username])

    # Delete the user and registration
    cur.execute("DELETE FROM users WHERE username = ?", [username])
    cur.execute("DELETE FROM registrations WHERE username = ?", [username])

    # Commit SQL changes first, then cleanup files/JSON independently
    conn.commit()
    conn.close()

    # Cleanup face data, encodings, and R_data.json for all affected users
    for uname in usernames_to_clean:
        delete_resident_face(uname)

    return {"ok": True, "message": f"User {username} deleted successfully"}

@app.get("/api/history/{history_type}")
async def get_history(history_type: str, request: Request = None, limit: int = 100):
    session_id = request.headers.get("X-Session-Id") if request else None
    if history_type == "command":
        require_auth(request)
    
    if history_type not in ["detection", "command"]:
        raise HTTPException(status_code=400, detail="Invalid history type")
    
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(f"SELECT topic, message, ts FROM {history_type} ORDER BY ts DESC LIMIT ?", [limit])
    rows = cur.fetchall()
    conn.close()
    
    return [{"topic": r["topic"], "message": r["message"], "ts": r["ts"]} for r in rows]

@app.delete("/api/history/{history_type}")
async def delete_history(history_type: str, request: Request = None):
    require_admin(request)
    
    if history_type not in ["detection", "command"]:
        raise HTTPException(status_code=400, detail="Invalid history type")
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute(f"DELETE FROM {history_type}")
    conn.commit()
    conn.close()
    
    return {"ok": True}

@app.get("/api/stats")
async def get_stats(request: Request = None):
    require_auth(request)
    
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    cur.execute("SELECT topic, message, ts FROM detection ORDER BY ts DESC LIMIT 1000")
    detections = cur.fetchall()
    cur.execute("SELECT topic, message, ts FROM command ORDER BY ts DESC LIMIT 100")
    commands = cur.fetchall()
    
    conn.close()
    
    now = int(time.time() * 1000)
    day_ago = now - (24 * 60 * 60 * 1000)
    
    stats = {
        "total_entry": 0,
        "total_exit": 0,
        "detection_valid": 0,
        "detection_invalid": 0,
        "hot_hours": {},
        "guest": {"total_entry": 0, "total_exit": 0, "still_inside": 0},
        "resident": {"total_entry": 0, "total_exit": 0},
        "vp": {"total_entry": 0, "total_exit": 0},
        "button": {"open_entry": 0, "open_exit": 0}
    }
    
    for entry in commands:
        if entry["ts"] < day_ago:
            continue
        msg = entry["message"]
        if "OPEN - ENTRY" in msg:
            stats["button"]["open_entry"] += 1
        if "OPEN - EXIT" in msg:
            stats["button"]["open_exit"] += 1
    
    guest_set = set()
    for entry in detections:
        if entry["ts"] < day_ago:
            continue
        try:
            msg = json.loads(entry["message"])
        except:
            continue
        
        hour = datetime.fromtimestamp(entry["ts"] / 1000).hour
        stats["hot_hours"][hour] = stats["hot_hours"].get(hour, 0) + 1
        
        face_valid = msg.get("face_valid", False)
        plate_valid = msg.get("plate_valid", False)
        person = msg.get("person", "")
        is_guest = person.startswith("G_") or person.startswith("GUEST-")
        is_vp = person.startswith("VP_")
        is_unknown = person.startswith("TEMP-") or person in ("Unknown", "Unknown Person", "Visitor", "")
        
        if msg.get("mode") == "ENTRY":
            stats["total_entry"] += 1
            if face_valid or plate_valid:
                stats["detection_valid"] += 1
            else:
                stats["detection_invalid"] += 1
            if is_guest:
                stats["guest"]["total_entry"] += 1
                guest_set.add(person)
            elif is_vp:
                stats["vp"]["total_entry"] += 1
            elif not is_unknown:
                stats["resident"]["total_entry"] += 1
        
        elif msg.get("mode") == "EXIT":
            stats["total_exit"] += 1
            if face_valid or plate_valid:
                stats["detection_valid"] += 1
            else:
                stats["detection_invalid"] += 1
            if is_guest:
                stats["guest"]["total_exit"] += 1
                guest_set.discard(person)
            elif is_vp:
                stats["vp"]["total_exit"] += 1
            elif not is_unknown:
                stats["resident"]["total_exit"] += 1
    
    guest_data = load_tamu_data()
    stats["guest"]["still_inside"] = len(guest_data.get("g", {}))
    stats["total_entry"] += stats["button"]["open_entry"]
    stats["total_exit"] += stats["button"]["open_exit"]
    
    return {"ok": True, "stats": stats}

def load_tamu_data():
    if TAMU_DATA_FILE.exists():
        try:
            return json.loads(TAMU_DATA_FILE.read_text())
        except:
            pass
    return {"g": {}}

def save_tamu_data(data):
    TAMU_DATA_FILE.write_text(json.dumps(data, indent=2))

@app.get("/api/tamu")
async def get_tamu(request: Request = None):
    require_auth(request)
    data = load_tamu_data()
    tamu_list = [
        {"id": k, "waktu": v.get("waktu"), "plat_nomor": v.get("plat_nomor"), "foto": v.get("foto")}
        for k, v in data.get("g", {}).items()
    ]
    return {"ok": True, "data": tamu_list}

@app.delete("/api/tamu/{tamu_id}")
async def delete_tamu(tamu_id: str, request: Request = None):
    require_admin(request)
    data = load_tamu_data()
    if tamu_id not in data.get("g", {}):
        raise HTTPException(status_code=404, detail="Tamu not found")
    del data["g"][tamu_id]
    save_tamu_data(data)
    return {"ok": True}

def load_vp_data():
    if VP_DATA_FILE.exists():
        try:
            return json.loads(VP_DATA_FILE.read_text())
        except:
            pass
    return {"vp": {}, "history": []}

def save_vp_data(data):
    VP_DATA_FILE.write_text(json.dumps(data, indent=2))

def load_vp_encodings():
    if VP_ENCODINGS_FILE.exists():
        try:
            return json.loads(VP_ENCODINGS_FILE.read_text())
        except:
            pass
    return {}

def save_vp_encodings(data):
    VP_ENCODINGS_FILE.write_text(json.dumps(data, indent=2))

def encode_face_image(image_file: UploadFile) -> Optional[list]:
    """Encode face from uploaded image file. Returns 128-dim encoding or None."""
    try:
        contents = image_file.file.read()
        img = Image.open(io.BytesIO(contents))

        if img.mode in ('RGBA', 'LA', 'P'):
            if img.mode == 'RGBA' or img.mode == 'LA':
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            else:
                img = img.convert('RGB')
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        img_np = np.array(img, dtype=np.uint8)
        if img_np.shape[2] == 4:
            img_np = img_np[:, :, :3]

        img_np = np.ascontiguousarray(img_np)

        encodings = face_recognition.face_encodings(img_np)
        if len(encodings) == 0:
            return None
        return encodings[0].tolist()
    except Exception as e:
        print(f"Error encoding face: {e}")
        return None

def save_resident_face_image(username: str, name: str, image_file: UploadFile) -> Optional[str]:
    """Save face image and return filename."""
    filename = f"{username} - {name}.jpg"
    dest = RESIDENT_FACE_DIR / filename
    
    contents = image_file.file.read()
    img = Image.open(__import__("io").BytesIO(contents))
    
    if img.mode in ('RGBA', 'LA', 'P'):
        if img.mode == 'RGBA' or img.mode == 'LA':
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        else:
            img = img.convert('RGB')
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    
    img.save(dest)
    return filename

def load_resident_encodings():
    if RESIDENT_ENCODE_FILE.exists():
        try:
            return json.loads(RESIDENT_ENCODE_FILE.read_text())
        except:
            pass
    return {}

def save_resident_encodings(data):
    RESIDENT_ENCODE_FILE.write_text(json.dumps(data, indent=2))

def load_resident_data():
    if RESIDENT_DATA_FILE.exists():
        try:
            return json.loads(RESIDENT_DATA_FILE.read_text())
        except:
            pass
    return {"penduduk": {}}

def save_resident_data(data):
    RESIDENT_DATA_FILE.write_text(json.dumps(data, indent=2))

def get_resident_face_path(username: str) -> Optional[str]:
    """Get face image path for a resident if it exists."""
    for f in RESIDENT_FACE_DIR.iterdir():
        if f.name.startswith(f"{username} - "):
            return f"/api/residents/faces/{f.name}"
    return None

def delete_resident_face(username: str):
    """Delete face image and encoding for a resident. Safe against filesystem errors."""
    try:
        for f in RESIDENT_FACE_DIR.iterdir():
            if f.name.startswith(f"{username} - "):
                f.unlink()
                break
    except Exception as e:
        print(f"[Cleanup] Error deleting face image for {username}: {e}")
    encodings = load_resident_encodings()
    if username in encodings:
        del encodings[username]
        save_resident_encodings(encodings)
    r_data = load_resident_data()
    if username in r_data.get("penduduk", {}):
        del r_data["penduduk"][username]
        save_resident_data(r_data)

def get_avatar_path(username: str) -> Optional[str]:
    """Get avatar image path for a user if it exists."""
    avatar_file = AVATAR_DIR / f"{username}.jpg"
    if avatar_file.exists():
        return f"/uploads/avatars/{username}.jpg"
    return None

def delete_vp_user(user_id: str):
    data = load_vp_data()
    if user_id in data.get("vp", {}):
        del data["vp"][user_id]
        save_vp_data(data)
        return True
    return False

def normalize_plate(plate: str):
    return "".join(c for c in plate.upper() if c.isalnum())

def get_vp_users(active_only: bool = True):
    data = load_vp_data()
    users = []
    for uid, u in data.get("vp", {}).items():
        u["id"] = uid
        # Resolve owner name (household head) from house_address
        house = u.get("house_address", "")
        if house:
            try:
                conn = get_db()
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                cur.execute("SELECT name, username FROM registrations WHERE house_address = ? AND role = 'head_of_household' AND status = 'approved' LIMIT 1", [house])
                head = cur.fetchone()
                if head:
                    u["owner_name"] = head["name"] or head["username"]
                    u["owner_username"] = head["username"]
                conn.close()
            except:
                pass
        if not u.get("owner_name"):
            u["owner_name"] = u.get("created_by", "-")
        # Resolve created_by display name
        creator = u.get("created_by", "")
        if creator:
            try:
                conn = get_db()
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                cur.execute("SELECT name FROM registrations WHERE username = ? AND status = 'approved'", [creator])
                row = cur.fetchone()
                if row and row["name"]:
                    u["created_by_name"] = row["name"]
                else:
                    u["created_by_name"] = creator
                conn.close()
            except:
                u["created_by_name"] = creator
        users.append(u)
    if active_only:
        users = [u for u in users if u.get("active", False)]
    return sorted(users, key=lambda x: x.get("created_at", ""), reverse=True)

@app.post("/api/plates/check-duplicates")
async def check_plates_duplicates(request: Request = None):
    try:
        body = await request.json()
    except:
        return {"ok": False, "error": "Invalid request body"}

    plates_to_check = body.get("plates", [])
    if not isinstance(plates_to_check, list):
        return {"ok": False, "error": "plates must be a list"}
    head_username = body.get("head_username", "")
    exclude_vp_id = body.get("exclude_vp_id", "")

    # Normalize input plates
    normalized_input = [normalize_plate(p) for p in plates_to_check if p.strip()]

    # Collect all existing plates -> owner mapping
    existing_plates = {}

    r_data = load_resident_data()
    for username, user_data in r_data.get("penduduk", {}).items():
        for plate in user_data.get("plat_nomor", []):
            norm = normalize_plate(plate)
            existing_plates.setdefault(norm, []).append({
                "type": "resident",
                "owner": user_data.get("nama", username),
                "username": username
            })

    vp_data = load_vp_data()
    for uid, user_data in vp_data.get("vp", {}).items():
        user_plates = user_data.get("plates", [])
        if not user_plates:
            user_plates = [p.strip() for p in user_data.get("plate", "").split(",") if p.strip()]
        for plate in user_plates:
            norm = normalize_plate(plate)
            existing_plates.setdefault(norm, []).append({
                "type": "vp",
                "owner": user_data.get("name", uid),
                "username": uid
            })

    # Check pending registrations too
    try:
        conn = get_db()
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT username, name, plates FROM registrations WHERE status = 'pending'")
        for row in cur.fetchall():
            if row["plates"]:
                for p in row["plates"].split(","):
                    p = p.strip()
                    if p:
                        norm = normalize_plate(p)
                        existing_plates.setdefault(norm, []).append({
                            "type": "pending_registration",
                            "owner": row["name"] or row["username"],
                            "username": row["username"]
                        })
        conn.close()
    except:
        pass

    # Collect plates to exclude (same household + current VP's own plates)
    exclude_plates = set()
    if exclude_vp_id:
        vp_data = load_vp_data()
        vp_user = vp_data.get("vp", {}).get(exclude_vp_id)
        if vp_user:
            for p in vp_user.get("plates", []):
                exclude_plates.add(normalize_plate(p))
            for p in vp_user.get("plate", "").split(","):
                p = p.strip()
                if p:
                    exclude_plates.add(normalize_plate(p))
    if head_username:
        try:
            conn = get_db()
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT plates, house_address FROM registrations WHERE username = ? AND status = 'approved'", [head_username])
            row = cur.fetchone()
            if row and row["plates"]:
                for p in row["plates"].split(","):
                    p = p.strip()
                    if p:
                        exclude_plates.add(normalize_plate(p))
            house_address = row["house_address"] if row else None
            cur.execute("SELECT plates FROM registrations WHERE parent_username = ? AND status = 'approved'", [head_username])
            for row in cur.fetchall():
                if row["plates"]:
                    for p in row["plates"].split(","):
                        p = p.strip()
                        if p:
                            exclude_plates.add(normalize_plate(p))
            conn.close()

            # Also exclude VP plates belonging to the same household
            vp_data = load_vp_data()
            for uid, user_data in vp_data.get("vp", {}).items():
                same_house = house_address and user_data.get("house_address") == house_address
                same_creator = user_data.get("created_by") == head_username
                if same_house or same_creator:
                    for p in user_data.get("plates", []):
                        exclude_plates.add(normalize_plate(p))
                    for p in user_data.get("plate", "").split(","):
                        p = p.strip()
                        if p:
                            exclude_plates.add(normalize_plate(p))
        except:
            pass

    duplicates = []
    for plate in normalized_input:
        if plate in existing_plates and plate not in exclude_plates:
            duplicates.append({
                "plate": plate,
                "owners": existing_plates[plate]
            })

    return {"ok": True, "duplicates": duplicates}

@app.get("/api/addresses")
async def get_addresses(request: Request = None):
    """Get all unique house addresses"""
    try:
        # Load from addresses.json
        if ADDRESSES_FILE.exists():
            addresses = json.loads(ADDRESSES_FILE.read_text())
            return {"ok": True, "data": addresses}
        return {"ok": True, "data": []}
    except Exception as e:
        print(f"Get addresses error: {e}")
        return {"ok": True, "data": []}

@app.post("/api/addresses")
async def add_address(request: Request = None):
    """Pre-add a house address for registration (admin only)"""
    session = require_admin(request)
    try:
        data = await request.json()
        address = data.get("address", "").strip()
        
        if not address:
            return {"ok": False, "error": "Address is required"}
        
        # Load existing addresses
        addresses = []
        if ADDRESSES_FILE.exists():
            addresses = json.loads(ADDRESSES_FILE.read_text())
        
        # Check if address already exists
        if address in addresses:
            return {"ok": False, "error": "Address already exists"}
        
        # Add new address
        addresses.append(address)
        addresses.sort()
        ADDRESSES_FILE.write_text(json.dumps(addresses, indent=2))
        
        return {"ok": True, "message": "Address added successfully"}
    except Exception as e:
        print(f"Add address error: {e}")
        return {"ok": False, "error": str(e)}

@app.delete("/api/addresses/{address}")
async def delete_address(address: str, request: Request = None):
    """Delete a house address (admin only)"""
    session = require_admin(request)
    # Addresses are derived from registrations/users, so we can't really delete them
    # This would require deleting the associated records
    return {"ok": False, "error": "Addresses are managed through registrations"}

@app.get("/api/vp")
async def get_vp(request: Request = None, active_only: bool = True):
    session = require_auth(request)
    users = get_vp_users(active_only=active_only)
    
        # Filter for head_of_household and household_member: show VPs created by them OR with matching house_address
    if session["role"] in ["head_of_household", "household_member"]:
        # Get house_address from registrations table
        user_address = None
        try:
            conn = get_db()
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT house_address, parent_username FROM registrations WHERE username = ? AND status = 'approved'", [session["username"]])
            row = cur.fetchone()
            if row and row["house_address"]:
                user_address = row["house_address"]
            elif row and row["parent_username"]:
                # For household_member, get parent's house_address
                cur.execute("SELECT house_address FROM registrations WHERE username = ? AND status = 'approved'", [row["parent_username"]])
                row2 = cur.fetchone()
                if row2 and row2["house_address"]:
                    user_address = row2["house_address"]
            conn.close()
            print(f"[DEBUG] VP filter for {session['username']}: user_address={user_address}")
        except Exception as e:
            print(f"[DEBUG] VP filter error: {e}")
        
        # Filter VPs: show if created_by = this user OR house_address matches OR created_by someone in same household
        filtered_users = []
        print(f"[DEBUG] VP filter for {session['username']}: checking {len(users)} VPs")
        
        # Get all usernames in the same household
        household_users = set()
        household_users.add(session["username"])
        try:
            conn = get_db()
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            if session["role"] == "household_member":
                # Get parent (head) username
                cur.execute("SELECT parent_username FROM registrations WHERE username = ? AND status = 'approved'", [session["username"]])
                row = cur.fetchone()
                if row and row["parent_username"]:
                    household_users.add(row["parent_username"])
                    # Get all members under this head
                    cur.execute("SELECT username FROM registrations WHERE parent_username = ? AND status = 'approved'", [row["parent_username"]])
                    for member_row in cur.fetchall():
                        household_users.add(member_row["username"])
            elif session["role"] == "head_of_household":
                # Get all members under this head
                cur.execute("SELECT username FROM registrations WHERE parent_username = ? AND status = 'approved'", [session["username"]])
                for member_row in cur.fetchall():
                    household_users.add(member_row["username"])
            conn.close()
            print(f"[DEBUG] VP filter for {session['username']}: household_users={household_users}")
        except Exception as e:
            print(f"[DEBUG] VP filter household users error: {e}")
        
        for u in users:
            created_by_match = u.get("created_by") in household_users
            address_match = user_address and u.get("house_address") == user_address
            if created_by_match or address_match:
                filtered_users.append(u)
        users = filtered_users
        print(f"[DEBUG] VP filtered for {session['username']}: {len(users)} VPs")
    
    # Add owner info for admin
    if session["role"] == "admin":
        for u in users:
            if u.get("created_by"):
                u["created_by_name"] = u["created_by"]
                # Try to get house_address if not set
                if not u.get("house_address") and u.get("created_by"):
                    try:
                        conn = get_db()
                        conn.row_factory = sqlite3.Row
                        cur = conn.cursor()
                        cur.execute("SELECT house_address FROM registrations WHERE username = ? AND status = 'approved'", [u["created_by"]])
                        row = cur.fetchone()
                        conn.close()
                        if row and row["house_address"]:
                            u["house_address"] = row["house_address"]
                    except:
                        pass
    
    return {"ok": True, "users": users, "stats": {"total": len(users)}}

@app.get("/api/vp/{user_id}")
async def get_vp_by_id(user_id: str, request: Request = None):
    require_auth(request)
    data = load_vp_data()
    user = data.get("vp", {}).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True, "user": user}

@app.post("/api/vp")
async def create_vp(
    name: str = Form(...),
    plate: List[str] = Form(...),
    credits: int = Form(0),
    head_username: str = Form(""),
    face_image: UploadFile = File(None),
    request: Request = None,
):
    session = require_auth(request)

    if not name or not plate:
        return {"ok": False, "error": "Name and plate are required"}

    # Normalize plates
    plate = [normalize_plate(p) for p in plate if p.strip()]
    if not plate:
        return {"ok": False, "error": "Invalid plate number(s)"}

    # Join multiple plates
    plates_str = ", ".join(plate)
    primary_plate = plate[0]

    # Generate user_id
    import hashlib
    user_id = hashlib.md5(f"{plates_str}{name}".encode()).hexdigest()[:8]

    vp_data = load_vp_data()

    if user_id in vp_data.get("vp", {}):
        return {"ok": False, "error": "VP already exists for this plate"}

    # Determine house_address based on role
    house_address = ""
    if session.get("role") == "admin":
        if head_username:
            conn = get_db()
            try:
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                cur.execute("SELECT house_address FROM registrations WHERE username = ? AND status = 'approved' AND role = 'head_of_household'", [head_username])
                head = cur.fetchone()
                if head and head["house_address"]:
                    house_address = head["house_address"]
            finally:
                conn.close()
    else:
        conn = get_db()
        try:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT house_address, parent_username FROM registrations WHERE username = ? AND status = 'approved'", [session["username"]])
            user = cur.fetchone()
            if user and user["house_address"]:
                house_address = user["house_address"]
            elif user and user["parent_username"]:
                cur.execute("SELECT house_address FROM registrations WHERE username = ? AND status = 'approved'", [user["parent_username"]])
                parent = cur.fetchone()
                if parent and parent["house_address"]:
                    house_address = parent["house_address"]
        finally:
            conn.close()

    # Determine if auto-activate based on role
    auto_activate = session.get("role") in ["admin", "head_of_household"]

    # Handle face image if provided
    face_encoding = None
    face_image_path = None
    face_image_path_orig = None
    if face_image and face_image.filename:
        # Save original image
        os.makedirs(PUBLIC_DIR / "uploads" / "vp", exist_ok=True)
        orig_dest = PUBLIC_DIR / "uploads" / "vp" / f"{user_id}_orig.jpg"
        contents = face_image.file.read()
        img = Image.open(__import__("io").BytesIO(contents))
        if img.mode in ('RGBA', 'LA', 'P'):
            if img.mode == 'RGBA' or img.mode == 'LA':
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            else:
                img = img.convert('RGB')
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        img.save(orig_dest)
        face_image_path_orig = f"/uploads/vp/{user_id}_orig.jpg"

        # Encode face
        face_image.file.seek(0)
        face_encoding = encode_face_image(face_image)
        if face_encoding:
            encodings = load_vp_encodings()
            encodings[user_id] = face_encoding
            save_vp_encodings(encodings)
            face_image_path = f"/uploads/vp/{user_id}.jpg"
            # Also save a processed copy
            img.save(PUBLIC_DIR / "uploads" / "vp" / f"{user_id}.jpg")
        else:
            print(f"[VP] Warning: No face detected in uploaded image for {name}")

    vp_data.setdefault("vp", {})[user_id] = {
        "name": name,
        "plates": plate,
        "plate": plates_str,
        "plate_original": plates_str,
        "house_address": house_address,
        "credits": credits,
        "active": auto_activate,
        "created_by": session["username"],
        "created_at": datetime.now().isoformat(),
        "face_image": face_image_path,
        "face_image_orig": face_image_path_orig,
    }

    save_vp_data(vp_data)

    # Notify admin
    create_notification("admin", "New VP Added",
                      f"VP {name} with plate(s) {plates_str} added by {session['username']}",
                      "vp", user_id)

    # Notify head of household if house_address resolved
    if house_address:
        try:
            conn = get_db()
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT username FROM registrations WHERE house_address = ? AND role = 'head_of_household'", [house_address])
            head = cur.fetchone()
            if head and head["username"] != session.get("username"):
                create_notification(head["username"], "New VP Added to Your Household",
                              f"VP {name} with plate(s) {plates_str} has been added",
                              "vp", user_id)
            conn.close()
        except Exception as e:
            print(f"Error notifying head: {e}")

    status = "active" if auto_activate else "pending approval"
    result = {"ok": True, "user_id": user_id, "user": vp_data["vp"][user_id], "message": f"VP added successfully ({status})"}
    if face_image and face_image.filename and not face_encoding:
        result["warning"] = "Face image saved but no face detected. Upload a clearer photo."
    return result

@app.post("/api/vp/check")
async def check_vp(request: VPCheckRequest):
    if not request.face_encoding or not request.plate:
        return {"ok": True, "matched": False, "reason": "missing_data"}
    
    data = load_vp_data()
    normalized_plate = normalize_plate(request.plate)
    
    face_match = None
    plate_match = None
    
    for user_id, user in data.get("vp", {}).items():
        if not user.get("active", False):
            continue
        
        # Check all plates associated with this VP
        user_plates = user.get("plates", [])
        if not user_plates:
            user_plates = [p.strip() for p in user.get("plate", "").split(",") if p.strip()]
        for up in user_plates:
            if normalize_plate(up) == normalized_plate:
                plate_match = {"id": user_id, **user}
                break
        
        encodings = load_vp_encodings()
        if user_id in encodings:
            stored = encodings[user_id]
            distance = sum((a - b) ** 2 for a, b in zip(request.face_encoding, stored)) ** 0.5
            if distance < 0.45:
                face_match = {"id": user_id, **user, "distance": distance}
    
    if not face_match or not plate_match:
        # Security alert - unrecognized vehicle/person
        try:
            conn = get_db()
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            
            # Get head of household for this plate if exists
            cur.execute("SELECT parent_username FROM registrations WHERE plates LIKE ?", [f"%{request.plate}%"])
            reg = cur.fetchone()
            
            if reg and reg["parent_username"]:
                # Notify the head of household
                create_notification(reg["parent_username"], "Security Alert", 
                                  f"Unrecognized vehicle/face detected at gate with plate: {request.plate}", 
                                  "security", None)
            
            # Notify admin
            create_notification("admin", "Security Alert", 
                              f"Unrecognized vehicle/face detected at gate with plate: {request.plate}", 
                              "security", None)
            
            conn.close()
        except Exception as e:
            print(f"Error creating security alert: {e}")
        
        return {"ok": True, "matched": False, "reason": "not_matched"}
    
    if face_match["id"] != plate_match["id"]:
        # Security alert - mismatch (stolen plate or face)
        try:
            create_notification("admin", "Security Alert - Mismatch", 
                              f"Face and plate mismatch detected at gate. Plate: {request.plate}", 
                              "security", None)
        except Exception as e:
            print(f"Error creating security alert: {e}")
        
        return {"ok": True, "matched": False, "reason": "mismatch"}
    
    user_id = face_match["id"]
    user = data["vp"][user_id]
    user["credits"] = user.get("credits", 0) - 1
    user["use_count"] = user.get("use_count", 0) + 1
    user["last_used"] = datetime.now().isoformat()
    
    if user["credits"] <= 0:
        user["active"] = False
    
    save_vp_data(data)
    
    return {
        "ok": True,
        "matched": True,
        "user": {
            "id": user_id,
            "name": user.get("name"),
            "plate": user.get("plate_original"),
            "credits": user["credits"],
            "action": "expired" if user["credits"] <= 0 else "used"
        }
    }

@app.patch("/api/vp/{user_id}")
async def update_vp(user_id: str, request: Request = None):
    try:
        session = require_auth(request)
        # Allow admin or head_of_household (only for their household)
        if session["role"] not in ["admin", "head_of_household"]:
            raise HTTPException(status_code=403, detail="Forbidden")
        
        # Read from request body
        try:
            body = await request.json()
        except:
            body = {}
        
        credits = body.get("credits")
        name = body.get("name")
        plates = body.get("plates")
        catatan = body.get("catatan")
        
        # Get user from VP data
        data = load_vp_data()
        if user_id not in data.get("vp", {}):
            raise HTTPException(status_code=404, detail="User not found")
        
        user = data["vp"][user_id]
        
        # For head_of_household, look up their house_address from DB
        if session["role"] == "head_of_household":
            vp_house = user.get("house_address")
            conn = get_db()
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT house_address, parent_username FROM registrations WHERE username = ? AND status = 'approved'", [session["username"]])
            row = cur.fetchone()
            user_house = row["house_address"] if row and row["house_address"] else None
            if not user_house and row and row["parent_username"]:
                cur.execute("SELECT house_address FROM registrations WHERE username = ? AND status = 'approved'", [row["parent_username"]])
                parent = cur.fetchone()
                user_house = parent["house_address"] if parent else None
            conn.close()
            if not vp_house or vp_house != user_house:
                raise HTTPException(status_code=403, detail="Can only edit VPs in your household")
        
        if credits is not None:
            data["vp"][user_id]["credits"] = int(credits)
            data["vp"][user_id]["active"] = int(credits) > 0
        if name is not None:
            data["vp"][user_id]["name"] = str(name)
        if plates is not None and isinstance(plates, list):
            plates = [normalize_plate(p) for p in plates if p.strip()]
            plates_str = ", ".join(plates)
            data["vp"][user_id]["plates"] = plates
            data["vp"][user_id]["plate"] = plates_str
            data["vp"][user_id]["plate_original"] = plates_str
        if catatan is not None:
            data["vp"][user_id]["catatan"] = str(catatan)
        
        save_vp_data(data)
        
        return {"ok": True, "user": data["vp"][user_id]}
    except Exception as e:
        print(f"Update VP error: {e}")
        return {"ok": False, "error": str(e)}

@app.delete("/api/vp/{user_id}")
async def delete_vp(user_id: str, request: Request = None):
    session = require_auth(request)
    if session["role"] not in ["admin", "head_of_household"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    data = load_vp_data()
    if user_id not in data.get("vp", {}):
        return {"ok": False, "error": "User not found"}

    # For head_of_household, check if VP belongs to their household
    if session["role"] == "head_of_household":
        vp_house = data["vp"][user_id].get("house_address")
        conn = get_db()
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT house_address, parent_username FROM registrations WHERE username = ? AND status = 'approved'", [session["username"]])
        row = cur.fetchone()
        user_house = row["house_address"] if row and row["house_address"] else None
        if not user_house and row and row["parent_username"]:
            cur.execute("SELECT house_address FROM registrations WHERE username = ? AND status = 'approved'", [row["parent_username"]])
            parent = cur.fetchone()
            user_house = parent["house_address"] if parent else None
        conn.close()
        if not vp_house or vp_house != user_house:
            raise HTTPException(status_code=403, detail="Can only delete VPs in your household")

    # Delete face images
    vp_user = data["vp"][user_id]
    for img_field in ["face_image", "face_image_orig"]:
        img_path = vp_user.get(img_field)
        if img_path:
            full_path = PUBLIC_DIR / img_path.lstrip("/")
            if full_path.exists():
                full_path.unlink()

    # Delete face encoding
    encodings = load_vp_encodings()
    if user_id in encodings:
        del encodings[user_id]
        save_vp_encodings(encodings)

    del data["vp"][user_id]
    save_vp_data(data)

    return {"ok": True}

def get_user_house_address(username: str) -> Optional[str]:
    """Get house address for a user from registrations table."""
    try:
        conn = get_db()
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT house_address, parent_username FROM registrations WHERE username = ? AND status = 'approved'", [username])
        row = cur.fetchone()
        if row:
            if row["house_address"]:
                conn.close()
                return row["house_address"]
            if row["parent_username"]:
                cur.execute("SELECT house_address FROM registrations WHERE username = ? AND status = 'approved'", [row["parent_username"]])
                parent = cur.fetchone()
                conn.close()
                return parent["house_address"] if parent else None
        conn.close()
    except:
        pass
    return None

def normalize_plate_for_key(plate: str) -> str:
    """Normalize plate for comparison - remove spaces and uppercase."""
    if not plate or plate == "-":
        return ""
    return "".join(c for c in plate.upper() if c.isalnum())

@app.get("/api/sessions/vehicle-status")
async def get_vehicle_status(request: Request = None):
    """Get vehicle status grouped by household.
    
    For residents/HH: Shows ALL registered plates with status (inside/outside).
    - Inside = last detection was ENTRY (Green)
    - Outside = last detection was EXIT (Red) or no detections yet (Gray)
    
    For VP: Same logic - their registered plates with status.
    
    For Guests: Only show currently inside, with color by duration:
    - <12h = Green
    - 12-24h = Orange
    - >24h = Red
    """
    session = require_auth(request)
    is_admin = session["role"] == "admin"
    user_house = None
    
    if not is_admin:
        user_house = get_user_house_address(session["username"])
    
    now_ts = int(time.time() * 1000)
    TWELVE_HOURS = 12 * 60 * 60 * 1000
    TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
    
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    cur.execute("""
        SELECT id, message, ts FROM detection 
        ORDER BY ts DESC 
        LIMIT 3000
    """)
    detections = cur.fetchall()
    
    plate_last_detection = {}
    person_plate_map = {}
    
    for entry in detections:
        try:
            msg = json.loads(entry["message"])
        except:
            continue
        
        person = msg.get("person", "")
        plate = msg.get("plat", "-")
        mode = msg.get("mode", "")
        ts = entry["ts"]
        
        if mode not in ("ENTRY", "EXIT"):
            continue
        
        plate_key = normalize_plate_for_key(plate)
        
        if person and person not in ("Unknown", "", "Unknown Person"):
            if person not in person_plate_map:
                person_plate_map[person] = {
                    "plate": plate,
                    "face_valid": msg.get("face_valid", False),
                    "plate_valid": msg.get("plate_valid", False)
                }
        
        if plate_key:
            if plate_key not in plate_last_detection:
                plate_last_detection[plate_key] = {
                    "mode": mode,
                    "ts": ts,
                    "person": person,
                    "face_valid": msg.get("face_valid", False),
                    "plate_valid": msg.get("plate_valid", False)
                }
    
    households = []
    households_map = {}
    
    if is_admin:
        cur.execute("""
            SELECT DISTINCT house_address, username as head_username, name, plates
            FROM registrations
            WHERE status = 'approved' AND role = 'head_of_household' 
              AND house_address IS NOT NULL AND house_address != ''
            ORDER BY house_address
        """)
    else:
        cur.execute("""
            SELECT DISTINCT house_address, username as head_username, name, plates
            FROM registrations
            WHERE status = 'approved' AND role = 'head_of_household' 
              AND house_address IS NOT NULL AND house_address != ''
              AND house_address = ?
            ORDER BY house_address
        """, [user_house or ""])
    
    heads = cur.fetchall()
    
    for head in heads:
        house_address = head["house_address"]
        if not house_address:
            continue
            
        head_info = {
            "house_address": house_address,
            "head_name": head["name"] or head["head_username"],
            "head_username": head["head_username"],
            "vehicles": []
        }
        
        added_plates = set()
        
        head_plates_str = head["plates"] or ""
        head_plates = [p.strip() for p in head_plates_str.split(",") if p.strip()]
        for hp in head_plates:
            plate_key = normalize_plate_for_key(hp)
            if plate_key and plate_key not in added_plates:
                added_plates.add(plate_key)
                last_det = plate_last_detection.get(plate_key)
                
                if last_det:
                    status = "inside" if last_det["mode"] == "ENTRY" else "outside"
                    vehicle = {
                        "plate": hp,
                        "driver": last_det.get("person", head["name"] or head["head_username"]),
                        "driver_username": head["head_username"] if last_det.get("person") == head["head_username"] else last_det.get("person"),
                        "status": status,
                        "last_ts": last_det["ts"],
                        "last_mode": last_det["mode"],
                        "type": "resident",
                        "face_image": get_resident_face_path(head["head_username"]),
                        "avatar_url": get_avatar_path(head["head_username"]),
                        "face_valid": last_det.get("face_valid", False),
                        "plate_valid": last_det.get("plate_valid", False)
                    }
                else:
                    vehicle = {
                        "plate": hp,
                        "driver": head["name"] or head["head_username"],
                        "driver_username": head["head_username"],
                        "status": "unknown",
                        "last_ts": None,
                        "last_mode": None,
                        "type": "resident",
                        "face_image": get_resident_face_path(head["head_username"]),
                        "avatar_url": get_avatar_path(head["head_username"]),
                        "face_valid": True,
                        "plate_valid": True
                    }
                head_info["vehicles"].append(vehicle)
        
        if is_admin:
            cur.execute("""
                SELECT username, name, plates
                FROM registrations
                WHERE status = 'approved' AND role = 'household_member' 
                  AND parent_username = ?
            """, [head["head_username"]])
        else:
            cur.execute("""
                SELECT username, name, plates
                FROM registrations
                WHERE status = 'approved' AND role = 'household_member' 
                  AND parent_username = ?
            """, [head["head_username"]])
        
        members = cur.fetchall()
        for mem in members:
            mem_plates_str = mem["plates"] or ""
            mem_plates = [p.strip() for p in mem_plates_str.split(",") if p.strip()]
            for mp in mem_plates:
                plate_key = normalize_plate_for_key(mp)
                if plate_key and plate_key not in added_plates:
                    added_plates.add(plate_key)
                    last_det = plate_last_detection.get(plate_key)
                    
                    if last_det:
                        status = "inside" if last_det["mode"] == "ENTRY" else "outside"
                        vehicle = {
                            "plate": mp,
                            "driver": last_det.get("person", mem["name"] or mem["username"]),
                            "driver_username": last_det.get("person") or mem["username"],
                            "status": status,
                            "last_ts": last_det["ts"],
                            "last_mode": last_det["mode"],
                            "type": "resident",
                            "face_image": get_resident_face_path(mem["username"]),
                            "avatar_url": get_avatar_path(mem["username"]),
                            "face_valid": last_det.get("face_valid", False),
                            "plate_valid": last_det.get("plate_valid", False)
                        }
                    else:
                        vehicle = {
                            "plate": mp,
                            "driver": mem["name"] or mem["username"],
                            "driver_username": mem["username"],
                            "status": "unknown",
                            "last_ts": None,
                            "last_mode": None,
                            "type": "resident",
                            "face_image": get_resident_face_path(mem["username"]),
                            "avatar_url": get_avatar_path(mem["username"]),
                            "face_valid": True,
                            "plate_valid": True
                        }
                    head_info["vehicles"].append(vehicle)
        
        if head_info["vehicles"]:
            households_map[house_address] = head_info
            households.append(head_info)
    
    vp_users_list = []
    vp_data = load_vp_data()
    
    for tid, vp_user in vp_data.get("vp", {}).items():
        if not vp_user.get("active", False):
            continue
        
        vp_house = vp_user.get("house_address", "")
        
        if not is_admin and user_house:
            if vp_house != user_house:
                continue
        
        vp_plates = vp_user.get("plates", [])
        if not vp_plates:
            plate_str = vp_user.get("plate", "")
            vp_plates = [p.strip() for p in plate_str.split(",") if p.strip()]
        
        vp_vehicles = []
        for tp in vp_plates:
            plate_key = normalize_plate_for_key(tp)
            if plate_key:
                last_det = plate_last_detection.get(plate_key)
                if last_det:
                    status = "inside" if last_det["mode"] == "ENTRY" else "outside"
                    vp_vehicles.append({
                        "plate": tp,
                        "driver": vp_user.get("name", f"VP_{tid}"),
                        "status": status,
                        "last_ts": last_det["ts"],
                        "last_mode": last_det["mode"],
                        "face_image": vp_user.get("face_image"),
                        "face_valid": last_det.get("face_valid", False),
                        "plate_valid": last_det.get("plate_valid", False)
                    })
                else:
                    vp_vehicles.append({
                        "plate": tp,
                        "driver": vp_user.get("name", f"VP_{tid}"),
                        "status": "unknown",
                        "last_ts": None,
                        "last_mode": None,
                        "face_image": vp_user.get("face_image"),
                        "face_valid": True,
                        "plate_valid": True
                    })
        
        if vp_vehicles:
            vp_users_list.append({
                "id": tid,
                "name": vp_user.get("name", f"VP_{tid}"),
                "house_address": vp_house,
                "credits": vp_user.get("credits", 0),
                "vehicles": vp_vehicles
            })
    
    guests_list = []
    tamu_data = load_tamu_data()
    
    for gid, gdata in tamu_data.get("g", {}).items():
        entry_ts = int(time.time() * 1000)
        g_waktu = gdata.get("waktu")
        if g_waktu:
            try:
                from datetime import datetime
                guest_time = datetime.fromisoformat(g_waktu)
                entry_ts = int(guest_time.timestamp() * 1000)
            except:
                pass
        
        guest_plate = gdata.get("plat_nomor")
        if guest_plate:
            plate_key = normalize_plate_for_key(guest_plate)
            if plate_key in plate_last_detection:
                last_det = plate_last_detection[plate_key]
                if last_det["mode"] == "ENTRY":
                    entry_ts = last_det["ts"]
        
        duration = now_ts - entry_ts
        if duration < TWELVE_HOURS:
            duration_status = "green"
        elif duration < TWENTY_FOUR_HOURS:
            duration_status = "orange"
        else:
            duration_status = "red"
        
        guests_list.append({
            "id": str(gid),
            "person": f"G_{gid}",
            "plate": guest_plate or "-",
            "entry_ts": entry_ts,
            "duration_ms": duration,
            "duration_hours": round(duration / (60 * 60 * 1000), 1),
            "duration_status": duration_status,
            "face_image": gdata.get("foto")
        })
    
    guests_list.sort(key=lambda x: x["entry_ts"], reverse=True)
    
    conn.close()
    
    return {
        "ok": True,
        "households": households,
        "vp_users": vp_users_list,
        "guests": guests_list,
        "is_admin": is_admin,
        "user_house": user_house,
        "now_ts": now_ts
    }

@app.post("/api/command")
async def send_command(request: CommandRequest, req: Request = None):
    require_admin(req)
    
    if request.command not in ["OPEN - ENTRY", "OPEN - EXIT"]:
        raise HTTPException(status_code=400, detail="Invalid command")
    
    now_ms = int(time.time() * 1000)
    mode = "ENTRY" if "ENTRY" in request.command else "EXIT"
    gate_name = f"GATE {mode}"
    detection_msg = json.dumps({
        "person": gate_name,
        "plat": "-",
        "face_valid": True,
        "plate_valid": True,
        "mode": mode,
        "source": "admin_button",
        "time": datetime.now().isoformat()
    })

    conn = get_db()
    cur = conn.cursor()
    cur.execute("INSERT INTO command (topic, message, ts) VALUES (?, ?, ?)",
                ["gate/command", json.dumps({"command": request.command, "time": datetime.now().isoformat()}), now_ms])
    cur.execute("INSERT INTO detection (topic, message, ts) VALUES (?, ?, ?)",
                ["gate/detection", detection_msg, now_ms])
    conn.commit()
    conn.close()
    
    if mgr["mqtt_client"]:
        payload = json.dumps({"command": request.command, "time": datetime.now().isoformat()})
        mgr["mqtt_client"].publish("gate/command", payload, qos=1)
    
    return {"ok": True}

# Catch-all route for React Router (must be last)
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    file_path = PUBLIC_DIR / "dist" / full_path
    if file_path.is_file():
        return FileResponse(str(file_path))
    index_path = PUBLIC_DIR / "dist" / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "SecurePass API", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    start_mqtt()
    uvicorn.run(sio_app, host="0.0.0.0", port=3000)