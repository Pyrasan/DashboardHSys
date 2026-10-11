from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

W = prs.slide_width
H = prs.slide_height

# ── color palette ──
C_PRIMARY  = RGBColor(0x1A, 0x23, 0x7E)   # deep indigo
C_SECONDARY= RGBColor(0xE6, 0x51, 0x00)    # orange
C_ACCENT   = RGBColor(0x2E, 0x7D, 0x32)    # green
C_PURPLE   = RGBColor(0x7B, 0x1F, 0xA2)    # purple
C_DARK     = RGBColor(0x21, 0x21, 0x21)
C_WHITE    = RGBColor(0xFF, 0xFF, 0xFF)
C_LIGHT_BG = RGBColor(0xF5, 0xF5, 0xF5)
C_GRAY     = RGBColor(0x66, 0x66, 0x66)
C_LIGHT    = RGBColor(0xE8, 0xEA, 0xF6)
C_CARD_BG  = RGBColor(0xFA, 0xFA, 0xFA)

def set_slide_bg(slide, color):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color

def add_shape(slide, left, top, width, height, fill_color, line_color=None):
    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shp.fill.solid()
    shp.fill.fore_color.rgb = fill_color
    if line_color:
        shp.line.color.rgb = line_color
        shp.line.width = Pt(1.5)
    else:
        shp.line.fill.background()
    return shp

def add_text_box(slide, left, top, width, height, text, font_size=14, bold=False, color=C_DARK, alignment=PP_ALIGN.LEFT, font_name="Segoe UI"):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.bold = bold
    p.font.color.rgb = color
    p.font.name = font_name
    p.alignment = alignment
    return txBox

def add_card(slide, left, top, width, height, title, bullets, title_color=C_PRIMARY, bg_color=C_CARD_BG):
    shp = add_shape(slide, left, top, width, height, bg_color, RGBColor(0xDD, 0xDD, 0xDD))
    add_text_box(slide, left + Inches(0.3), top + Inches(0.15), width - Inches(0.6), Inches(0.5), title, 16, True, title_color)
    txBox = slide.shapes.add_textbox(left + Inches(0.3), top + Inches(0.65), width - Inches(0.6), height - Inches(0.85))
    tf = txBox.text_frame
    tf.word_wrap = True
    for i, b in enumerate(bullets):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.text = b
        p.font.size = Pt(12)
        p.font.color.rgb = C_DARK
        p.font.name = "Segoe UI"
        p.space_after = Pt(4)

def section_header(slide, text, color=C_PRIMARY):
    add_shape(slide, Inches(0), Inches(0), W, Inches(1.1), color)
    add_text_box(slide, Inches(0.6), Inches(0.15), Inches(12), Inches(0.8), text, 28, True, C_WHITE)

# ═══════════════════════════════════════
# SLIDE 1 – TITLE
# ═══════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, C_PRIMARY)

add_shape(slide, Inches(0), Inches(2.5), W, Inches(2.8), RGBColor(0x28, 0x35, 0x93))
add_text_box(slide, Inches(1), Inches(2.7), Inches(11), Inches(1), "SecurePass — Smart Gate System", 44, True, C_WHITE, PP_ALIGN.CENTER)
add_text_box(slide, Inches(1), Inches(3.7), Inches(11), Inches(0.6), "Face Recognition · License Plate OCR · YOLO Detection · React Dashboard", 18, False, RGBColor(0xBB, 0xDE, 0xFB), PP_ALIGN.CENTER)
add_text_box(slide, Inches(1), Inches(4.4), Inches(11), Inches(0.5), "Python 3.11 · FastAPI · React 18 · TypeScript · SQLite · MQTT", 16, False, RGBColor(0x90, 0xCA, 0xF9), PP_ALIGN.CENTER)
add_text_box(slide, Inches(1), Inches(6.2), Inches(11), Inches(0.4), "Full-stack automated gate access control with face & plate recognition", 14, False, RGBColor(0xBB, 0xDE, 0xFB), PP_ALIGN.CENTER)

# ═══════════════════════════════════════
# SLIDE 2 – AGENDA
# ═══════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, C_WHITE)
section_header(slide, "Agenda")

