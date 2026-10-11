import os
import json
import threading
import cv2
import face_recognition
import logging
from datetime import datetime
from typing import Optional, Tuple, List, Dict, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATA_GUEST_FILE = "G_data.json"
DATA_GUEST_ENCODINGS_FILE = "G_encode.json"
GUEST_IMG_DIR = "g_images"

_lock = threading.Lock()

# In-memory cache for fast face comparison
_encodings_cache: Dict[str, List[float]] = {}


def init_guest_storage():
    try:
        os.makedirs(GUEST_IMG_DIR, exist_ok=True)
        if not os.path.exists(DATA_GUEST_FILE):
            with open(DATA_GUEST_FILE, "w", encoding="utf-8") as f:
                json.dump({"g": {}}, f, indent=4, ensure_ascii=False)
        if not os.path.exists(DATA_GUEST_ENCODINGS_FILE):
            with open(DATA_GUEST_ENCODINGS_FILE, "w", encoding="utf-8") as f:
                json.dump({}, f)
        _load_encodings_to_cache()
        logger.info("[guest] Storage initialized")
    except OSError as e:
        logger.error(f"[guest] Failed to initialize storage: {e}")
        raise


def _load_encodings_to_cache():
    global _encodings_cache
    try:
        if os.path.exists(DATA_GUEST_ENCODINGS_FILE):
            with open(DATA_GUEST_ENCODINGS_FILE, "r", encoding="utf-8") as f:
                _encodings_cache = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        logger.error(f"[guest] Failed to load encodings cache: {e}")
        _encodings_cache = {}


