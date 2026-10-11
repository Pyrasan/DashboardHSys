import time
import cv2
import logging
from typing import Optional, Tuple
from ultralytics import YOLO
from paddleocr import PaddleOCR
import os
from datetime import datetime
import re
from collections import Counter
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEBUG_DIR = "debug_plate"
os.makedirs(DEBUG_DIR, exist_ok=True)


def debug_save(name: str, img) -> bool:
    try:
        ts = datetime.now().strftime("%H%M%S_%f")
        path = os.path.join(DEBUG_DIR, f"{name}_{ts}.jpg")
        success = cv2.imwrite(path, img)
        if not success:
            logger.warning(f"[ocr] debug_save: cv2.imwrite returned False for {name}")
        return success
    except cv2.error as e:
        logger.error(f"[ocr] debug_save error for {name}: {e}")
        return False
    except OSError as e:
        logger.error(f"[ocr] debug_save OS error for {name}: {e}")
        return False


def clean_plate(text: str) -> str:
    text = text.upper()
    text = re.sub(r'[^A-Z0-9]', '', text)
    return text


def format_plate(text: str) -> str:
    match = re.match(r"([A-Z]{1,2})([0-9]{1,4})([A-Z]{1,3})", text)
    if match:
        return f"{match.group(1)} {match.group(2)} {match.group(3)}"
    return text


