# Vehicle Detection using YOLO
# Detects cars/motorcycles and triggers recognition

import os
import cv2
import numpy as np
import logging
from typing import Tuple, Optional, List, Dict, Any

logger = logging.getLogger(__name__)

class VehicleDetector:
    COCO_CLASSES = [
        'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat'
    ]
    # Vehicle classes in COCO (car, motorcycle, truck, bus)
    VEHICLE_CLASSES = {2, 3, 5, 7, 8}  # car, motorcycle, bus, truck
    
    def __init__(self, model_path: str, confidence: float = 0.5):
        self.model_path = model_path
        self.confidence = confidence
        self.model = None
        self._load_model()
    
    def _load_model(self):
        try:
            from ultralytics import YOLO
            if os.path.exists(self.model_path):
                self.model = YOLO(self.model_path)
                logger.info(f"[Vehicle] YOLO model loaded: {self.model_path}")
            else:
                logger.warning(f"[Vehicle] YOLO model not found: {self.model_path}")
        except Exception as e:
            logger.error(f"[Vehicle] Failed to load YOLO: {e}")
            self.model = None
    
    def detect_vehicles(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """Detect vehicles in frame, return list of detections"""
        if self.model is None:
            return []
        
        try:
            results = self.model(frame, conf=self.confidence, verbose=False)[0]
            detections = []
            
            for box, cls, conf in zip(results.boxes.xyxy, results.boxes.cls, results.boxes.conf):
                class_id = int(cls)
                if class_id in self.VEHICLE_CLASSES:
                    x1, y1, x2, y2 = box.cpu().numpy()
                    detections.append({
                        'class': class_id,
                        'name': self.COCO_CLASSES[class_id] if class_id < len(self.COCO_CLASSES) else 'vehicle',
                        'confidence': float(conf),
                        'bbox': [int(x1), int(y1), int(x2), int(y2)],
                        'center': ((x1 + x2) / 2, (y1 + y2) / 2),
                        'distance': None  # Will be calculated
                    })
            
            return detections
        except Exception as e:
            logger.error(f"[Vehicle] Detection error: {e}")
            return []
    
    def calculate_distance(self, detection: Dict, frame_height: int, known_distance_m: float = 10) -> float:
        """Estimate distance based on bounding box size"""
        bbox = detection['bbox']
        box_height = bbox[3] - bbox[1]
        
        # Simple distance estimation (larger box = closer)
        # Average car height at 10m is ~150 pixels
        reference_height = 150
        estimated_distance = (reference_height / box_height) * known_distance_m if box_height > 0 else known_distance_m
        
        return estimated_distance


class CameraStream:
    """Always-on camera stream with vehicle detection"""
    
    def __init__(self, camera_id: int, vehicle_detector: VehicleDetector):
        self.camera_id = camera_id
        self.vehicle_detector = vehicle_detector
        self.cap = None
        self.is_active = False
        self._open_camera()
    
    def _open_camera(self):
        """Open camera and keep it open"""
        if self.cap is not None and self.cap.isOpened():
            return
        
        self.cap = cv2.VideoCapture(self.camera_id)
        if self.cap.isOpened():
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            self.is_active = True
            logger.info(f"[Camera {self.camera_id}] Opened")
        else:
            logger.error(f"[Camera {self.camera_id}] Failed to open")
    
    def read(self) -> Tuple[bool, Optional[np.ndarray]]:
        """Read frame from camera"""
        if self.cap is None or not self.cap.isOpened():
            self._open_camera()
        
        if self.cap is not None and self.cap.isOpened():
            ret, frame = self.cap.read()
            return ret, frame
        return False, None
    
    def check_vehicle_nearby(self, max_distance_m: float = 10) -> Tuple[bool, Optional[List[Dict]]]:
        """Check if vehicle is nearby, return (has_vehicle, detections)"""
        ret, frame = self.read()
        if not ret or frame is None:
            return False, []
        
        detections = self.vehicle_detector.detect_vehicles(frame)
        
        # Filter by distance
        frame_height = frame.shape[0]
        nearby = []
        for det in detections:
            dist = self.vehicle_detector.calculate_distance(det, frame_height, max_distance_m)
            det['distance'] = dist
            if dist <= max_distance_m:
                nearby.append(det)
        
        return len(nearby) > 0, nearby
    
    def release(self):
        """Release camera"""
        if self.cap is not None:
            self.cap.release()
            self.is_active = False
            logger.info(f"[Camera {self.camera_id}] Released")


def run_camera_loop(mode: str, camera_id: int, sensor_pin: int, vehicle_model_path: str, 
                   on_vehicle_detected=None, max_distance: float = 10):
    """Main loop that keeps camera open and detects vehicles"""
    
    vehicle_detector = VehicleDetector(vehicle_model_path)
    camera = CameraStream(camera_id, vehicle_detector)
    
    logger.info(f"[camera_{mode}] Started - monitoring for vehicles")
    
    try:
        while True:
            # Always read frame
            has_vehicle, detections = camera.check_vehicle_nearby(max_distance)
            
            if has_vehicle and on_vehicle_detected:
                logger.info(f"[camera_{mode}] Vehicle detected at ~{detections[0]['distance']:.1f}m")
                
                # Trigger recognition callback
                ret, frame = camera.read()
                if ret and frame is not None:
                    on_vehicle_detected(frame, mode, detections)
            
            # Small delay to prevent CPU overload
            cv2.waitKey(30)
    
    except KeyboardInterrupt:
        logger.info(f"[camera_{mode}] Stopped")
    finally:
        camera.release()


if __name__ == "__main__":
    import sys
    
    # Test vehicle detection
    model_path = sys.argv[1] if len(sys.argv) > 1 else "yolo_vehicle.pt"
    
    detector = VehicleDetector(model_path)
    
    # Test on camera 0
    camera = CameraStream(0, detector)
    
    print("Testing vehicle detection. Press Ctrl+C to stop.")
    
    while True:
        has_vehicle, detections = camera.check_vehicle_nearby(max_distance_m=10)
        
        if has_vehicle:
            print(f"Vehicle detected! {len(detections)} vehicles at ~{detections[0]['distance']:.1f}m")
        
        cv2.waitKey(30)