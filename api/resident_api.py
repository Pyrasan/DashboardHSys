"""
Resident & Registration API - Clean organized endpoints
"""
import sqlite3
import time
from fastapi import HTTPException, Request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_PATH = BASE_DIR / "db" / "history.db"

# ============ HELPER FUNCTIONS ============

def get_db():
    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def require_auth(request: Request = None):
    from api import sessions
    session_id = request.headers.get("X-Session-Id") if request else None
    if not session_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return session

def require_admin(request: Request = None):
    session = require_auth(request)
    if session["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden - Admin only")
    return session

def respond(success=True, data=None, error=None, status=200):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        content={"ok": success, "data": data, "error": error},
        status_code=200 if success else status
    )

# ============ REGISTRATION ENDPOINTS ============

async def register_user(data: dict):
    """Register new user (head_of_household or household_member)"""
    try:
        username = data.get("username")
        password = data.get("password")
        name = data.get("name", "")
        house_address = data.get("house_address", "")
        email = data.get("email", "")
        phone = data.get("phone", "")
        plates = data.get("plates", "")
        role = data.get("role", "household_member")
        parent_username = data.get("parent_username", "")
        
        if not username or not password:
            return respond(False, error="Username and password are required")
        
        if len(password) < 6:
            return respond(False, error="Password must be at least 6 characters")
        
        if role == "head_of_household" and not house_address:
            return respond(False, error="House address is required for head of household")
        
        if role == "household_member" and not parent_username:
            return respond(False, error="Parent username (head of household) is required")
        
        conn = get_db()
        cur = conn.cursor()
        
        # Check if username exists
        cur.execute("SELECT id FROM users WHERE username = ?", [username])
        if cur.fetchone():
            conn.close()
            return respond(False, error="Username already exists")
        
        cur.execute("SELECT id FROM registrations WHERE username = ?", [username])
        if cur.fetchone():
            conn.close()
            return respond(False, error="Registration already pending for this username")
        
        # For household_member, verify head exists and is approved
        if role == "household_member" and parent_username:
            cur.execute("SELECT id FROM registrations WHERE username = ? AND role = 'head_of_household' AND status = 'approved'", [parent_username])
            if not cur.fetchone():
                conn.close()
                return respond(False, error="Head of household not found or not approved")
        
        # Insert registration
        cur.execute("""
            INSERT INTO registrations (username, password, name, house_address, email, phone, plates, role, parent_username, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        """, [username, password, name, house_address, email, phone, plates, role, parent_username, int(time.time())])
        
        conn.commit()
        conn.close()
        
        msg = "Registration submitted. Waiting for head approval." if role == "household_member" else "Registration submitted. Waiting for admin approval."
        return respond(True, data={"message": msg})
    except Exception as e:
        return respond(False, error=str(e))

async def get_pending_registrations(request: Request = None):
    """Admin: Get all pending registrations"""
    require_admin(request)
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM registrations 
        WHERE status = 'pending' 
        ORDER BY created_at DESC
    """)
    rows = cur.fetchall()
    conn.close()
    
    data = []
    for r in rows:
        status_color = "amber"
        status_text = "Waiting for head approval"
        
        if r["role"] == "head_of_household":
            status_color = "blue"
            status_text = "Waiting for admin approval"
        elif r["role"] == "household_member" and r["approved_by_head_at"]:
            status_color = "green"
            status_text = "Head approved - Waiting for admin approval"
        
        data.append({
            "id": r["id"],
            "username": r["username"],
            "name": r["name"],
            "house_address": r["house_address"],
            "email": r["email"],
            "phone": r["phone"],
            "role": r["role"],
            "parent_username": r["parent_username"],
            "status": r["status"],
            "status_text": status_text,
            "status_color": status_color,
            "approved_by_head_at": r["approved_by_head_at"],
            "created_at": r["created_at"],
            "rejected": r["status"] == "rejected"
        })
    
    return respond(True, data=data)

async def get_head_pending_registrations(request: Request = None):
    """Head: Get pending members for approval"""
    session = require_auth(request)
    
    if session["role"] != "head_of_household":
        raise HTTPException(status_code=403, detail="Only head of household can view")
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM registrations 
        WHERE status = 'pending' AND role = 'household_member' AND parent_username = ?
        ORDER BY created_at DESC
    """, [session["username"]])
    rows = cur.fetchall()
    conn.close()
    
    data = [{
        "id": r["id"],
        "username": r["username"],
        "name": r["name"],
        "email": r["email"],
        "phone": r["phone"],
        "house_address": r["house_address"],
        "created_at": r["created_at"]
    } for r in rows]
    
    return respond(True, data=data)

