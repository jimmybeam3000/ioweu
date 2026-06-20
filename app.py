from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

BASE = Path(__file__).resolve().parent
app = FastAPI(title='IoweU Offline PWA')
app.mount('/static', StaticFiles(directory=BASE / 'static'), name='static')

@app.get('/')
def index():
    return FileResponse(BASE / 'static' / 'index.html')

@app.get('/manifest.webmanifest')
def manifest():
    return FileResponse(BASE / 'static' / 'manifest.webmanifest', media_type='application/manifest+json')

@app.get('/sw.js')
def sw():
    return FileResponse(BASE / 'static' / 'sw.js', media_type='application/javascript')