class PlateRecognizer:
    MIN_PLATE_LENGTH = 5
    OCR_CONFIDENCE_THRESHOLD = 0.6

    def __init__(self, yolo_model_path: str = "yolo26s.pt", ocr_lang: str = "en", save_dir: str = None):
        self.yolo_model_path = yolo_model_path
        self.detector = None
        self.ocr = None
        self.save_dir = save_dir or os.path.join(os.path.dirname(__file__), "public", "uploads", "plates")
        os.makedirs(self.save_dir, exist_ok=True)
        self._init_models(ocr_lang)

    def _init_models(self, ocr_lang: str):
        try:
            logger.info(f"[ocr] Loading YOLO model from: {self.yolo_model_path}")
            if not os.path.exists(self.yolo_model_path):
                raise FileNotFoundError(f"Model file not found: {self.yolo_model_path}")
            self.detector = YOLO(self.yolo_model_path)
            logger.info("[ocr] YOLO model loaded successfully")
        except Exception as e:
            raise RuntimeError(f"[ocr] Failed to load YOLO model: {e}")

        try:
            logger.info("[ocr] Loading PaddleOCR model...")
            self.ocr = PaddleOCR(
                lang=ocr_lang, 
                use_angle_cls=True, 
                det=True, 
                rec=True,
                use_gpu=False,
                show_log=False
            )
            logger.info("[ocr] PaddleOCR loaded successfully")
        except Exception as e:
            logger.warning(f"[ocr] PaddleOCR init error: {e}, retrying with GPU disabled...")
            try:
                self.ocr = PaddleOCR(
                    lang=ocr_lang, 
                    use_angle_cls=True, 
                    det=True, 
                    rec=True,
                    use_gpu=False,
                    use_dml=False,
                    show_log=False
                )
                logger.info("[ocr] PaddleOCR loaded successfully (fallback mode)")
            except Exception as e2:
                raise RuntimeError(f"[ocr] Failed to load PaddleOCR: {e2}")

    def extract_text_from_roi(self, roi) -> Optional[str]:
        try:
            if roi is None or (hasattr(roi, 'size') and roi.size == 0):
                logger.warning("[ocr] Empty ROI passed to extract_text_from_roi")
                return None

            if not isinstance(roi, np.ndarray):
                logger.warning("[ocr] ROI is not a numpy array")
                return None

            debug_save("2_roi_yolo", roi)

            h, w = roi.shape[:2]
            if h <= 10 or w <= 10:
                logger.warning(f"[ocr] ROI too small: {w}x{h}")
                return None

            if len(roi.shape) != 3:
                logger.warning(f"[ocr] Invalid ROI shape: {roi.shape}")
                return None

            top = 0
            bottom = int(h * 0.75)
            roi_main = roi[top:bottom, :]

            if roi_main.size == 0:
                logger.warning("[ocr] Cropped ROI is empty")
                return None

            debug_save("3_roi_cropped", roi_main)

            gray = cv2.cvtColor(roi_main, cv2.COLOR_BGR2GRAY)
            gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)

            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            gray = clahe.apply(gray)
            gray = cv2.GaussianBlur(gray, (3, 3), 0)

            debug_save("4_preprocessed", gray)

            rgb = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)

            try:
                result = self.ocr.ocr(rgb, cls=False)
            except Exception as ocr_error:
                logger.warning(f"[ocr] PaddleOCR error: {ocr_error}")
                try:
                    result = self.ocr.ocr(roi_main, cls=False)
                except Exception as retry_error:
                    logger.warning(f"[ocr] PaddleOCR retry failed: {retry_error}")
                    try:
                        result = self.ocr.ocr(gray, cls=False)
                    except Exception as retry_error2:
                        logger.warning(f"[ocr] PaddleOCR retry 2 failed: {retry_error2}")
                        return None

            if not result or not result[0]:
                logger.debug("[ocr] No OCR results found")
                return None

            boxes = []
            for line in result[0]:
                try:
                    box = line[0]
                    text = line[1][0]
                    conf = line[1][1]

                    if conf > self.OCR_CONFIDENCE_THRESHOLD:
                        x = box[0][0]
                        boxes.append((x, text))
                except (IndexError, TypeError) as e:
                    logger.warning(f"[ocr] Error parsing OCR line: {e}")
                    continue

            if not boxes:
                return None

            boxes = sorted(boxes, key=lambda x: x[0])
            texts = [b[1] for b in boxes]

            plate = "".join(texts)
            plate = clean_plate(plate)

            if len(plate) < self.MIN_PLATE_LENGTH:
                logger.debug(f"[ocr] Plate too short: {plate}")
                return None

            logger.info(f"[ocr] Detected plate: {plate}")
            return plate

        except cv2.error as e:
            logger.error(f"[ocr] OpenCV error in extract_text_from_roi: {e}")
        except Exception as e:
            logger.error(f"[ocr] Unexpected error in extract_text_from_roi: {e}")

        return None

    def detect_from_frame(self, frame, score_threshold: float = 0.4) -> Tuple[Optional[str], Optional[Tuple]]:
        try:
            if frame is None or (hasattr(frame, 'size') and frame.size == 0):
                logger.warning("[ocr] Empty frame passed to detect_from_frame")
                return None, None

            results = self.detector(frame, conf=score_threshold)

            if not results or len(results) == 0:
                return None, None

            for box in results[0].boxes:
                try:
                    conf = float(box.conf[0]) if hasattr(box, "conf") else 1.0
                    if conf < score_threshold:
                        continue

                    x1, y1, x2, y2 = map(int, box.xyxy[0])

                    h, w = frame.shape[:2]
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(w, x2), min(h, y2)

                    if x2 <= x1 or y2 <= y1:
                        continue

                    pad = 10
                    x1 = max(0, x1 - pad)
                    x2 = min(frame.shape[1], x2 + pad)

                    roi = frame[y1:y2, x1:x2]

                    debug_frame = frame.copy()
                    cv2.rectangle(debug_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    debug_save("1_full_frame", debug_frame)

                    plate = self.extract_text_from_roi(roi)

                    if plate:
                        return plate, (x1, y1, x2, y2)

                except (ValueError, IndexError) as e:
                    logger.warning(f"[ocr] Error processing detection box: {e}")
                    continue

        except cv2.error as e:
            logger.error(f"[ocr] OpenCV error in detect_from_frame: {e}")
        except Exception as e:
            logger.error(f"[ocr] Unexpected error in detect_from_frame: {e}")

        return None, None

    def save_plate_crop(self, frame, box: tuple, prefix: str = "PLATE") -> Optional[str]:
        try:
            if frame is None or box is None:
                return None
            
            x1, y1, x2, y2 = box
            h, w = frame.shape[:2]
            
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            
            pad = 5
            x1 = max(0, x1 - pad)
            y1 = max(0, y1 - pad)
            x2 = min(w, x2 + pad)
            y2 = min(h, y2 + pad)
            
            if y2 > y1 and x2 > x1:
                plate_crop = frame[y1:y2, x1:x2]
                
                ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"{prefix}_{ts}.jpg"
                filepath = os.path.join(self.save_dir, filename)
                
                success = cv2.imwrite(filepath, plate_crop)
                if success:
                    logger.info(f"[ocr] Saved plate crop: {filepath}")
                    return filepath.replace("\\", "/")
                else:
                    logger.warning(f"[ocr] Failed to save plate crop")
            else:
                logger.warning(f"[ocr] Invalid box dimensions")
        except Exception as e:
            logger.error(f"[ocr] Error saving plate crop: {e}")
        
        return None

    def detect_from_camera(self, kamera_id: int = 1, window_name: str = "Kamera Plat Nomor",
                          score_threshold: float = 0.4, show_window: bool = True) -> Optional[str]:
        cap = cv2.VideoCapture(kamera_id)
        if not cap.isOpened():
            logger.error(f"[ocr] Camera ID {kamera_id} cannot be opened")
            return None

        plates = []
        detected_plate = None

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    logger.warning(f"[ocr] Failed to read frame from camera {kamera_id}")
                    break

                plate, box = self.detect_from_frame(frame, score_threshold=score_threshold)
                if box:
                    x1, y1, x2, y2 = box
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(frame, plate or "N/A", (x1, max(y1 - 10, 20)),
                               cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

                if show_window:
                    cv2.imshow(window_name, frame)

                if plate:
                    plates.append(plate)
                    logger.info(f"[ocr] detected: {plate}")

                    if len(plates) >= 1:
                        most_common = Counter(plates).most_common(1)[0][0]
                        detected_plate = most_common
                        break

                if show_window and (cv2.waitKey(1) & 0xFF == ord('q')):
                    break

        finally:
            cap.release()
            if show_window:
                try:
                    cv2.destroyWindow(window_name)
                except cv2.error:
                    pass

        return detected_plate
