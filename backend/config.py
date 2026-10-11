import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class Config:
    # File paths - use absolute paths
    ENCODE_FILE = os.path.join(BASE_DIR, "R_encode.json")
    DATA_FILE = os.path.join(BASE_DIR, "R_data.json")
    GUEST_FILE = os.path.join(BASE_DIR, "G_data.json")
    VP_DATA_FILE = os.path.join(BASE_DIR, "VP_data.json")
    VP_ENCODE_FILE = os.path.join(BASE_DIR, "VP_encode.json")
    YOLO_MODEL_PATH = os.path.join(BASE_DIR, "yolo26.pt")
    YOLO_VEHICLE_PATH = os.path.join(BASE_DIR, "yolo_vehicle.pt")
    
    # Database
    DB_DIR = os.path.join(BASE_DIR, "db")
    DB_PATH = os.path.join(DB_DIR, "security_log.db")
    PUBLIC_DIR = os.path.join(BASE_DIR, "public")
    UPLOAD_DIR = os.path.join(PUBLIC_DIR, "uploads")
    FRAME_SAVE_DIR = os.path.join(UPLOAD_DIR, "frames")
    FACE_SAVE_DIR = os.path.join(UPLOAD_DIR, "faces")
    PLATE_SAVE_DIR = os.path.join(UPLOAD_DIR, "plates")
    
    # MQTT
    MQTT_BROKER = "localhost"
    MQTT_PORT = 1883
    MQTT_TOPIC_DETEKSI = "gate/detection"
    MQTT_TOPIC_PERINTAH = "gate/command"
    HTTP_SERVER = "http://localhost:3002"
    
    # Recognition settings
    FACE_TOLERANCE = 0.5
    PLATE_MIN_LENGTH = 5
    PLATE_CONFIDENCE_THRESHOLD = 0.6
    
    # Camera settings
    CAMERA_WIDTH = 1280
    CAMERA_HEIGHT = 720
    
    # Camera IDs and sensor pins
    CAMERA_MASUK_ID = 0
    SENSOR_MASUK_PIN = 17
    CAMERA_KELUAR_ID = 1
    SENSOR_KELUAR_PIN = 27
    
    # Detection settings
    VEHICLE_DETECTION_ENABLED = True
    VEHICLE_DETECTION_DISTANCE_M = 10  # meters
    DETECTION_TIMEOUT = 30
    STABILITY_DURATION = 1
    SENSOR_TRIGGER_DISTANCE_CM = 200

class Mode:
    MASUK = "MASUK"
    KELUAR = "KELUAR"
    VALID_MODES = {MASUK, KELUAR}