def _save_encodings_cache():
    try:
        with open(DATA_GUEST_ENCODINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(_encodings_cache, f)
        return True
    except (IOError, TypeError) as e:
        logger.error(f"[guest] Failed to save encodings cache: {e}")
        return False


def _load_json() -> Dict[str, Any]:
    try:
        if os.path.exists(DATA_GUEST_FILE):
            with open(DATA_GUEST_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        logger.error(f"[guest] Failed to load JSON: {e}")
    return {"g": {}}


def _save_json(data: Dict[str, Any]) -> bool:
    try:
        with open(DATA_GUEST_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        return True
    except (IOError, TypeError) as e:
        logger.error(f"[guest] Failed to save JSON: {e}")
        return False


def _next_id(data: Dict[str, Any]) -> str:
    i = len(data.get("g", {})) + 1
    while True:
        gid = f"G{i:04d}"
        if gid not in data.get("g", {}):
            return gid
        i += 1


def find_guest_by_encoding(face_encoding, tolerance: float = 0.4) -> Optional[str]:
    if not _encodings_cache:
        return None
    
    for guest_id, saved_enc in _encodings_cache.items():
        try:
            matches = face_recognition.compare_faces([saved_enc], face_encoding, tolerance=tolerance)
            face_dis = face_recognition.face_distance([saved_enc], face_encoding)
            
            if matches[0] and face_dis[0] < tolerance:
                logger.info(f"[guest] Match found: {guest_id} (distance: {face_dis[0]:.4f})")
                return guest_id
        except Exception as e:
            logger.warning(f"[guest] Error comparing faces for {guest_id}: {e}")
            continue
    
    return None


def get_guest_entry(guest_id: str) -> Optional[Dict[str, Any]]:
    data = _load_json()
    return data.get("g", {}).get(guest_id)


def normalize_plate(plate: str) -> str:
    import re
    return re.sub(r'[^A-Z0-9]', '', plate.upper())


def check_guest_plate(guest_id: str, detected_plate: str) -> bool:
    entry = get_guest_entry(guest_id)
    if not entry:
        return False
    
    registered_plate = entry.get("plat_nomor", "")
    detected_normalized = normalize_plate(detected_plate)
    
    if isinstance(registered_plate, list):
        for rp in registered_plate:
            if normalize_plate(rp) == detected_normalized:
                return True
        return False
    
    return normalize_plate(registered_plate) == detected_normalized


def delete_guest(guest_id: str) -> bool:
    with _lock:
        data = _load_json()
        
        if guest_id not in data.get("g", {}):
            logger.warning(f"[guest] guest_id {guest_id} not found in data")
            return False
        
        foto_path = data["g"].get(guest_id, {}).get("foto")
        del data["g"][guest_id]
        if not _save_json(data):
            logger.error(f"[guest] Failed to delete {guest_id} from data")
            return False
        
        if guest_id in _encodings_cache:
            del _encodings_cache[guest_id]
            _save_encodings_cache()
        
        if foto_path and os.path.exists(foto_path):
            try:
                os.remove(foto_path)
                logger.info(f"[guest] Deleted image: {foto_path}")
            except OSError as e:
                logger.warning(f"[guest] Failed to delete image: {e}")
        
        logger.info(f"[guest] Deleted guest: {guest_id}")
        return True


def simpan_guest(plat_nomor: Optional[str], img_bgr, face_box=None,
                  extra: Optional[Dict[str, Any]] = None) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:

    try:
        init_guest_storage()
    except Exception:
        return None, None

    with _lock:
        data = _load_json()

        face_encoding = None
        crop = None

        if img_bgr is not None:
            if face_box and len(face_box) == 4:
                try:
                    y1, x2, y2, x1 = face_box
                    h, w = img_bgr.shape[:2]
                    y1 = max(0, min(h, y1))
                    y2 = max(0, min(h, y2))
                    x1 = max(0, min(w, x1))
                    x2 = max(0, min(w, x2))

                    if y2 > y1 and x2 > x1:
                        crop = img_bgr[y1:y2, x1:x2]
                except (ValueError, cv2.error) as e:
                    logger.warning(f"[guest] Failed to crop face: {e}")
                    crop = None

            if crop is None:
                crop = img_bgr

            if crop is not None and hasattr(crop, "size") and crop.size > 0:
                try:
                    img_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
                    face_encs = face_recognition.face_encodings(img_rgb)
                    if face_encs:
                        face_encoding = face_encs[0]
                except Exception as e:
                    logger.warning(f"[guest] Failed to encode face: {e}")
                    face_encoding = None

        GUEST_TOLERANCE = 0.4
        if face_encoding is not None:
            existing_id = find_guest_by_encoding(face_encoding, GUEST_TOLERANCE)
            if existing_id:
                logger.info(f"[guest] Known guest detected -> {existing_id}")
                return existing_id, get_guest_entry(existing_id)

        guest_id = _next_id(data)
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        safe_ts = ts.replace(":", "-").replace(" ", "_")
        filename = f"{guest_id}_{safe_ts}.jpg"
        img_path = os.path.join(GUEST_IMG_DIR, filename)

        saved_foto_path = None
        if crop is not None and hasattr(crop, "size") and crop.size > 0:
            try:
                success = cv2.imwrite(img_path, crop)
                if success:
                    saved_foto_path = img_path.replace("\\", "/")
                else:
                    logger.warning(f"[guest] cv2.imwrite returned False for {img_path}")
            except cv2.error as e:
                logger.error(f"[guest] Failed to save guest image: {e}")

        entry = {
            "waktu": ts,
            "plat_nomor": plat_nomor or "Tidak Diketahui",
            "foto": saved_foto_path,
        }

        if extra:
            entry.update(extra)

        data["g"][guest_id] = entry
        if not _save_json(data):
            logger.error(f"[guest] Failed to save guest data for {guest_id}")
            return None, None

        if face_encoding is not None:
            _encodings_cache[guest_id] = face_encoding.tolist()
            _save_encodings_cache()

        logger.info(f"[guest] New guest saved -> {guest_id}")
        return guest_id, entry


# Backward compatibility aliases (old names -> new names)
init_tamu_storage = init_guest_storage
find_tamu_by_encoding = find_guest_by_encoding
get_tamu_entry = get_guest_entry
check_tamu_plate = check_guest_plate
delete_tamu = delete_guest
simpan_tamu = simpan_guest
GUEST_IMG_DIR = GUEST_IMG_DIR
