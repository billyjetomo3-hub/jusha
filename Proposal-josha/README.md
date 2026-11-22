# Student Attendance Monitoring System

A modern, responsive, single-page attendance web app built with **vanilla HTML, CSS, and JavaScript** — no frameworks, no build step. Just open it in a browser.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)

## Getting started

Open `index.html` directly in any modern browser (double-click works — no server needed), or serve the folder:

```bash
npx serve .
# or: python -m http.server 8000
```

On first load the app seeds **16 sample students** and a partial attendance log for today so every module is immediately visible. Everything is stored in `localStorage`, so your data survives refreshes. To start over, clear the site data from your browser's developer tools.

## Features

- **Header & branding** — inline SVG school crest (no image files required), app title, and a real-time date/time clock ticking every second.
- **Dashboard cards** — Total Enrolled, Present Today, Absent Today, Late Today, each with a percentage or count sub-line.
- **Quick ID scanner** — type or scan a barcode/QR ID and press Enter to instantly mark the student Present with a timestamp, green/red field flash, and an audible beep (Web Audio API — toggleable, no audio files). Unknown IDs get an error tone and toast.
- **Manual search & mark** — modal that searches by ID, name, or section with one-click Present / Absent / Late buttons.
- **Add / edit students** — validated modal form: Student ID (unique), Full Name, Grade/Course/Section (with datalist suggestions), Gender, Email/Contact.
- **Attendance table** — Student ID, Full Name (with avatar initials), Section, Date & Time Logged, color-coded status badges (🟢 emerald Present, 🔴 rose Absent, 🟡 amber Late, dashed gray Not Marked), and row actions: Edit, Delete, and a Change Status dropdown.
- **Real-time filters** — text search plus Status and Section dropdowns; the toolbar, CSV export, and print report all operate on the filtered view.
- **Export & management** — Export CSV, Print Report (dedicated print stylesheet), Save Logs (JSON backup of every stored day), and Reset Today (with confirmation dialog).
- **Persistence** — students and per-day attendance logs in `localStorage`; attendance is keyed by date, so historical days are kept when the date rolls over.
- **Dark mode** — toggle in the header; respects `prefers-color-scheme` on first visit and remembers your choice.
- **Responsive** — 4-column cards → 2 → 1, stacked toolbar, and horizontally scrollable table on small screens.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure, all modals, print report markup |
| `logo.svg` | School crest logo (also used as the browser favicon) |
| `styles.css` | Design system (CSS variables), light/dark themes, print + responsive rules |
| `app.js` | State, localStorage, rendering, scanner, filters, export, event wiring |

## Keyboard & usage notes

- The scanner field is auto-focused on desktop, so a USB barcode scanner types straight into it.
- Press **Enter** in the scanner field to submit; **Esc** closes any open modal or menu.
- Sound can be muted with the speaker button next to the scanner title.

## External dependencies (CDN)

- [Inter font](https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap) — typography
- [Lucide icons](https://lucide.dev) via `unpkg.com/lucide` UMD bundle — all icon names used were verified against the current release

> An internet connection is needed the first time for fonts/icons; the app logic and data work fully offline.
>
