import os
import json
import cv2
import numpy as np
import face_recognition
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FaceRecognizer:
    DEFAULT_TOLERANCE = 0.5

    def __init__(self, encode_file: str, save_dir: str = None):
        self.encode_file = encode_file
        self.save_dir = save_dir or os.path.join(os.path.dirname(__file__), "public", "uploads", "faces")
        os.makedirs(self.save_dir, exist_ok=True)
        self.encode_list_known: List[np.ndarray] = []
        self.known_names: List[str] = []
        self._load_encodings()

    def _load_encodings(self):
        if not os.path.exists(self.encode_file):
            raise FileNotFoundError(f"EncodeFile.json tidak ditemukan: {self.encode_file}")

        try:
            with open(self.encode_file, "r", encoding="utf-8") as f:
                loaded_data = json.load(f)

            if isinstance(loaded_data, dict):
                for pid, enc in loaded_data.items():
                    self.encode_list_known.append(np.array(enc))
                    self.known_names.append(str(pid))
            elif isinstance(loaded_data, list):
                for item in loaded_data:
                    if isinstance(item, dict) and "id" in item and "encoding" in item:
                        self.encode_list_known.append(np.array(item["encoding"]))
                        self.known_names.append(str(item["id"]))
            else:
                raise ValueError(f"Format EncodeFile tidak dikenali: {type(loaded_data)}")

            logger.info(f"[face] Loaded {len(self.known_names)} face encodings")

        except json.JSONDecodeError as e:
            raise ValueError(f"Gagal parse EncodeFile.json: {e}")
        except Exception as e:
            raise ValueError(f"Error memuat EncodeFile: {e}")

    def detect(self, frame, tolerance: float = DEFAULT_TOLERANCE) -> List[Dict[str, Any]]:
        try:
            if frame is None or (hasattr(frame, 'size') and frame.size == 0):
                logger.warning("[face] Empty frame passed to detect")
                return []

            small = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
            rgb_small = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)

            faces = face_recognition.face_locations(rgb_small)
            encs = face_recognition.face_encodings(rgb_small, faces)

            results = []
            for enc_face, (top, right, bottom, left) in zip(encs, faces):
                try:
                    name = "Tamu"
                    distance = None
                    
                    try:
                        from tamu import find_tamu_by_encoding
                        tamu_id = find_tamu_by_encoding(enc_face, 0.4)
                        if tamu_id:
                            name = f"G_{tamu_id[1:]}"
                            logger.info(f"[face] Matched guest: {tamu_id} -> {name}")
                    except Exception as e:
                        logger.warning(f"[face] Error checking guest database: {e}")

                    if name == "Tamu":
                        matches = face_recognition.compare_faces(
                            self.encode_list_known, enc_face, tolerance=tolerance
                        )
                        face_dis = face_recognition.face_distance(self.encode_list_known, enc_face)

                        idx = np.argmin(face_dis) if len(face_dis) > 0 else -1

                        if idx != -1 and matches[idx]:
                            name = self.known_names[idx]
                            distance = float(face_dis[idx])

                    results.append({
                        "name": name,
                        "encoding": enc_face,
                        "box": (top * 4, right * 4, bottom * 4, left * 4),
                        "distance": distance
                    })

                except Exception as e:
                    logger.warning(f"[face] Error processing face encoding: {e}")
                    continue

            return results

        except cv2.error as e:
            logger.error(f"[face] OpenCV error in detect: {e}")
        except Exception as e:
            logger.error(f"[face] Unexpected error in detect: {e}")

        return []

    def save_face_crop(self, frame, box: tuple, prefix: str = "FACE") -> Optional[str]:
        try:
            if frame is None or box is None:
                return None
            
            top, right, bottom, left = box
            h, w = frame.shape[:2]
            
            top = max(0, min(h, top))
            bottom = max(0, min(h, bottom))
            left = max(0, min(w, left))
            right = max(0, min(w, right))
            
            if bottom > top and right > left:
                face_crop = frame[top:bottom, left:right]
                
                ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"{prefix}_{ts}.jpg"
                filepath = os.path.join(self.save_dir, filename)
                
                success = cv2.imwrite(filepath, face_crop)
                if success:
                    logger.info(f"[face] Saved face crop: {filepath}")
                    return filepath.replace("\\", "/")
                else:
                    logger.warning(f"[face] Failed to save face crop")
            else:
                logger.warning(f"[face] Invalid box dimensions")
        except Exception as e:
            logger.error(f"[face] Error saving face crop: {e}")
        
        return None