items = [
    ("1", "Project Overview", "What is SecurePass and what problem does it solve"),
    ("2", "Tech Stack", "Languages, frameworks, libraries used"),
    ("3", "System Architecture", "High-level component diagram & data flow"),
    ("4", "Frontend", "React SPA with 16 pages, auth, and role-based access"),
    ("5", "Backend — Gate Controller", "Detection pipeline, face recognition, plate OCR"),
    ("6", "API Server", "FastAPI REST endpoints, MJPEG streaming, MQTT bridge"),
    ("7", "Database & Data Stores", "SQLite schema, JSON data files, face encodings"),
    ("8", "Registration & Approval Workflow", "Two-tier approval: Head → Admin"),
    ("9", "User Roles", "admin, head_of_household, household_member"),
    ("10", "Features & Simulation", "Key capabilities and simulation mode"),
]

for i, (num, title, desc) in enumerate(items):
    y = Inches(1.4) + Inches(0.55) * i
    add_text_box(slide, Inches(1.5), y, Inches(0.4), Inches(0.4), num, 16, True, C_PRIMARY, PP_ALIGN.CENTER)
    add_text_box(slide, Inches(2.1), y, Inches(3), Inches(0.4), title, 15, True, C_DARK)
    add_text_box(slide, Inches(5.3), y, Inches(6.5), Inches(0.4), desc, 13, False, C_GRAY)

# ═══════════════════════════════════════
# SLIDE 3 – PROJECT OVERVIEW
# ═══════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, C_WHITE)
section_header(slide, "Project Overview")

add_card(slide, Inches(0.5), Inches(1.4), Inches(5.8), Inches(5.5), "What is SecurePass?", [
    "Automated gate access control system",
    "Detects approaching vehicles using YOLO",
    "Recognizes faces via face_recognition (dlib)",
    "Reads license plates via YOLO + PaddleOCR",
    "Cross-references plate & face for thief detection",
    "Opens/denies gate based on resident, guest, or VehiclePass data",
    "Sends real-time alerts for unauthorized access",
    "Includes simulation mode for testing without cameras",
])

add_card(slide, Inches(6.8), Inches(1.4), Inches(5.8), Inches(5.5), "Key Capabilities", [
    "🔍 YOLO v26 vehicle & plate detection",
    "👤 Face recognition with encoding database",
    "📄 License plate OCR with PaddleOCR",
    "🚨 Thief detection (plate vs face mismatch)",
    "👥 Guest (Tamu) management",
    "🔄 VehiclePass system with credit-based access",
    "📊 Modern React dashboard with 16 pages",
    "📡 MQTT-based real-time messaging",
    "🎮 Flet-based simulation environment",
    "📈 Performance logging to CSV",
], C_SECONDARY)

# ═══════════════════════════════════════
# SLIDE 4 – TECH STACK
# ═══════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, C_WHITE)
section_header(slide, "Tech Stack")

stacks = [
    ("Backend Runtime", ["Python 3.11.9"], C_PRIMARY),
    ("Web Framework", ["FastAPI 0.115 + Uvicorn 0.30"], RGBColor(0x00, 0x96, 0x88)),
    ("Database", ["SQLite (aiosqlite + SQLAlchemy 2.0)"], C_ACCENT),
    ("Object Detection", ["Ultralytics YOLO v26 (yolo26.pt)"], C_SECONDARY),
    ("OCR", ["PaddleOCR 2.8.1"], RGBColor(0xD3, 0x2F, 0x2F)),
    ("Face Recognition", ["face_recognition (dlib) 1.3.0"], C_PURPLE),
    ("Computer Vision", ["OpenCV 4.10"], RGBColor(0x00, 0x7B, 0xFF)),
    ("Real-time", ["MQTT (paho-mqtt) · HTTP Polling · Socket.IO"], RGBColor(0x8D, 0x6E, 0x63)),
    ("Frontend", ["React 18 · TypeScript · Vite 5 · Tailwind 3"], C_PURPLE),
    ("Desktop GUI", ["Flet · ttkbootstrap"], RGBColor(0x02, 0x88, 0xD1)),
    ("Legacy UI", ["Vanilla HTML / CSS / JS"], C_GRAY),
]

for i, (title, items, color) in enumerate(stacks):
    col = i % 4
    row = i // 4
    x = Inches(0.5) + col * Inches(3.1)
    y = Inches(1.4) + row * Inches(2.8)
    add_card(slide, x, y, Inches(2.9), Inches(2.5), title, items, color)

# ═══════════════════════════════════════
# SLIDE 5 – SYSTEM ARCHITECTURE
# ═══════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, C_WHITE)
section_header(slide, "System Architecture")

