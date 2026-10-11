import csv
import os
from datetime import datetime

CSV_FILE = "performance_log.csv"


# ================= INIT CSV =================
def init_csv():
    if not os.path.exists(CSV_FILE):
        with open(CSV_FILE, mode="w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "start_time",
                "end_time",
                "total_response_ms",
                "face_detection_ms",
                "plate_detection_ms",
                "face_detected",
                "plate_correct",
                "face_plate_match"
            ])


# ================= LOG PERFORMANCE =================
def log_performance(start_time,
                    face_detection_ms,
                    plate_detection_ms,
                    face_detected,
                    plate_correct,
                    match):

    end_time = datetime.now()

    total_response = (end_time - start_time).total_seconds() * 1000

    with open(CSV_FILE, mode="a", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            start_time.strftime("%Y-%m-%d %H:%M:%S"),
            end_time.strftime("%Y-%m-%d %H:%M:%S"),
            round(total_response, 2),
            round(face_detection_ms, 2),
            round(plate_detection_ms, 2),
            face_detected,
            plate_correct,
            match
        ])