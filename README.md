# SecurePass - Quick Start

## Option 1: Using dep\ folder (Recommended)

### First Time Setup
```batch
install_deps.bat
```

Note: `face-recognition` requires CMake to build dlib. If installation fails:
- Install CMake: https://cmake.org/download/
- Add CMake to PATH (restart command prompt after)
- Or skip face-recognition and use global Python

### Run the Application
```batch
# Run Gate Controller
run_main.bat

# In another terminal, run Web API
r\run_api.bat

# Run React Frontend
cd r\frontend
npm install
npm run dev
```

## Option 2: Using Global Python

If you have all packages installed globally:
```batch
# Run Gate Controller
python main.py

# Run Web API (in r\ folder)
cd r
python -m uvicorn backend.api:app --host 0.0.0.0 --port 3000 --reload
```

## Access
- Frontend: http://localhost:5173
- API: http://localhost:3000
- API Docs: http://localhost:3000/docs

## Default Login
- Admin: admin / admin123
- User: user / user123