# Architecture boxes
boxes = [
    (Inches(0.3), Inches(1.5), Inches(2.5), Inches(2.2), "CAMERA FEEDS", "USB Camera / RTSP Stream\n\nCaptures live video\nfor both gates", C_SECONDARY),
    (Inches(3.2), Inches(1.5), Inches(3.5), Inches(2.2), "GATE CONTROLLER\nbackend/main.py", "YOLO Vehicle Detection\n→ Face Recognition\n→ Plate OCR\n→ Access Decision\n→ MQTT Publish", RGBColor(0xE6, 0x51, 0x00)),
    (Inches(7.1), Inches(1.5), Inches(2.8), Inches(2.2), "API SERVER\napi/api.py", "FastAPI on Port 3002\nREST Endpoints\nMJPEG Streams\nMQTT Subscriber\nSQLite ORM", C_PRIMARY),
    (Inches(10.3), Inches(1.5), Inches(2.5), Inches(2.2), "REACT FRONTEND\nfrontend/", "Vite + React 18\n16 Pages\nRole-based UI\nHTTP Polling\nTailwind CSS", C_PURPLE),
]

for left, top, w, h, title, desc, color in boxes:
    shp = add_shape(slide, left, top, w, h, C_CARD_BG, color)
    add_text_box(slide, left + Inches(0.2), top + Inches(0.15), w - Inches(0.4), Inches(0.8), title, 13, True, color, PP_ALIGN.CENTER)
    add_text_box(slide, left + Inches(0.2), top + Inches(0.9), w - Inches(0.4), h - Inches(1.1), desc, 11, False, C_DARK, PP_ALIGN.CENTER)

# Data stores at bottom
add_card(slide, Inches(0.3), Inches(4.1), Inches(3), Inches(2.8), "JSON DATA FILES", [
    "R_data.json — Resident plates",
    "R_encode.json — Resident faces",
    "G_data.json — Guest data",
    "G_encode.json — Guest faces",
    "VP_data.json — VehiclePass + credits",
    "VP_encode.json — VehiclePass faces",
    "addresses.json — House list",
], RGBColor(0xF5, 0x7F, 0x17))

add_card(slide, Inches(3.7), Inches(4.1), Inches(3), Inches(2.8), "SQLite DATABASE", [
    "detection table — Events log",
    "command table — Gate commands",
    "users table — Auth & roles",
    "registrations — Approval workflow",
    "notifications — User alerts",
    "messages — Internal chat",
], C_ACCENT)

add_card(slide, Inches(7.1), Inches(4.1), Inches(2.8), Inches(2.8), "MQTT BROKER", [
    "gate/detection — Results",
    "gate/command — Gate control",
    "gate/status — Gate state",
    "gate/health — Heartbeat",
    "Bridges controller ↔ API",
], RGBColor(0x8D, 0x6E, 0x63))

add_card(slide, Inches(10.3), Inches(4.1), Inches(2.5), Inches(2.8), "SIMULATION", [
    "simulation_app.py",
    "Flet Desktop GUI",
    "Manual image testing",
    "Random event generation",
    "No camera needed",
], RGBColor(0x00, 0x96, 0x88))

# Arrows as text
add_text_box(slide, Inches(2.6), Inches(2.2), Inches(0.8), Inches(0.4), "──▶", 24, True, C_DARK, PP_ALIGN.CENTER)
add_text_box(slide, Inches(6.5), Inches(2.2), Inches(0.8), Inches(0.4), "──▶", 24, True, C_DARK, PP_ALIGN.CENTER)
add_text_box(slide, Inches(9.7), Inches(2.2), Inches(0.8), Inches(0.4), "──▶", 24, True, C_DARK, PP_ALIGN.CENTER)

# ═══════════════════════════════════════
# SLIDE 6 – FRONTEND
# ═══════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, C_WHITE)
section_header(slide, "Frontend — React SPA", C_PURPLE)

add_card(slide, Inches(0.5), Inches(1.4), Inches(4), Inches(2.5), "Core Modules", [
    "App.tsx — Router + Providers",
    "AuthContext.tsx — JWT auth & roles",
    "SocketContext.tsx — HTTP polling (2s)",
    "api.ts — 40+ typed API methods",
    "Layout.tsx — Sidebar navigation",
    "types.ts — TypeScript interfaces",
], C_PURPLE)

add_card(slide, Inches(4.8), Inches(1.4), Inches(4), Inches(2.5), "16 Pages", [
    "Dashboard · Cameras · Control",
    "Detection · Guest · Residents",
    "HeadApprovals · Registrations",
    "Notifications · Messages · Stats",
    "Login · Register · Landing",
    "ResidentHome · VPManagement",
], RGBColor(0x9C, 0x27, 0xB0))

