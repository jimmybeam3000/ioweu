# IoweU

Schlanke Offline-PWA für GitHub Pages. Keine Frameworks, keine Serverpflicht, nur statische Dateien in Root. Datenaustausch läuft ausschließlich über lokale `.iou` Dateien.

## Produktionsziel

- GitHub Pages kompatibel
- Mobile first
- Dark mode
- Offline per Service Worker
- Keine Daten im Link
- Import akzeptiert `.iou`, `.iou.txt` und `.txt`

## Nutzerfluss

### Verleiher

1. In `Verleihen` Geld oder Gegenstand wählen.
2. Empfängername eintragen.
3. Betrag oder Gegenstand erfassen.
4. Vorgangscode erzeugen.
5. `Exportieren & Versenden`.
6. `.iou` Datei lokal erzeugen.
7. Datei über WhatsApp, Signal, Telegram, Mail oder AirDrop senden.

### Empfänger

1. App über GitHub Pages öffnen.
2. Beim Erststart Namen eintragen.
3. Optional zum Startbildschirm hinzufügen.
4. Erhaltene `.iou` Datei importieren.
5. Vorgang prüfen.
6. Bestätigen oder ablehnen.
7. Antwort erneut als `.iou` exportieren und zurücksenden.

## Lokal testen

Statische Vorschau:

```bash
python3 -m http.server 8123
```

Dann im Browser öffnen:

```text
http://127.0.0.1:8123/
```

Reproduzierbarer Smoke-Test:

```bash
bash tests/smoke-static.sh
```

## Dateien

- `index.html`: statische GitHub-Pages-App
- `app.js`: kompletter Offline-Workflow und `.iou` Import/Export
- `style.css`: mobile-first Dark-UI
- `sw.js`: Cache für Root-Dateien
- `manifest.webmanifest`: PWA-Metadaten mit relativen Pfaden
