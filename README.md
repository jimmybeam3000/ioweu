# IoweU Offline PWA Slim

Schlanke Offline-PWA für Android/iOS: lokale Datenhaltung im Browser, User-ID, Freunde, Schulden, Gegenstände, Gruppenausgaben, Export/Import per Text/Datei/QR-Text.

## Start lokal

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app:app --host 0.0.0.0 --port 8000
```

Dann am Handy öffnen: `http://RECHNER-IP:8000`

## Installation am Handy

Android Chrome: Menü → Zum Startbildschirm hinzufügen.

iPhone Safari: Teilen → Zum Home-Bildschirm.

## Datenaustausch ohne Server

- Profil/Freund/Transaktion exportieren
- Text kopieren oder `.ioweu` Datei laden/speichern
- per WhatsApp/SMS/AirDrop/Mail senden
- Empfänger importiert den Text oder die Datei

QR ist absichtlich textbasiert vorbereitet: Export-Text kann mit jedem QR-Generator geteilt oder später direkt in der App als QR angezeigt werden.