add_card(slide, Inches(9.1), Inches(1.4), Inches(3.7), Inches(2.5), "Technical Details", [
    "React 18 + React Router DOM",
    "Vite 5 dev server on port 5173",
    "API proxy → localhost:3002",
    "Tailwind CSS 3 custom theme",
    "Lucide React icons",
    "socket.io-client for legacy events",
], RGBColor(0x7B, 0x1F, 0xA2))

add_card(slide, Inches(0.5), Inches(4.2), Inches(12.3), Inches(2.7), "Role-Based UI Access", [
    "👑 admin — Full access: all pages, manage users, approve registrations, view all data",
    "🏠 head_of_household (Head of Household) — Approve household members, manage VehiclePass users, view own data",
    "👤 household_member (Household Member) — Limited read-only access, own notifications & messages",
], C_PRIMARY)

# ═══════════════════════════════════════
# SLIDE 7 – BACKEND GATE CONTROLLER
# ═══════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, C_WHITE)
section_header(slide, "Backend — Gate Controller (backend/main.py)", C_SECONDARY)

add_card(slide, Inches(0.5), Inches(1.4), Inches(6), Inches(2.3), "Architecture", [
    "Dual daemon threads: Entry Gate (Camera 0) + Exit Gate (Camera 1)",
    "Single-process, multi-threaded design (no multiprocessing)",
    "Each thread runs independent detection pipeline on its camera feed",
    "Results published via MQTT for API/frontend consumption",
    "Frames pushed to shared frame buffer for live MJPEG streaming",
], C_SECONDARY)

add_card(slide, Inches(6.8), Inches(1.4), Inches(6), Inches(2.3), "Support Modules", [
    "config.py — All configuration constants (paths, thresholds, settings)",
    "face.py — Face encoding loading, matching against known faces",
    "ocr.py — YOLO plate detection → PaddleOCR text extraction",
    "vehicle_detector.py — YOLO inference for vehicle presence",
    "tamu.py — Guest (Tamu) data CRUD operations",
    "performance_log.py — CSV timing logger for debugging",
], RGBColor(0xEF, 0x6C, 0x00))

add_card(slide, Inches(0.5), Inches(4.0), Inches(12.3), Inches(3.0), "Detection Pipeline (per frame)", [
    "Step 1 — YOLO Vehicle Detection: check if a vehicle is near the gate using yolo26.pt",
    "Step 2a — Face Recognition: detect + encode face, match against R_encode, G_encode, VP_encode",
    "Step 2b — Plate OCR: detect license plate region with YOLO, extract text with PaddleOCR",
    "Step 3 — Access Decision: check plate against R_data → VP_data (with credit check) → G_data",
    "Step 4 — Thief Detection: if plate belongs to Resident X but face matches Resident Y or Unknown → ALERT",
    "Step 5 — Action: open gate (MQTT gate/command) or deny access + send notification",
], RGBColor(0xBF, 0x36, 0x0C))

# ═══════════════════════════════════════
# SLIDE 8 – API SERVER
# ═══════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, C_WHITE)
section_header(slide, "API Server (api/)")

add_card(slide, Inches(0.5), Inches(1.4), Inches(4), Inches(2.5), "FastAPI Application", [
    "api.py — Main app with all routes",
    "Uvicorn server on port 3002",
    "RESTful JSON API design",
    "CORS enabled for frontend",
    "Async endpoints (aiosqlite)",
    "Automatic OpenAPI docs at /docs",
], C_PRIMARY)

add_card(slide, Inches(4.8), Inches(1.4), Inches(4), Inches(2.5), "Key Endpoints", [
    "POST /api/login — Authentication",
    "GET /api/history — Detection logs",
    "POST /api/register — User registration",
    "GET /api/pending — Pending approvals",
    "POST /api/approve — Approve user",
    "GET /api/residents — Resident list",
    "GET /api/notifications — User alerts",
], RGBColor(0x19, 0x76, 0xD2))

add_card(slide, Inches(9.1), Inches(1.4), Inches(3.7), Inches(2.5), "Live Streaming", [
    "frame_buffer.py — Thread-safe",
    "deque of frames (maxlen=5)",
    "MJPEG endpoints:",
    "  /stream/entry",
    "  /stream/exit",
    "Low-latency browser viewing",
], RGBColor(0x00, 0x96, 0x88))

