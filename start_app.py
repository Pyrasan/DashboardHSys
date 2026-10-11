#!/usr/bin/env python
import os
import sys
import subprocess
import threading
from pathlib import Path
from datetime import datetime

try:
    import flet as ft
except ImportError:
    print("Installing Flet...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "flet"])
    import flet as ft

BASE_DIR = Path(__file__).resolve().parent
PYTHON_EXE = BASE_DIR / "dep" / "Scripts" / "python.exe"
if not PYTHON_EXE.exists():
    PYTHON_EXE = sys.executable

COLORS = {
    'bg': '#0b1120',
    'sidebar': '#111827',
    'sidebar_active': '#1e3a5a',
    'card': '#1e293b',
    'console_bg': '#0d0f14',
    'green': '#22c55e',
    'red': '#ef4444', 
    'amber': '#f59e0b',
    'white': '#f1f5f9',
    'gray': '#94a3b8',
    'border': '#334155',
    'blue': '#3b82f6',
}

class ServiceManager:
    def __init__(self):
        self.processes = {}
        self.logs = {name: [] for name in ['Detection', 'API', 'Frontend']}
    
    def is_running(self, name):
        if name not in self.processes:
            return False
        proc = self.processes.get(name)
        return proc and proc.poll() is None
    
    def log(self, name, msg):
        self.logs[name].append(msg)
        if len(self.logs[name]) > 500:
            self.logs[name] = self.logs[name][-500:]
    
    def start(self, name, cmd, cwd):
        if self.is_running(name):
            self.log(name, f"[{datetime.now().strftime('%H:%M:%S')}] Already running!")
            return
        
        try:
            startupinfo = subprocess.STARTUPINFO(dwFlags=subprocess.STARTF_USESHOWWINDOW)
            # Handle .bat files properly
            if str(cmd).endswith('.bat'):
                actual_cmd = f'cmd /c "{cmd}"'
            else:
                actual_cmd = cmd
            
            proc = subprocess.Popen(
                actual_cmd,
                cwd=str(cwd),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                stdin=subprocess.PIPE,
                shell=True,
                startupinfo=startupinfo,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
            )
            self.processes[name] = proc
            self.log(name, f"[{datetime.now().strftime('%H:%M:%S')}] Started: {cmd}")
            
            def read_output():
                while proc.poll() is None:
                    try:
                        data = proc.stdout.read(1024)
                        if data:
                            text = data.decode('utf-8', errors='ignore')
                            for line in text.split('\n'):
                                if line.strip():
                                    self.log(name, f"[{datetime.now().strftime('%H:%M:%S')}] {line.strip()}")
                    except:
                        break
            
            thread = threading.Thread(target=read_output, daemon=True)
            thread.start()
        except Exception as e:
            self.log(name, f"[{datetime.now().strftime('%H:%M:%S')}] Error: {e}")
    
    def stop(self, name):
        if name in self.processes:
            proc = self.processes[name]
            try:
                proc.terminate()
                proc.wait(timeout=3)
            except:
                proc.kill()
            del self.processes[name]
            self.log(name, f"[{datetime.now().strftime('%H:%M:%S')}] Stopped")
    
    def restart(self, name, cmd, cwd):
        self.stop(name)
        self.start(name, cmd, cwd)
    
    def get_logs(self, name):
        return '\n'.join(self.logs.get(name, []))

manager = ServiceManager()

services_config = [
    ('Detection', 'run_main.bat', BASE_DIR),
    ('API', 'run_api.bat', BASE_DIR),
    ('Frontend', 'npm run dev', BASE_DIR / 'frontend'),
]

# UI state
sidebar_items = []
main_console = None
status_bar = None
active_service = ['Detection']

def create_sidebar():
    sidebar = ft.Column([
        ft.Container(
            content=ft.Column([
                ft.Text('SecurePass', size=16, weight=ft.FontWeight.BOLD, color=COLORS['white']),
                ft.Text('Smart Gate', size=10, color=COLORS['gray']),
            ]),
            padding=ft.Padding(15, 15, 10, 10),
        ),
        ft.Divider(height=1, color=COLORS['border']),
    ], spacing=0, expand=True)
    
    for name, cmd, cwd in services_config:
        item = ft.Container(
            content=ft.Row([
                ft.Container(width=7, height=7, border_radius=7, bgcolor=COLORS['gray']),
                ft.Text(name, size=12, color=COLORS['gray']),
            ], spacing=10),
            padding=ft.Padding(15, 15, 12, 12),
            border=ft.Border(right=ft.BorderSide(3, 'transparent')),
            ink=True,
            on_click=lambda e, n=name: switch_service(n),
            data=name,
        )
        sidebar_items.append(item)
        sidebar.controls.append(item)
    
    return ft.Container(
        content=sidebar,
        width=220,
        bgcolor=COLORS['sidebar'],
        border=ft.Border(right=ft.BorderSide(1, COLORS['border'])),
    )

def switch_service(name):
    active_service[0] = name
    update_sidebar()
    update_console()

def update_sidebar():
    for item in sidebar_items:
        name = item.data
        is_active = (name == active_service[0])
        
        if is_active:
            item.bgcolor = COLORS['sidebar_active']
            item.border = ft.Border(left=ft.BorderSide(3, COLORS['blue']))
        else:
            item.bgcolor = COLORS['sidebar']
            item.border = ft.Border(left=ft.BorderSide(3, 'transparent'))
        
        # Access the row inside the container
        if item.content and isinstance(item.content, ft.Row):
            row = item.content
            if len(row.controls) >= 2:
                dot = row.controls[0]
                txt = row.controls[1]
                if manager.is_running(name):
                    dot.bgcolor = COLORS['green']
                else:
                    dot.bgcolor = COLORS['gray']
                if is_active:
                    txt.color = COLORS['white']
                else:
                    txt.color = COLORS['gray']

def update_console():
    if main_console:
        main_console.value = manager.get_logs(active_service[0])
        try:
            main_console.scroll_to(0, 99999)
        except:
            pass

def create_header():
    return ft.Container(
        content=ft.Row([
            ft.Text('SecurePass Control Panel', size=14, weight=ft.FontWeight.BOLD, color=COLORS['white']),
            ft.Container(expand=True),
            ft.Row([
                ft.Container(
                    content=ft.Row([
                        ft.Container(width=7, height=7, border_radius=7, bgcolor=COLORS['green'] if manager.is_running('Detection') else COLORS['gray']),
                        ft.Text('Detection', size=10, color=COLORS['gray']),
                    ], spacing=5),
                    padding=ft.Padding(8, 12, 8, 12),
                ),
                ft.Container(
                    content=ft.Row([
                        ft.Container(width=7, height=7, border_radius=7, bgcolor=COLORS['green'] if manager.is_running('API') else COLORS['gray']),
                        ft.Text('API', size=10, color=COLORS['gray']),
                    ], spacing=5),
                    padding=ft.Padding(8, 12, 8, 12),
                ),
                ft.Container(
                    content=ft.Row([
                        ft.Container(width=7, height=7, border_radius=7, bgcolor=COLORS['green'] if manager.is_running('Frontend') else COLORS['gray']),
                        ft.Text('Frontend', size=10, color=COLORS['gray']),
                    ], spacing=5),
                    padding=ft.Padding(8, 12, 8, 12),
                ),
            ], spacing=15),
        ]),
        padding=ft.Padding(15, 20, 15, 20),
        bgcolor=COLORS['bg'],
        border=ft.Border(bottom=ft.BorderSide(1, COLORS['border'])),
        height=60,
    )

def create_main_area():
    global main_console
    
    traffic_lights = ft.Row([
        ft.Container(width=11, height=11, border_radius=11, bgcolor='#ff5f57'),
        ft.Container(width=11, height=11, border_radius=11, bgcolor='#febc2e'),
        ft.Container(width=11, height=11, border_radius=11, bgcolor='#28c840'),
    ], spacing=6, margin=ft.Margin(0, 0, 10, 15))
    
    console_header = ft.Row([
        traffic_lights,
        ft.Container(expand=True),
        ft.Text(active_service[0], size=11, color=COLORS['gray']),
    ], alignment=ft.MainAxisAlignment.CENTER)
    
    main_console = ft.TextField(
        value='',
        multiline=True,
        read_only=True,
        min_lines=20,
        max_lines=20,
        text_size=10,
        text_style=ft.TextStyle(font_family="JetBrains Mono, Fira Code, Consolas, monospace"),
        bgcolor=COLORS['console_bg'],
        border_color=COLORS['console_bg'],
        color=COLORS['white'],
    )
    
    btn_row = ft.Row([
        ft.TextButton(
            'START',
            on_click=lambda e: on_start_click(e, active_service[0]),
            style=ft.ButtonStyle(bgcolor=COLORS['green'], color=COLORS['white'], padding=10),
        ),
        ft.TextButton(
            'RESTART',
            on_click=lambda e: on_restart_click(e, active_service[0]),
            style=ft.ButtonStyle(bgcolor=COLORS['amber'], color=COLORS['white'], padding=10),
        ),
        ft.TextButton(
            'STOP',
            on_click=lambda e: on_stop_click(e, active_service[0]),
            style=ft.ButtonStyle(bgcolor=COLORS['red'], color=COLORS['white'], padding=10),
        ),
        ft.Container(expand=True),
        ft.TextButton(
            'START ALL',
            on_click=lambda e: start_all_services(),
            style=ft.ButtonStyle(bgcolor='transparent', color=COLORS['green'], padding=10),
        ),
        ft.TextButton(
            'RESTART ALL',
            on_click=lambda e: restart_all_services(),
            style=ft.ButtonStyle(bgcolor='transparent', color=COLORS['amber'], padding=10),
        ),
        ft.TextButton(
            'STOP ALL',
            on_click=lambda e: stop_all_services(),
            style=ft.ButtonStyle(bgcolor='transparent', color=COLORS['red'], padding=10),
        ),
    ], spacing=8)
    
    return ft.Container(
        content=ft.Column([
            console_header,
            ft.Container(content=main_console, border_radius=8, padding=5, expand=True),
            ft.Container(height=10),
            btn_row,
        ], expand=True),
        padding=20,
        expand=True,
    )

def get_cmd(name):
    for n, cmd, cwd in services_config:
        if n == name:
            return cmd, cwd
    return '', BASE_DIR

def start_all_services():
    for name, cmd, cwd in services_config:
        manager.start(name, cmd, cwd)
    update_sidebar()
    update_console()

def restart_all_services():
    for name, cmd, cwd in services_config:
        manager.restart(name, cmd, cwd)
    update_sidebar()
    update_console()

def stop_all_services():
    for name, cmd, cwd in services_config:
        manager.stop(name)
    update_sidebar()
    update_console()

def on_start_click(e, name):
    result = get_cmd(name)
    manager.start(name, result[0], result[1])
    update_sidebar()
    update_console()

def on_restart_click(e, name):
    result = get_cmd(name)
    manager.restart(name, result[0], result[1])
    update_sidebar()
    update_console()

def on_stop_click(e, name):
    manager.stop(name)
    update_sidebar()
    update_console()

def create_status_bar():
    global status_bar
    status_bar = ft.Container(
        content=ft.Row([
            ft.Text('Ready', size=10, color=COLORS['gray']),
            ft.Container(expand=True),
            ft.Text(f'Active: {sum(1 for n in ["Detection", "API", "Frontend"] if manager.is_running(n))}/3', size=10, color=COLORS['gray']),
        ]),
        padding=ft.Padding(10, 15, 10, 15),
        bgcolor=COLORS['sidebar'],
        border=ft.Border.only(top=ft.BorderSide(1, COLORS['border'])),
        height=35,
    )
    return status_bar

def bg_update():
    while True:
        try:
            update_sidebar()
            update_console()
            if status_bar:
                status_bar.content.controls[2].value = f'Active: {sum(1 for n in ["Detection", "API", "Frontend"] if manager.is_running(n))}/3'
            import time
            time.sleep(1)
        except:
            break

def main(page: ft.Page):
    page.title = 'SecurePass Control Panel'
    page.theme_mode = ft.ThemeMode.DARK
    page.window_width = 900
    page.window_height = 700
    page.padding = 0
    page.bgcolor = COLORS['bg']
    
    sidebar = create_sidebar()
    header = create_header()
    main_area = create_main_area()
    create_status_bar()
    
    page.add(
        ft.Column([
            header,
            ft.Row([
                sidebar,
                main_area,
            ], expand=True, spacing=0),
            status_bar,
        ], spacing=0)
    )
    
    threading.Thread(target=bg_update, daemon=True).start()

if __name__ == '__main__':
    ft.run(main)