async def head_approve_registration(reg_id: int, request: Request = None):
    """Head: Approve member registration"""
    session = require_auth(request)
    
    if session["role"] != "head_of_household":
        raise HTTPException(status_code=403, detail="Only head of household can approve")
    
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute("SELECT * FROM registrations WHERE id = ? AND status = 'pending' AND role = 'household_member'", [reg_id])
    reg = cur.fetchone()
    
    if not reg:
        conn.close()
        return respond(False, error="Registration not found or already processed")
    
    if reg["parent_username"] != session["username"]:
        conn.close()
        return respond(False, error="Not authorized to approve this registration")
    
    cur.execute("""
        UPDATE registrations 
        SET approved_by_head_at = ?, approved_by_head = ?
        WHERE id = ?
    """, [int(time.time()), session["username"], reg_id])
    
    conn.commit()
    conn.close()
    
    return respond(True, data={"message": "Member approved by head. Waiting for admin final approval."})

async def admin_approve_registration(reg_id: int, request: Request = None):
    """Admin: Final approval for registration"""
    require_admin(request)
    
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute("SELECT * FROM registrations WHERE id = ? AND status = 'pending'", [reg_id])
    reg = cur.fetchone()
    
    if not reg:
        conn.close()
        return respond(False, error="Registration not found or already processed")
    
    # Check if head approval is needed and received
    if reg["role"] == "household_member" and not reg["approved_by_head_at"]:
        conn.close()
        return respond(False, error="Head approval required before admin approval")
    
    # Create user in users table
    cur.execute("""
        INSERT INTO users (username, password, role, created_at)
        VALUES (?, ?, ?, ?)
    """, [reg["username"], reg["password"], "resident", int(time.time())])
    
    # Update registration status
    cur.execute("""
        UPDATE registrations 
        SET status = 'approved', approved_at = ?, approved_by = ?
        WHERE id = ?
    """, [int(time.time()), "admin", reg_id])
    
    conn.commit()
    conn.close()
    
    return respond(True, data={"message": "Registration approved successfully."})

async def reject_registration(reg_id: int, request: Request = None):
    """Admin or Head: Reject registration"""
    session = require_auth(request)
    
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute("SELECT * FROM registrations WHERE id = ? AND status = 'pending'", [reg_id])
    reg = cur.fetchone()
    
    if not reg:
        conn.close()
        return respond(False, error="Registration not found or already processed")
    
    # Head can only reject their own members
    if session["role"] == "head_of_household":
        if reg["role"] != "household_member" or reg["parent_username"] != session["username"]:
            conn.close()
            return respond(False, error="Not authorized to reject this registration")
    
    # Admin can reject anyone
    if session["role"] != "admin" and session["role"] != "head_of_household":
        conn.close()
        return respond(False, error="Not authorized")
    
    cur.execute("""
        UPDATE registrations 
        SET status = 'rejected', approved_at = ?, approved_by = ?
        WHERE id = ?
    """, [int(time.time()), session["username"], reg_id])
    
    conn.commit()
    conn.close()
    
    return respond(True, data={"message": "Registration rejected. User can register again."})

# ============ RESIDENT/HEAD APPROVAL STATUS ============

