# Docket

A receipt-printer to-do list for your desktop. Type your items, hit Print, watch the receipt feed out, tear it off, and a floating ticket appears on your screen. Tickets persist across sessions and can be checked off item by item.

---

## How it works

Docket runs as a frameless, transparent Electron window styled to look like a thermal receipt printer. When you submit a print job, an animated receipt emerges from the paper slot. You tear it off by clicking and dragging, which closes the print preview and spawns a draggable ticket window that stays on top of your other applications. Tickets are saved to disk and restored automatically on next launch.

---

## Features

- Retro and pixel art themes, toggled from the printer UI
- Selectable paper roll color applied to printed tickets
- Optional title and up to several line items per ticket
- Receipt feed animation with tear gesture
- Tickets float above all other windows and can be repositioned anywhere on screen
- Check off items directly on the ticket; completed items are struck through
- All tickets persist between sessions via local storage

---

## Getting started

**Prerequisites**

- Node.js 18 or later
- npm

**Install**

```bash
npm install
```

**Run in development**

```bash
npm run dev
```

This opens the app with DevTools detached for the printer window.

**Run normally**

```bash
npm start
```

---

## Building for distribution

```bash
# Current platform
npm run build

# Specific platforms
npm run build:win
npm run build:mac
npm run build:linux
```

Output is written to the `dist/` directory. Targets are NSIS installer on Windows, DMG on macOS, and AppImage on Linux.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + Enter` | Submit print job |
| `Enter` (in item field) | Add next item |

---

## Tech stack

- [Electron](https://www.electronjs.org/) - desktop shell
- [GSAP](https://gsap.com/) - receipt feed and tear animations
- [electron-store](https://github.com/sindresorhus/electron-store) - persistent ticket storage
- [canvas-confetti](https://github.com/catdad/canvas-confetti) - tear celebration effect
