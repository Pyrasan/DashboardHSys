"""
SecurePass - Smart Gate System
Seamless YOLO Vehicle Detection + Face + Plate Recognition
Single process, multi-threaded architecture with full MQTT support
"""

import os
import sys
import json
import sqlite3
import threading
import time
import logging
import urllib.request
from datetime import datetime
from typing import Optional, Dict, Any
from enum import Enum
from queue import Queue

import cv2
import numpy as np
import paho.mqtt.client as mqtt

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Import project modules
sys.path.insert(0, BASE_DIR)
from config import Config, Mode

# Frame buffer for live streaming
sys.path.insert(0, os.path.join(BASE_DIR, '..', 'api'))
try:
    from frame_buffer import push_frame_camera_entry, push_frame_camera_exit, set_system_status
except ImportError:
    push_frame_camera_entry = None
    push_frame_camera_exit = None
    set_system_status = None
    logger.warning("[Stream] Frame buffer not available")


class GateState(Enum):
    IDLE = "idle"
    PROCESSING = "processing"
    GATE_OPEN = "gate_open"


class GateMonitor:
    """
    Single gate monitor that runs YOLO detection and face+plate recognition
    in a seamless loop within the same process.
    """
    
    VEHICLE_CLASSES = [2, 3, 5, 7]  # car, motorcycle, bus, truck
    MIN_VEHICLE_WIDTH = 80
    MIN_VEHICLE_HEIGHT = 60
    
    def __init__(self, name: str, mode: str, camera_id: int, rtsp_url: str = None):
        self.name = name  # "ENTRY" or "EXIT"
        self.mode = mode
        self.camera_id = camera_id
        self.rtsp_url = rtsp_url
        
        # Camera
        self.cap = None
        self.frame_width = Config.CAMERA_WIDTH
        self.frame_height = Config.CAMERA_HEIGHT
        
        # State
        self.state = GateState.IDLE
        self.state_lock = threading.Lock()
        self.last_status = 'idle'
        
        # YOLO model
        self.vehicle_model = None
        self._load_yolo_model()
        
        # Face and plate recognizers
        self._face_recognizer = None
        self._plate_recognizer = None
        self._load_recognizers()
        
        # Threading
        self.running = False
        self.thread = None
        
        # Cooldown (frames to skip after processing)
        self.cooldown_frames = 60  # ~2 seconds at 30fps
        self.current_cooldown = 0
        
        # Push frame function
        self.push_frame = push_frame_camera_entry if mode == Mode.MASUK else push_frame_camera_exit
        
        logger.info(f"[{self.name}] GateMonitor initialized")
    
    def _load_yolo_model(self):
        """Load YOLO vehicle detection model"""
        try:
            from ultralytics import YOLO
            
            if os.path.exists(Config.YOLO_VEHICLE_PATH):
                self.vehicle_model = YOLO(Config.YOLO_VEHICLE_PATH)
                logger.info(f"[{self.name}] YOLO vehicle model loaded")
            elif os.path.exists(Config.YOLO_MODEL_PATH):
                self.vehicle_model = YOLO(Config.YOLO_MODEL_PATH)
                logger.info(f"[{self.name}] Using default YOLO model")
            else:
                logger.warning(f"[{self.name}] No YOLO model found")
        except Exception as e:
            logger.error(f"[{self.name}] Failed to load YOLO: {e}")
    
    def _load_recognizers(self):
        """Load face and plate recognizers"""
        try:
            from face import FaceRecognizer
            self._face_recognizer = FaceRecognizer()
            logger.info(f"[{self.name}] Face recognizer loaded")
        except Exception as e:
            logger.warning(f"[{self.name}] Face recognizer not available: {e}")
        
        try:
            from ocr import PlateRecognizer
            self._plate_recognizer = PlateRecognizer()
            logger.info(f"[{self.name}] Plate recognizer loaded")
        except Exception as e:
            logger.warning(f"[{self.name}] Plate recognizer not available: {e}")
    
    def _open_camera(self) -> bool:
        """Open camera and keep it open"""
        if self.cap is not None and self.cap.isOpened():
            return True
        
        # Try RTSP first, then camera index
        sources = []
        if self.rtsp_url:
            sources.append(self.rtsp_url)
        sources.extend([self.camera_id, 0, 1])
        
        for source in sources:
            try:
                self.cap = cv2.VideoCapture(source)
                if self.cap.isOpened():
                    self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.frame_width)
                    self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.frame_height)
                    logger.info(f"[{self.name}] Camera opened: {source}")
                    return True
                self.cap.release()
            except Exception as e:
                continue
        
        logger.error(f"[{self.name}] Failed to open camera")
        return False
    
    def _close_camera(self):
        """Close camera"""
        if self.cap:
            self.cap.release()
            self.cap = None
    
    def start(self):
        """Start the monitoring thread"""
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        logger.info(f"[{self.name}] Monitoring started")
    
    def stop(self):
        """Stop the monitoring thread"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        self._close_camera()
        logger.info(f"[{self.name}] Monitoring stopped")
    
    def get_status(self) -> Dict[str, Any]:
        """Get current gate status"""
        return {
            'name': self.name,
            'mode': self.mode,
            'state': self.state.value,
            'camera_online': self.cap is not None and self.cap.isOpened(),
            'processing': self.state == GateState.PROCESSING,
            'gate_open': self.state == GateState.GATE_OPEN
        }
    
    def _monitor_loop(self):
        """
        Main monitoring loop - runs YOLO detection continuously.
        When vehicle detected, runs face+plate recognition.
        """
        logger.info(f"[{self.name}] Starting monitor loop...")
        
        while self.running:
            # Open camera if needed
            if not self._open_camera():
                time.sleep(2)
                continue
            
            # Read frame
            ret, frame = self.cap.read()
            if not ret or frame is None:
                time.sleep(0.1)
                continue
            
            # Push frame for live streaming
            if self.push_frame and frame is not None:
                try:
                    ret, encoded = cv2.imencode('.jpg', frame)
                    if ret:
                        self.push_frame(encoded.tobytes())
                except:
                    pass
            
            # Check cooldown
            if self.current_cooldown > 0:
                self.current_cooldown -= 1
                time.sleep(0.033)
                continue
            
            # Check if already processing
            with self.state_lock:
                if self.state == GateState.PROCESSING:
                    time.sleep(0.033)
                    continue
            
            # YOLO vehicle detection
            vehicles = self._detect_vehicles(frame)
            
            # Check if vehicle is close enough
            nearby_vehicle = self._is_vehicle_nearby(vehicles, frame.shape[0])
            
            if nearby_vehicle:
                logger.info(f"[{self.name}] Vehicle detected nearby!")
                self._process_vehicle(frame)
            else:
                # Small delay to maintain ~30fps
                time.sleep(0.033)
    
    def _detect_vehicles(self, frame: np.ndarray) -> list:
        """Detect vehicles using YOLO"""
        if self.vehicle_model is None:
            return []
        
        try:
            results = self.vehicle_model(frame, conf=0.5, verbose=False)[0]
            vehicles = []
            
            for box, cls, conf in zip(results.boxes.xyxy, results.boxes.cls, results.boxes.conf):
                class_id = int(cls)
                if class_id in self.VEHICLE_CLASSES:
                    x1, y1, x2, y2 = box.cpu().numpy()
                    w, h = x2 - x1, y2 - y1
                    
                    # Filter small objects (likely not vehicles)
                    if w >= self.MIN_VEHICLE_WIDTH and h >= self.MIN_VEHICLE_HEIGHT:
                        vehicles.append({
                            'class': class_id,
                            'conf': float(conf),
                            'bbox': [int(x1), int(y1), int(x2), int(y2)],
                            'width': int(w),
                            'height': int(h)
                        })
            
            return vehicles
        except Exception as e:
            logger.debug(f"[{self.name}] YOLO detection error: {e}")
            return []
    
    def _is_vehicle_nearby(self, vehicles: list, frame_height: int) -> bool:
        """Check if any detected vehicle is close enough"""
        if not vehicles:
            return False
        
        # Reference: car at 10m ~150px height in 720p
        reference_height = 150
        reference_distance = 10
        
        for v in vehicles:
            h = v['height']
            if h > 0:
                # Estimate distance based on vehicle height
                estimated_distance = (reference_height / h) * reference_distance
                if estimated_distance <= Config.VEHICLE_DETECTION_DISTANCE_M:
                    return True
        
        return False
    
    def _process_vehicle(self, frame: np.ndarray):
        """
        Process vehicle: Face recognition + Plate OCR
        Runs in the same thread as YOLO monitoring.
        """
        with self.state_lock:
            self.state = GateState.PROCESSING
        
        logger.info(f"[{self.name}] Processing vehicle...")
        
        try:
            # Get fresh frame for processing
            ret, process_frame = self.cap.read()
            if not ret:
                return
            
            # Face recognition
            face_name = None
            face_valid = False
            if self._face_recognizer:
                try:
                    results = self._face_recognizer.detect(process_frame)
                    if results:
                        face_name = results[0].get('name')
                        face_valid = bool(face_name and face_name not in ['Unknown', 'TEMP-'])
                except Exception as e:
                    logger.warning(f"[{self.name}] Face recognition error: {e}")
            
            # Plate OCR
            plate = None
            plate_valid = False
            if self._plate_recognizer:
                try:
                    plate, _ = self._plate_recognizer.detect_from_frame(process_frame)
                    plate_valid = bool(plate)
                except Exception as e:
                    logger.warning(f"[{self.name}] Plate OCR error: {e}")
            
            # Determine person name
            if face_name and face_name not in ['Unknown', 'TEMP-']:
                person = face_name
            else:
                person = 'Unknown'
            
            # Build result
            result = {
                'person': person,
                'plat': plate or '-',
                'face_valid': face_valid,
                'plate_valid': plate_valid,
                'mode': self.mode,
                'timestamp': time.time()
            }
            
            logger.info(f"[{self.name}] Detection result: {result}")
            
            # Process result (gate control, logging, MQTT)
            self._process_result(result)
            
        except Exception as e:
            logger.error(f"[{self.name}] Processing error: {e}")
        
        finally:
            # Set cooldown to prevent rapid re-triggering
            self.current_cooldown = self.cooldown_frames
            
            with self.state_lock:
                self.state = GateState.IDLE
            
            logger.info(f"[{self.name}] Processing complete, returning to monitoring")
    
    def _process_result(self, result: Dict[str, Any]):
        """Process detection result: gate control, logging, MQTT"""
        person = result.get('person', 'Unknown')
        plate = result.get('plat', '-')
        face_valid = result.get('face_valid', False)
        plate_valid = result.get('plate_valid', False)
        mode = result.get('mode', self.mode)

        # Save to database
        self._save_detection(result)

        # Publish to MQTT
        self._publish_mqtt(result)

        # ── Guest check-in/out management ──
        if person and person.startswith("G_"):
            guest_id = "G" + person[2:]
            try:
                from tamu import simpan_tamu, delete_tamu, get_tamu_entry
                if mode == Mode.MASUK:
                    # Guest entering: check-in (save to guest DB if new)
                    existing = get_tamu_entry(guest_id)
                    if not existing:
                        # New guest — save to guest database
                        import numpy as np
                        dummy_frame = np.zeros((100, 100, 3), dtype=np.uint8)
                        simpan_tamu(plat_nomor=plate, img_bgr=dummy_frame,
                                    extra={"waktu_masuk": datetime.now().isoformat()})
                        logger.info(f"[{self.name}] Guest checked in: {person}")
                elif mode == Mode.KELUAR:
                    # Guest exiting: check-out (delete from guest DB)
                    deleted = delete_tamu(guest_id)
                    if deleted:
                        logger.info(f"[{self.name}] Guest checked out and removed: {person}")
                    else:
                        logger.warning(f"[{self.name}] Guest {person} not found for check-out")
            except Exception as e:
                logger.warning(f"[{self.name}] Guest management error: {e}")

        # Check if plate belongs to a resident or VP
        plate_owner = self._find_plate_owner(plate) if plate != '-' else None
        vp_info = self._find_vp_by_plate(plate) if plate != '-' else None
        
        # Thief detection: resident plate but face doesn't match
        if plate_owner and (not face_valid or person != plate_owner):
            logger.warning(f"[{self.name}] THIEF DETECTED! Plate {plate} belongs to {plate_owner}, but face is {person}")
            self._send_thief_alert(result, plate_owner)
        elif vp_info:
            # Plate belongs to a VP guest
            if vp_info.get('active', False) and vp_info.get('credits', 0) > 0:
                # Legitimate VP with credits → normal processing
                if face_valid or plate_valid:
                    self._open_gate()
                else:
                    logger.info(f"[{self.name}] VP access denied - invalid credentials")
                    self._send_security_alert(result)
            else:
                # VP inactive or out of credits → block gate, send alert
                logger.info(f"[{self.name}] VP blocked - no credits left (plate: {plate})")
                self._send_expired_vp_alert(result, vp_info)
        elif face_valid or plate_valid:
            self._open_gate()
        else:
            logger.info(f"[{self.name}] Access denied - invalid credentials")
            self._send_security_alert(result)
    
    def _send_security_alert(self, result: Dict[str, Any]):
        """Send security alert notification when access denied"""
        try:
            plate = result.get('plat', '')
            person = result.get('person', 'Unknown')
            
            # Call API to create notifications
            import urllib.request
            import json
            
            # Notify admin
            data = json.dumps({
                "username": "admin",
                "title": "Security Alert",
                "message": f"Access denied at {self.name} gate. Plate: {plate}, Person: {person}",
                "type": "security"
            }).encode('utf-8')
            
            req = urllib.request.Request(
                'http://localhost:3002/api/notifications/create',
                data=data,
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            try:
                urllib.request.urlopen(req, timeout=2)
            except:
                pass
            
            # Try to find head of household for this plate
            try:
                DB_DIR = os.path.join(BASE_DIR, "db")
                db_path = os.path.join(DB_DIR, "history.db")
                conn = sqlite3.connect(db_path)
                cur = conn.cursor()
                cur.execute("SELECT parent_username FROM registrations WHERE plates LIKE ?", [f"%{plate}%"])
                reg = cur.fetchone()
                if reg and reg[0]:
                    head_username = reg[0]
                    data = json.dumps({
                        "username": head_username,
                        "title": "Security Alert",
                        "message": f"Unrecognized vehicle detected at {self.name} gate with plate: {plate}",
                        "type": "security"
                    }).encode('utf-8')
                    req = urllib.request.Request(
                        'http://localhost:3002/api/notifications/create',
                        data=data,
                        headers={'Content-Type': 'application/json'},
                        method='POST'
                    )
                    try:
                        urllib.request.urlopen(req, timeout=2)
                    except:
                        pass
                conn.close()
            except Exception as e:
                logger.debug(f"[{self.name}] Error finding head for plate: {e}")
                
        except Exception as e:
            logger.debug(f"[{self.name}] Error sending security alert: {e}")
    
    def _find_plate_owner(self, plate: str) -> Optional[str]:
        """Find which resident owns a plate number. Returns username or None."""
        if not plate or plate == '-':
            return None
        try:
            data_path = os.path.join(BASE_DIR, "R_data.json")
            if not os.path.exists(data_path):
                return None
            with open(data_path, 'r') as f:
                data = json.load(f)
            penduduk = data.get('penduduk', {})
            # Normalize detected plate
            plate_norm = ''.join(c for c in plate.upper() if c.isalnum())
            for username, info in penduduk.items():
                stored_plates = info.get('plat_nomor', [])
                for sp in stored_plates:
                    sp_norm = ''.join(c for c in sp.upper() if c.isalnum())
                    if plate_norm == sp_norm:
                        return username
        except Exception as e:
            logger.debug(f"[{self.name}] Error finding plate owner: {e}")
        return None

    def _find_head_of_household(self, username: str) -> Optional[str]:
        """Find the head of household for a given username."""
        try:
            DB_DIR = os.path.join(BASE_DIR, "db")
            db_path = os.path.join(DB_DIR, "history.db")
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT role, parent_username FROM registrations WHERE username = ?", [username])
            row = cur.fetchone()
            conn.close()
            if row:
                role, parent = row['role'], row['parent_username']
                if role == 'head_of_household':
                    return username
                elif parent:
                    return parent
        except Exception as e:
            logger.debug(f"[{self.name}] Error finding head: {e}")
        return None

    def _send_thief_alert(self, result: Dict[str, Any], plate_owner: str):
        """Send thief alert to admin and head of household who owns the plate"""
        plate = result.get('plat', '')
        person = result.get('person', 'Unknown')

        head_username = self._find_head_of_household(plate_owner)

        # Notify admin
        try:
            data = json.dumps({
                "username": "admin",
                "title": "SECURITY ALERT - Potential Theft",
                "message": f"THIEF DETECTED at {self.name} gate! Plate: {plate} (registered to {plate_owner}), but face matches: {person}",
                "type": "security"
            }).encode('utf-8')
            req = urllib.request.Request(
                'http://localhost:3002/api/notifications/create',
                data=data,
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            urllib.request.urlopen(req, timeout=2)
        except Exception as e:
            logger.debug(f"[{self.name}] Error notifying admin: {e}")

        # Notify head of household
        if head_username:
            try:
                data = json.dumps({
                    "username": head_username,
                    "title": "SECURITY ALERT - Vehicle Theft Detected",
                    "message": f"Your vehicle with plate {plate} was detected at {self.name} gate but the driver's face does not match. Possible theft!",
                    "type": "security"
                }).encode('utf-8')
                req = urllib.request.Request(
                    'http://localhost:3002/api/notifications/create',
                    data=data,
                    headers={'Content-Type': 'application/json'},
                    method='POST'
                )
                urllib.request.urlopen(req, timeout=2)
            except Exception as e:
                logger.debug(f"[{self.name}] Error notifying head: {e}")

    def _find_vp_by_plate(self, plate: str) -> Optional[Dict[str, Any]]:
        """Find VP entry by plate number. Returns VP info dict or None."""
        if not plate or plate == '-':
            return None
        try:
            vp_path = os.path.join(BASE_DIR, "VP_data.json")
            if not os.path.exists(vp_path):
                return None
            with open(vp_path, 'r') as f:
                data = json.load(f)
            plate_norm = ''.join(c for c in plate.upper() if c.isalnum())
            for uid, user in data.get('vp', {}).items():
                user_plates = user.get('plates', [])
                if not user_plates:
                    user_plates = [p.strip() for p in user.get('plate', '').split(',') if p.strip()]
                for up in user_plates:
                    up_norm = ''.join(c for c in up.upper() if c.isalnum())
                    if plate_norm == up_norm:
                        user['_id'] = uid
                        return user
        except Exception as e:
            logger.debug(f"[{self.name}] Error finding VP by plate: {e}")
        return None

    def _find_head_by_address(self, house_address: str) -> Optional[str]:
        """Find the head of household for a given house address."""
        if not house_address:
            return None
        try:
            DB_DIR = os.path.join(BASE_DIR, "db")
            db_path = os.path.join(DB_DIR, "history.db")
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT username FROM registrations WHERE house_address = ? AND role = 'head_of_household' AND status = 'approved'", [house_address])
            row = cur.fetchone()
            conn.close()
            if row:
                return row['username']
        except Exception as e:
            logger.debug(f"[{self.name}] Error finding head by address: {e}")
        return None

    def _send_expired_vp_alert(self, result: Dict[str, Any], vp_info: Dict[str, Any]):
        """Send alert when a VP with no credits tries to enter"""
        plate = result.get('plat', '')
        person = result.get('person', 'Unknown')
        vp_name = vp_info.get('name', 'Unknown')
        house_address = vp_info.get('house_address', '')
        head_username = self._find_head_by_address(house_address)

        # Notify admin
        try:
            data = json.dumps({
                "username": "admin",
                "title": "VP Access Denied - No Credits",
                "message": f"VP ({vp_name}) with plate {plate} attempted entry at {self.name} gate but has no remaining credits.",
                "type": "security"
            }).encode('utf-8')
            req = urllib.request.Request(
                'http://localhost:3002/api/notifications/create',
                data=data,
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            urllib.request.urlopen(req, timeout=2)
        except Exception as e:
            logger.debug(f"[{self.name}] Error notifying admin about expired VP: {e}")

        # Notify head of household
        if head_username:
            try:
                data = json.dumps({
                    "username": head_username,
                    "title": "VP Access Attempt - No Credits",
                    "message": f"Your guest ({vp_name}) with plate {plate} attempted to enter at {self.name} gate but has run out of credits. Please top up their credits.",
                    "type": "security"
                }).encode('utf-8')
                req = urllib.request.Request(
                    'http://localhost:3002/api/notifications/create',
                    data=data,
                    headers={'Content-Type': 'application/json'},
                    method='POST'
                )
                urllib.request.urlopen(req, timeout=2)
            except Exception as e:
                logger.debug(f"[{self.name}] Error notifying head about expired VP: {e}")

    def _save_detection(self, result: Dict[str, Any]):
        """Save detection to database"""
        try:
            DB_DIR = os.path.join(BASE_DIR, "db")
            os.makedirs(DB_DIR, exist_ok=True)
            db_path = os.path.join(DB_DIR, "history.db")
            
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            
            # Create table if not exists
            cur.execute("""
                CREATE TABLE IF NOT EXISTS deteksi (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    topic TEXT,
                    message TEXT,
                    ts INTEGER
                )
            """)
            
            # Insert detection
            cur.execute(
                "INSERT INTO deteksi (topic, message, ts) VALUES (?, ?, ?)",
                ('gate/detection', json.dumps(result), int(time.time()))
            )
            
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"[{self.name}] Database save error: {e}")
    
    def _publish_mqtt(self, result: Dict[str, Any]):
        """Publish detection to MQTT"""
        try:
            client = mqtt.Client()
            client.connect(Config.MQTT_BROKER, Config.MQTT_PORT, 60)
            
            message = json.dumps({
                'person': result.get('person'),
                'plat': result.get('plat'),
                'face_valid': result.get('face_valid'),
                'plate_valid': result.get('plate_valid'),
                'mode': result.get('mode'),
                'time': datetime.now().isoformat()
            })
            
            client.publish(Config.MQTT_TOPIC_DETEKSI, message)
            client.disconnect()
        except Exception as e:
            logger.warning(f"[{self.name}] MQTT publish error: {e}")
    
    def _open_gate(self):
        """Open the gate"""
        with self.state_lock:
            self.state = GateState.GATE_OPEN
        
        logger.info(f"[{self.name}] === GATE OPENING ===")
        
        # Publish gate status
        self._publish_status('OPENING')
        
        try:
            # Send command to gate controller
            client = mqtt.Client()
            client.connect(Config.MQTT_BROKER, Config.MQTT_PORT, 60)
            
            command = f"OPEN - {self.mode}"
            client.publish(Config.MQTT_TOPIC_PERINTAH, json.dumps({
                'command': command,
                'time': datetime.now().isoformat()
            }))
            client.disconnect()
            
            # Keep gate open for 5 seconds
            time.sleep(5)
            
        except Exception as e:
            logger.warning(f"[{self.name}] Gate control error: {e}")
        
        logger.info(f"[{self.name}] === GATE CLOSED ===")
        
        # Publish gate status
        self._publish_status('CLOSED')
        
        with self.state_lock:
            self.state = GateState.IDLE
    
    def _publish_status(self, status: str):
        """Publish gate status to MQTT"""
        if status == self.last_status:
            return
        
        self.last_status = status
        
        try:
            client = mqtt.Client()
            client.connect(Config.MQTT_BROKER, Config.MQTT_PORT, 60)
            
            client.publish('gate/status', json.dumps({
                'gate': self.name,
                'status': status,
                'timestamp': time.time()
            }))
            
            client.disconnect()
        except Exception as e:
            logger.debug(f"[{self.name}] Status publish error: {e}")


class GateSystem:
    """
    Main gate system that manages both entry and exit gates.
    Each gate runs in its own thread, completely independent.
    Includes MQTT subscriber for receiving commands.
    """
    
    def __init__(self):
        self.entry_gate = None
        self.exit_gate = None
        self.running = False
        self.mqtt_thread = None
        self.health_thread = None
        self.mqtt_client = None
        
        logger.info("=" * 50)
        logger.info("SecurePass - Smart Gate System")
        logger.info("Seamless YOLO + Face + Plate Detection")
        logger.info("=" * 50)
    
    def _create_gates(self):
        """Create entry and exit gate monitors"""
        self.entry_gate = GateMonitor(
            name="ENTRY",
            mode=Mode.MASUK,
            camera_id=Config.CAMERA_MASUK_ID
        )
        
        self.exit_gate = GateMonitor(
            name="EXIT",
            mode=Mode.KELUAR,
            camera_id=Config.CAMERA_KELUAR_ID
        )
    
    def _setup_mqtt_subscriber(self):
        """Setup MQTT subscriber for commands"""
        def on_connect(client, userdata, flags, rc):
            if rc == 0:
                logger.info("[MQTT] Command subscriber connected")
                client.subscribe('gate/command')
            else:
                logger.error(f"[MQTT] Connection failed: {rc}")
        
        def on_message(client, userdata, msg):
            try:
                data = json.loads(msg.payload)
                command = data.get('command', '')
                logger.info(f"[MQTT] Command received: {command}")
                
                if 'OPEN' in command.upper():
                    if 'MASUK' in command.upper() or 'ENTRY' in command.upper():
                        logger.info("[MQTT] Opening ENTRY gate via command")
                        self.entry_gate._open_gate()
                    elif 'KELUAR' in command.upper() or 'EXIT' in command.upper():
                        logger.info("[MQTT] Opening EXIT gate via command")
                        self.exit_gate._open_gate()
                        
            except Exception as e:
                logger.error(f"[MQTT] Command processing error: {e}")
        
        self.mqtt_client = mqtt.Client()
        self.mqtt_client.on_connect = on_connect
        self.mqtt_client.on_message = on_message
        
        try:
            self.mqtt_client.connect(Config.MQTT_BROKER, Config.MQTT_PORT, 60)
            self.mqtt_client.loop_start()
            logger.info("[MQTT] Command subscriber started")
        except Exception as e:
            logger.error(f"[MQTT] Subscriber setup failed: {e}")
    
    def _publish_health(self):
        """Publish system health periodically via MQTT"""
        while self.running:
            try:
                entry_status = self.entry_gate.get_status()
                exit_status = self.exit_gate.get_status()
                
                health = {
                    'entry': {
                        'camera_online': entry_status['camera_online'],
                        'processing': entry_status['processing'],
                        'gate_open': entry_status['gate_open']
                    },
                    'exit': {
                        'camera_online': exit_status['camera_online'],
                        'processing': exit_status['processing'],
                        'gate_open': exit_status['gate_open']
                    },
                    'vehicle_model_loaded': self.entry_gate.vehicle_model is not None,
                    'timestamp': time.time()
                }
                
                client = mqtt.Client()
                client.connect(Config.MQTT_BROKER, Config.MQTT_PORT, 60)
                client.publish('gate/health', json.dumps(health))
                client.disconnect()
                
            except Exception as e:
                logger.debug(f"[Health] Publish error: {e}")
            
            time.sleep(5)  # Every 5 seconds
    
    def start(self):
        """Start the gate system"""
        self._create_gates()
        self.running = True
        
        # Send heartbeat to API (HTTP fallback)
        self._send_heartbeat()
        
        # Start both gates
        self.entry_gate.start()
        self.exit_gate.start()
        
        # Start MQTT subscriber for commands
        self._setup_mqtt_subscriber()
        
        # Start health publisher
        self.health_thread = threading.Thread(target=self._publish_health, daemon=True)
        self.health_thread.start()
        
        logger.info("")
        logger.info("=" * 50)
        logger.info("Both gates are now monitoring")
        logger.info("ENTRY: Camera {} | EXIT: Camera {}".format(
            Config.CAMERA_MASUK_ID, Config.CAMERA_KELUAR_ID
        ))
        logger.info("MQTT Command subscriber: ACTIVE")
        logger.info("Health publisher: ACTIVE")
        logger.info("=" * 50)
    
    def stop(self):
        """Stop the gate system"""
        logger.info("Stopping gate system...")
        self.running = False
        
        if self.mqtt_client:
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
        
        if self.entry_gate:
            self.entry_gate.stop()
        if self.exit_gate:
            self.exit_gate.stop()
        
        logger.info("Gate system stopped")
    
    def _send_heartbeat(self):
        """Send heartbeat to API"""
        if set_system_status:
            try:
                set_system_status('gate_controller', 'running')
            except:
                pass


def main():
    """Main entry point"""
    system = GateSystem()
    
    try:
        system.start()
        
        # Keep running
        while True:
            time.sleep(1)
            
            # Periodic heartbeat (HTTP fallback)
            if set_system_status:
                try:
                    set_system_status('gate_controller', 'running')
                except:
                    pass
                
    except KeyboardInterrupt:
        logger.info("\nCtrl+C pressed")
    finally:
        system.stop()


if __name__ == "__main__":
    main()