async def get_resident_households(request: Request = None):
    """Get households with complete details - Admin sees passwords"""
    session = require_auth(request)
    is_admin = session["role"] == "admin"
    is_head = session["role"] == "head_of_household"
    
    conn = get_db()
    cur = conn.cursor()
    
    # Get heads
    cur.execute("""
        SELECT DISTINCT house_address, username as head_username, name, email, phone, created_at
        FROM registrations
        WHERE status = 'approved' AND role = 'head_of_household' AND house_address IS NOT NULL AND house_address != ''
        ORDER BY house_address
    """)
    heads = cur.fetchall()
    
    households = []
    for h in heads:
        # Get members
        cur.execute("""
            SELECT id, username, name, email, phone, created_at
            FROM registrations
            WHERE status = 'approved' AND parent_username = ?
        """, [h["head_username"]])
        members = cur.fetchall()
        
        # Get VP data
        import json
        VP_DATA_FILE = BASE_DIR / "VP_data.json"
        vp_data = {}
        if VP_DATA_FILE.exists():
            with open(VP_DATA_FILE) as f:
                vp_data = json.load(f).get("vp", {})
        
        house_vp = []
        for vid, vp_user in vp_data.items():
            if vp_user.get("house_address") == h["house_address"]:
                house_vp.append({
                    "id": vid,
                    "name": vp_user.get("name", ""),
                    "plate": vp_user.get("plate", ""),
                    "credits": vp_user.get("credits", 0)
                })
        
        # Head data
        head_data = {
            "username": h["head_username"],
            "name": h["name"] or "",
            "email": h["email"] or "",
            "phone": h["phone"] or "",
            "created_at": h["created_at"]
        }
        
        if is_admin:
            cur.execute("SELECT password FROM registrations WHERE username = ?", [h["head_username"]])
            pw = cur.fetchone()
            if pw:
                head_data["password"] = pw["password"]
        
        # Members data
        members_data = []
        for m in members:
            m_data = {
                "id": m["id"],
                "username": m["username"],
                "name": m["name"] or "",
                "email": m["email"] or "",
                "phone": m["phone"] or "",
                "created_at": m["created_at"]
            }
            
            if is_admin:
                cur.execute("SELECT password FROM registrations WHERE id = ?", [m["id"]])
                pw = cur.fetchone()
                if pw:
                    m_data["password"] = pw["password"]
            
            members_data.append(m_data)
        
        households.append({
            "house_address": h["house_address"],
            "head": head_data,
            "members": members_data,
            "vp": house_vp
        })
    
    conn.close()
    
    return respond(True, data=households)

async def get_pending_for_head(request: Request = None):
    """Head: Get pending members for approval in resident list"""
    session = require_auth(request)
    
    if session["role"] != "head_of_household":
        return respond(False, error="Only head of household")
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, username, name, email, phone, created_at, house_address
        FROM registrations
        WHERE status = 'pending' AND role = 'household_member' AND parent_username = ?
        ORDER BY created_at DESC
    """, [session["username"]])
    rows = cur.fetchall()
    conn.close()
    
    data = [{
        "id": r["id"],
        "username": r["username"],
        "name": r["name"],
        "email": r["email"],
        "phone": r["phone"],
        "house_address": r["house_address"],
        "created_at": r["created_at"],
        "status_text": "Waiting for head approval",
        "status_color": "amber"
    } for r in rows]
    
    return respond(True, data=data)

async def get_pending_for_admin(request: Request = None):
    """Admin: Get all pending registrations with status"""
    require_admin(request)
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM registrations
        WHERE status = 'pending'
        ORDER BY created_at DESC
    """)
    rows = cur.fetchall()
    conn.close()
    
    data = []
    for r in rows:
        if r["role"] == "head_of_household":
            status_text = "Waiting for admin approval"
            status_color = "blue"
        elif r["role"] == "household_member":
            if r["approved_by_head_at"]:
                status_text = "Head approved - Waiting for admin approval"
                status_color = "green"
            else:
                status_text = "Waiting for head approval"
                status_color = "amber"
        
        data.append({
            "id": r["id"],
            "username": r["username"],
            "name": r["name"],
            "house_address": r["house_address"],
            "email": r["email"],
            "phone": r["phone"],
            "role": r["role"],
            "parent_username": r["parent_username"],
            "status_text": status_text,
            "status_color": status_color,
            "created_at": r["created_at"]
        })
    
    return respond(True, data=data)

# ============ NOTIFICATION ENDPOINTS ============

async def get_notifications(request: Request = None):
    """Get notifications for head or member"""
    session = require_auth(request)
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM notifications
        WHERE user_username = ?
        ORDER BY created_at DESC
        LIMIT 50
    """, [session["username"]])
    rows = cur.fetchall()
    conn.close()
    
    data = [{
        "id": r["id"],
        "message": r["message"],
        "read": r["read"],
        "created_at": r["created_at"]
    } for r in rows]
    
    return respond(True, data=data)

async def mark_notification_read(notif_id: int, request: Request = None):
    """Mark notification as read"""
    session = require_auth(request)
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        UPDATE notifications SET read = 1
        WHERE id = ? AND user_username = ?
    """, [notif_id, session["username"]])
    conn.commit()
    conn.close()
    
    return respond(True)

async def mark_all_read(request: Request = None):
    """Mark all notifications as read"""
    session = require_auth(request)
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        UPDATE notifications SET read = 1
        WHERE user_username = ?
    """, [session["username"]])
    conn.commit()
    conn.close()
    
    return respond(True)
