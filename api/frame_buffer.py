# Shared frame buffer for live camera streaming
# Both main.py (gate controller) and FastAPI will use this

import threading
import numpy as np
import psutil
import time as _time
import subprocess
import re
from collections import deque
from datetime import datetime, timedelta

# Frame buffers for each camera
CAMERA_ENTRY_FRAMES = deque(maxlen=5)  # Keep last 5 frames
CAMERA_EXIT_FRAMES = deque(maxlen=5)

# Camera status
CAMERA_STATUS = {
    'entry': {'active': False, 'last_seen': None, 'status': 'offline'},
    'exit': {'active': False, 'last_seen': None, 'status': 'offline'}
}

# System status
SYSTEM_STATUS = {
    'gate_controller': {'status': 'offline', 'last_seen': None},
    'mqtt': {'status': 'offline', 'last_seen': None},
}

# Lock for thread safety
_buffer_lock = threading.Lock()

def get_frame_camera_entry():
    """Get latest entry camera frame (as JPEG bytes)"""
    with _buffer_lock:
        if CAMERA_ENTRY_FRAMES:
            return CAMERA_ENTRY_FRAMES[-1]
    return None

def get_frame_camera_exit():
    """Get latest exit camera frame (as JPEG bytes)"""
    with _buffer_lock:
        if CAMERA_EXIT_FRAMES:
            return CAMERA_EXIT_FRAMES[-1]
    return None

def push_frame_camera_entry(frame_bytes):
    """Push a frame to entry camera buffer"""
    with _buffer_lock:
        CAMERA_ENTRY_FRAMES.append({
            'frame': frame_bytes,
            'timestamp': datetime.now()
        })
        CAMERA_STATUS['entry']['last_seen'] = datetime.now()
        CAMERA_STATUS['entry']['active'] = True
        CAMERA_STATUS['entry']['status'] = 'streaming'

def push_frame_camera_exit(frame_bytes):
    """Push a frame to exit camera buffer"""
    with _buffer_lock:
        CAMERA_EXIT_FRAMES.append({
            'frame': frame_bytes,
            'timestamp': datetime.now()
        })
        CAMERA_STATUS['exit']['last_seen'] = datetime.now()
        CAMERA_STATUS['exit']['active'] = True
        CAMERA_STATUS['exit']['status'] = 'streaming'

def get_camera_status():
    """Get status of both cameras"""
    with _buffer_lock:
        now = datetime.now()
        for cam in ['entry', 'exit']:
            last = CAMERA_STATUS[cam].get('last_seen')
            if last and (now - last) > timedelta(seconds=10):
                CAMERA_STATUS[cam]['status'] = 'idle'
                CAMERA_STATUS[cam]['active'] = False
        return CAMERA_STATUS.copy()

def get_system_status():
    """Get system status"""
    with _buffer_lock:
        return {
            'cameras': CAMERA_STATUS.copy(),
            'systems': SYSTEM_STATUS.copy()
        }

def set_system_status(name, status):
    """Set system status"""
    with _buffer_lock:
        if name in SYSTEM_STATUS:
            SYSTEM_STATUS[name]['status'] = status
            SYSTEM_STATUS[name]['last_seen'] = datetime.now()

# Cache for system health to avoid hammering psutil every call
_health_cache = {'data': None, 'last_fetch': 0}
_HEALTH_CACHE_TTL = 2  # seconds

def get_system_health():
    """Get CPU, RAM, disk, and uptime stats with caching"""
    now = _time.time()
    if _health_cache['data'] and (now - _health_cache['last_fetch']) < _HEALTH_CACHE_TTL:
        return _health_cache['data']

    try:
        cpu_percent = psutil.cpu_percent(interval=0.3)
        cpu_count = psutil.cpu_count()
        cpu_freq = psutil.cpu_freq()
        cpu_freq_current = round(cpu_freq.current, 1) if cpu_freq else 0

        mem = psutil.virtual_memory()
        ram_percent = round(mem.percent, 1)
        ram_used = round(mem.used / (1024 ** 3), 2)
        ram_total = round(mem.total / (1024 ** 3), 2)

        disk = psutil.disk_usage('/')
        disk_percent = round(disk.percent, 1)
        disk_used = round(disk.used / (1024 ** 3), 2)
        disk_total = round(disk.total / (1024 ** 3), 2)

        boot_time = psutil.boot_time()
        uptime_seconds = int(now - boot_time)

        net = psutil.net_io_counters()
        net_sent = round(net.bytes_sent / (1024 ** 3), 2)
        net_recv = round(net.bytes_recv / (1024 ** 3), 2)

        cpu_temp = None
        gpu_temp = None

        if hasattr(psutil, 'sensors_temperatures'):
            sensors = psutil.sensors_temperatures()
            if sensors:
                for name, entries in sensors.items():
                    if entries and cpu_temp is None:
                        cpu_temp = round(entries[0].current, 1)

        if cpu_temp is None:
            try:
                output = subprocess.run(
                    ['wmic', '/namespace:root/wmi', 'PATH', 'MSAcpi_ThermalZoneTemperature', 'get', 'CurrentTemperature'],
                    capture_output=True, text=True, timeout=2
                )
                if output.returncode == 0:
                    lines = output.stdout.strip().split('\n')
                    for line in lines:
                        line = line.strip()
                        if line and line.isdigit():
                            cpu_temp = round((int(line) - 2732) / 10, 1)
                            break
            except Exception:
                pass

        try:
            output = subprocess.run(
                ['nvidia-smi', '--query-gpu=temperature.gpu', '--format=csv,noheader'],
                capture_output=True, text=True, timeout=3
            )
            if output.returncode == 0 and output.stdout.strip():
                gpu_temp = round(float(output.stdout.strip()), 1)
        except Exception:
            pass

        result = {
            'cpu': {
                'percent': cpu_percent,
                'count': cpu_count,
                'freq_mhz': cpu_freq_current,
                'temp_celsius': cpu_temp,
            },
            'gpu': {
                'temp_celsius': gpu_temp,
            },
            'ram': {
                'percent': ram_percent,
                'used_gb': ram_used,
                'total_gb': ram_total,
            },
            'disk': {
                'percent': disk_percent,
                'used_gb': disk_used,
                'total_gb': disk_total,
            },
            'uptime_seconds': uptime_seconds,
            'network': {
                'sent_gb': net_sent,
                'recv_gb': net_recv,
            },
        }
        _health_cache['data'] = result
        _health_cache['last_fetch'] = now
        return result
    except Exception:
        return None

def clear_buffers():
    """Clear all buffers"""
    with _buffer_lock:
        CAMERA_ENTRY_FRAMES.clear()
        CAMERA_EXIT_FRAMES.clear()
        CAMERA_STATUS = {
            'entry': {'active': False, 'last_seen': None, 'status': 'offline'},
            'exit': {'active': False, 'last_seen': None, 'status': 'offline'}
        }
        SYSTEM_STATUS = {
            'gate_controller': {'status': 'offline', 'last_seen': None},
            'mqtt': {'status': 'offline', 'last_seen': None},
        }