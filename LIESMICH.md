# Kundenkarten – Offline-App fürs iPhone

Eine Web-App (PWA), die nach der Installation komplett offline läuft.
Alle Karten und Bilder bleiben lokal auf dem iPhone (IndexedDB). Es gibt keinen Server und kein Konto.

## Installation (einmalig)
1. Den Ordner auf einen beliebigen HTTPS-Webspace laden, zum Beispiel:
   - **Netlify Drop**: https://app.netlify.com/drop öffnen und den Ordner `kundenkarten` hineinziehen
   - oder **GitHub Pages** bzw. einen eigenen Webspace
2. Die Adresse auf dem iPhone in **Safari** öffnen.
3. Teilen → **Zum Home-Bildschirm**.
4. Die App einmal mit Internet öffnen und ca. 10 Sekunden warten. Danach ist sie auch offline bereit
   (das Menü ⋯ zeigt «Offline: bereit ✓»).

## Funktionen
- Vorder- und Rückseite fotografieren, zuschneiden und drehen
- Barcode und QR-Code werden automatisch erkannt (EAN, Code 128/39, ITF, QR, Aztec, Data Matrix …)
- Die Texterkennung füllt Nummer, Inhaber und «Gültig bis» aus und erkennt die Vorlage (zum Beispiel Cumulus oder Supercard)
- 33 Schweizer Vorlagen, eigene Karten, alles auch manuell erfassbar
- Katalog-Sujets: Jede Karte wird als Kartenbild mit deinen persönlichen Angaben (Nummer, Name, Gültigkeit, Barcode) dargestellt.
  Pro Anbieter lässt sich ein echtes Kartenbild hinterlegen (Menü ⋯ → Katalog & Sujets). Alternativ zeigt die App deine eigenen Fotos.
- Bewertung mit 1–5 Sternen: Favoriten stehen oben
- «Oben fixieren»: Karten an fester Position, Reihenfolge über ⇅ anpassen
- Zusatzfelder (PIN, Kundennummer …) und Notizen
- Detailansicht: Karte durch Wischen oder Tippen umdrehen, Code antippen für das Vollbild an der Kasse
- Backup als JSON-Datei exportieren und importieren (Menü ⋯)

## Hinweis
Die Daten der Home-Bildschirm-App sind von Safari getrennt. Wer die App löscht, löscht auch die Karten.
Deshalb gelegentlich ein Backup in «Dateien» oder in iCloud Drive sichern.