add_card(slide, Inches(0.5), Inches(4.2), Inches(12.3), Inches(2.7), "Backend Systems Integration", [
    "MQTT Subscriber — Listens to gate/detection topic for real-time event updates from the gate controller",
    "Database Layer — SQLite ORM via database.py with async queries for history, users, notifications, messages",
    "Resident API — resident_api.py handles the full registration workflow (register → head approve → admin approve → create)",
    "Legacy Support — Serves static HTML/JS/CSS from public/ folder for backward compatibility",
    "Diagnostics — check_db.py, check_passwords.py, fix_passwords.py for maintenance and debugging",
], C_ACCENT)

# ═══════════════════════════════════════
# SLIDE 9 – DATABASE
# ═══════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, C_WHITE)
section_header(slide, "Database & Data Stores", C_ACCENT)

add_card(slide, Inches(0.5), Inches(1.4), Inches(6), Inches(2.5), "SQLite — db/history.db", [
    "detection — Detection event log (topic, JSON message, timestamp)",
    "command — Gate command history (topic, JSON payload, timestamp)",
    "users — User accounts (username, hashed password, role)",
    "registrations — Pending + approved registrations with status",
    "notifications — User notifications (type, title, message, is_read)",
    "messages — Internal messaging between users (sender, receiver, content)",
], C_ACCENT)

add_card(slide, Inches(6.8), Inches(1.4), Inches(6), Inches(2.5), "JSON Data Files (root/)", [
    "R_data.json — Resident name → plate number mapping",
    "R_encode.json — Face encodings for all residents (128-d vectors)",
    "G_data.json — Guest (Tamu) name → plate + validity period",
    "G_encode.json — Face encodings for all guests",
    "VP_data.json — VehiclePass user: plates, remaining credits, house assignment",
    "VP_encode.json — Face encodings for VehiclePass users",
    "addresses.json — List of registered house addresses",
    "performance_log.csv — CSV with face/plate/total detection timings",
], RGBColor(0xF5, 0x7F, 0x17))

add_card(slide, Inches(0.5), Inches(4.2), Inches(12.3), Inches(2.7), "Data Flow Summary", [
    "Gate Controller reads JSON files directly for fast lookups during detection (no DB overhead at inference time)",
    "Gate Controller writes detection events to SQLite for persistent history",
    "API Server reads/writes SQLite for user management, notifications, messages",
    "API Server also reads JSON files for data display endpoints (resident list, guest list, VehiclePass list)",
    "Legacy pickle format was migrated to JSON for better portability (migrate_pickle_to_json.py)",
    "Face encodings are 128-dimensional vectors from face_recognition (dlib), stored as lists in JSON",
], C_DARK)

# ═══════════════════════════════════════
# SLIDE 10 – REGISTRATION WORKFLOW
# ═══════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, C_WHITE)
section_header(slide, "Registration & Approval Workflow")

add_card(slide, Inches(0.5), Inches(1.4), Inches(6), Inches(5.5), "Two-Tier Approval Process", [
    "Step 1 — User submits registration via Register page or API",
    "",
    "Step 2 — Head of Household (head_of_household) reviews pending",
    "         registrations for their household address",
    "         → Rejects: registration deleted",
    "         → Approves: moves to Admin queue",
    "",
    "Step 3 — Admin reviews head-approved registrations",
    "         → Rejects: registration deleted",
    "         → Approves: user account created in users table",
    "",
    "Step 4 — New user can now log in with assigned role",
    "         (head_of_household if new household, household_member if joining)",
    "",
    "Notifications sent at each stage to relevant parties",
], C_PRIMARY)

add_card(slide, Inches(6.8), Inches(1.4), Inches(6), Inches(2.5), "User Roles & Permissions", [
    "👑 admin — Full system access, skip approval queue, manage all",
    "🏠 head_of_household — Approve household members, manage VehiclePass users",
    "👤 household_member — View own data, notifications, messages only",
    "",
    "Registration determines role based on address:",
    "  • New address → head_of_household (first occupant)",
    "  • Existing address → household_member (needs head approval)",
], C_SECONDARY)

add_card(slide, Inches(6.8), Inches(4.2), Inches(6), Inches(2.7), "Key API Endpoints for Workflow", [
    "POST /api/register — Submit new registration",
    "GET /api/pending-approvals — List pending (role-filtered)",
    "POST /api/approve-registration — Approve/reject",
    "GET /api/registrations — View registration status",
    "POST /api/approve-head — Head of household approval action",
    "POST /api/approve-admin — Admin final approval action",
], RGBColor(0x00, 0x96, 0x88))

# ═══════════════════════════════════════
# SLIDE 11 – VehiclePass & GUEST SYSTEMS
# ═══════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, C_WHITE)
section_header(slide, "VehiclePass & Guest Management Systems", RGBColor(0x00, 0x96, 0x88))

add_card(slide, Inches(0.5), Inches(1.4), Inches(6), Inches(2.5), "VehiclePass (Tamu Gotong Royong)", [
    "Community volunteer guest access system",
    "Each VehiclePass user has: registered plates, credit count, house assignment",
    "Gate checks VP_data.json for plate match + remaining credits",
    "Access granted only if credits > 0 (decremented on entry)",
    "Access denied with alert when credits exhausted",
    "Managed by Head of Household (head_of_household role)",
], RGBColor(0x00, 0x7A, 0x6B))

add_card(slide, Inches(6.8), Inches(1.4), Inches(6), Inches(2.5), "Guest (Tamu) System", [
    "Temporary one-time or time-limited access",
    "G_data.json stores guest name + plate + validity",
    "G_encode.json stores guest face encodings",
    "Guests can be added/removed via admin dashboard",
    "Guest access does NOT use credit system",
    "Expired guests are automatically denied",
], RGBColor(0xD3, 0x2F, 0x2F))

add_card(slide, Inches(0.5), Inches(4.2), Inches(12.3), Inches(2.7), "Thief Detection System", [
    "When a vehicle approaches, BOTH face and plate are captured and recognized independently",
    "System cross-references: does the recognized face match the plate owner?",
    "If plate → Resident A but face → Resident B (or Unknown) → THIEF ALERT triggered",
    "Alert sends notifications to admin AND the plate owner (Resident A)",
    "This prevents stolen vehicles or unauthorized drivers from entering",
    "All suspicious events logged to detection table with 'thief' topic",
], RGBColor(0xBF, 0x36, 0x0C))

# ═══════════════════════════════════════
# SLIDE 12 – SIMULATION
# ═══════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, C_WHITE)
section_header(slide, "Simulation Mode", RGBColor(0x00, 0x96, 0x88))

add_card(slide, Inches(0.5), Inches(1.4), Inches(6), Inches(5.5), "simulation_app.py (Flet Desktop)", [
    "1300+ line Flet GUI application for testing",
    "",
    "Modes:",
    "  • Manual — Upload/test individual images",
    "  • Separate — Test face + plate from diff images",
    "  • Joint — Test face + plate from single image",
    "  • Random — Auto-generate events from DB users",
    "",
    "Features:",
    "  • Simulates camera input without hardware",
    "  • Tests detection pipeline end-to-end",
    "  • Visual feedback with annotated images",
    "  • Logs results as if from real gate",
    "  • No YOLO/camera dependency for UI testing",
], RGBColor(0x00, 0x96, 0x88))

add_card(slide, Inches(6.8), Inches(1.4), Inches(6), Inches(5.5), "Launchers & Automation", [
    "run_main.bat — Start gate controller",
    "run_api.bat — Start API server (uvicorn)",
    "run_simulation.bat — Start simulation GUI",
    "run_vehicle.bat — Standalone vehicle detection",
    "start_valt.bat — Interactive menu (launch any)",
    "start_app.py — Flet service manager UI",
    "install_deps.bat — One-click dependency install",
    "",
    "All launchers use: dep/Scripts/python.exe",
    "(Python 3.11 virtual environment)",
], C_PRIMARY)

# ═══════════════════════════════════════
# SLIDE 13 – THANK YOU
# ═══════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, C_PRIMARY)

add_shape(slide, Inches(0), Inches(2.5), W, Inches(2.5), RGBColor(0x28, 0x35, 0x93))
add_text_box(slide, Inches(1), Inches(2.7), Inches(11), Inches(0.8), "Thank You", 48, True, C_WHITE, PP_ALIGN.CENTER)
add_text_box(slide, Inches(1), Inches(3.7), Inches(11), Inches(0.5), "SecurePass — Smart Gate System", 22, False, RGBColor(0xBB, 0xDE, 0xFB), PP_ALIGN.CENTER)
add_text_box(slide, Inches(1), Inches(4.6), Inches(11), Inches(0.4), "Face Recognition | License Plate OCR | YOLO Detection | React Dashboard", 16, False, RGBColor(0x90, 0xCA, 0xF9), PP_ALIGN.CENTER)

outpath = "D:\\fate v7\\SecurePass_Presentation.pptx"
prs.save(outpath)
print(f"Saved to {outpath}")
