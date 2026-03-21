# silent-print-agent

**silent-print-agent** is a free, open source local print agent that enables silent, dialog-free printing from any web application. It runs quietly in the system tray, receives print jobs from your browser via WebSocket, and sends them directly to any connected printer — no dialogs, no previews, no extra steps.

Built on Electron. Works with any web stack — React, Vue, Angular, plain HTML, or anything that runs in a browser.

---

## Why This Exists

Web browsers are built to ask before they print. Every time a user clicks print from a website, the browser opens a preview dialog and waits for confirmation. For occasional use that is fine. For billing environments, POS terminals, and high-volume invoice workflows, that friction adds up fast.

silent-print-agent sits between the browser and the printer and removes that step entirely. The web app sends a print job, the agent receives it, and the printer gets it — without the browser ever showing a dialog.

---

## How It Works

```
┌────────────────────────────────────────────────────────┐
│                    User Machine                        │
│                                                        │
│   ┌─────────────────────────┐                         │
│   │   Browser (any)         │                         │
│   │   yourapp.com           │                         │
│   │                         │                         │
│   │   User clicks Print     │                         │
│   │          │              │                         │
│   │          ▼              │                         │
│   │   HTML built from       │                         │
│   │   your template         │                         │
│   │          │              │                         │
│   │          ▼              │                         │
│   │   WebSocket message ────┼──────────┐              │
│   │   ws://localhost:8282   │          │              │
│   └─────────────────────────┘          │              │
│                                        ▼              │
│                           ┌────────────────────────┐  │
│                           │      silent-print-agent       │  │
│                           │   (system tray)        │  │
│                           │                        │  │
│                           │   WebSocket Server     │  │
│                           │   ↓                    │  │
│                           │   Origin validation    │  │
│                           │   ↓                    │  │
│                           │   HTML renderer        │  │
│                           │   (hidden window)      │  │
│                           │   ↓                    │  │
│                           │   Silent print         │  │
│                           │   silent: true         │  │
│                           └──────────┬─────────────┘  │
│                                      │                │
│                           ┌──────────▼─────────────┐  │
│                           │       Printer          │  │
│                           │  A4  Thermal  Label    │  │
│                           └────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Step by step

1. The user clicks Print inside your web application
2. Your frontend builds the document HTML from your template
3. The app sends that HTML over a WebSocket connection to `ws://localhost:8282`
4. The agent receives the message and validates the origin against your configured allowlist
5. A hidden Electron browser window loads the HTML and renders it exactly as Chrome would
6. The agent calls `webContents.print({ silent: true })` which sends the job directly to the printer
7. The hidden window is destroyed and a success response is sent back to the web app
8. The printer receives the job — no dialog was shown at any point

---

## Features

- Silent printing with no browser dialogs or print previews
- Works in Chrome, Firefox, Brave, Edge, and any other browser
- Supports all printer types connected to the machine
- A4, A5, Letter, and Legal paper sizes
- Thermal receipt printing at 58mm and 80mm widths
- Label printing with custom dimensions
- Specific printer targeting or automatic default printer selection
- Multiple copies support
- Landscape and portrait orientation
- Origin-based security — only accepts jobs from domains you configure
- Automatic fallback to normal browser printing if agent is not running
- Runs silently in the system tray with no visible window
- Auto starts on login
- Single instance enforcement — one agent per machine
- Admin-protected origin management via tray menu
- Multi-tenant support — add origins at runtime without restarting

---

## Project Structure

```
silent-print-agent/
├── src/
│   ├── main.js              Entry point — initializes app, tray, and server
│   ├── server.js            WebSocket server — receives print jobs from browser
│   ├── print.js             Silent print engine — renders HTML and prints
│   ├── tray.js              System tray icon and context menu
│   ├── config/
│   │   ├── configManager.js Config read/write with userData persistence
│   │   └── origins.json     Default allowed origins (bundled with app)
│   └── assets/
│       ├── icon.png         Tray icon
│       └── icon.ico         Windows installer icon
├── dist/                    Generated installers (after build)
└── package.json
```

### Module responsibilities

**main.js**
Bootstraps the Electron application. Creates the hidden main window, registers the login item for auto start, initializes the system tray, and starts the WebSocket server. Enforces single instance so only one agent runs per machine.

**server.js**
Opens a WebSocket server on the configured port (default 8282). Validates the origin of every incoming connection against a configurable allowlist. Parses incoming print job messages and passes them to the print engine. Sends success or failure responses back to the browser.

**print.js**
Creates a hidden, off-screen Electron browser window for each print job. Loads the document HTML into the window and waits for it to fully render. Calls Electron's native print API with `silent: true` to dispatch the job directly to the printer without any dialog. Destroys the window when the job completes.

**tray.js**
Creates and manages the system tray icon. Builds the right-click context menu with agent status, origin management, restart, and quit options. Resolves the icon path correctly for both development and packaged environments using `extraResources`. Admin-protected actions require a password to access.

**configManager.js**
Manages reading and writing the origins config. Bundled defaults ship inside the installer. User-added origins are saved to the OS `userData` directory and persist across app updates. Both lists are merged at runtime.

---

## Supported Print Types

| Type | Page Size Setting | Dimensions |
|---|---|---|
| A4 Invoice | `A4` | 210 × 297 mm |
| A5 Invoice | `A5` | 148 × 210 mm |
| US Letter | `Letter` | 216 × 279 mm |
| Legal | `Legal` | 216 × 356 mm |
| Thermal 80mm | `thermal80` | 80mm width |
| Thermal 58mm | `thermal58` | 58mm width |
| Label | `label` | 100 × 150 mm |
| Custom | `{ width, height }` | any size in microns |

---

## Security

The agent only accepts WebSocket connections from explicitly allowed origins. Any connection from an unknown origin is immediately closed.

```json
{
  "allowedOrigins": [
    "http://localhost:3000"
    "https://yourapp.com",
  ]
}
```

Origins are configurable via the tray menu (admin password protected) or by editing `origins.json` directly. Even if another application on the same machine connects to port 8282, it will be rejected unless its origin matches the allowlist.

---

## Configuration

On first run, silent-print-agent reads from the bundled `origins.json`. Any changes made via the tray menu are saved to the OS user data directory and persist across updates:

```
Windows: C:\Users\USERNAME\AppData\Roaming\silent-print-agent\origins.json
Mac:     ~/Library/Application Support/silent-print-agent/origins.json
```

The default admin password for origin management is `admin@1234`. Change it via the tray menu after installation.

---

## Installation

Download the latest installer for your platform from the [Releases](https://github.com/rozengoza/silent-print-agent/releases) page:

| Platform | File |
|---|---|
| Windows 10/11 | `silent-print-agent-setup-x.x.x.exe` |
| macOS Intel | `silent-print-agent-x.x.x.dmg` |
| macOS Apple Silicon | `silent-print-agent-x.x.x-arm64.dmg` |
| Linux | `silent-print-agent-x.x.x.AppImage` |

1. Run the installer
2. Follow the prompts (one click on Windows)
3. A silent-print-agent icon appears in your system tray
4. Configure your allowed origins via the tray menu
5. Integrate with your web app using the snippet below

The agent starts automatically every time your computer boots. You do not need to launch it manually.

---

## Web App Integration

Add this utility to your frontend. No backend changes required.

```typescript
const AGENT_URL = "ws://localhost:8282";
const CONNECTION_TIMEOUT = 3000;

// Check if silent-print-agent is running
export const isAgentAvailable = (): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(AGENT_URL);
      const timeout = setTimeout(() => { ws.close(); resolve(false); }, CONNECTION_TIMEOUT);
      ws.onopen = () => { clearTimeout(timeout); ws.close(); resolve(true); };
      ws.onerror = () => { clearTimeout(timeout); resolve(false); };
    } catch { resolve(false); }
  });
};

// Send a print job
export const printWithAgent = (
  html: string,
  options: {
    printer?: string;
    pageSize?: string;
    copies?: number;
    landscape?: boolean;
  } = {}
): Promise<{ success: boolean }> => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(AGENT_URL);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Timed out"));
    }, CONNECTION_TIMEOUT);

    ws.onopen = () => ws.send(JSON.stringify({ html, options }));

    ws.onmessage = (event) => {
      clearTimeout(timeout);
      const response = JSON.parse(event.data);
      if (response.type === "connected") return;
      ws.close();
      response.success
        ? resolve({ success: true })
        : reject(new Error(response.error));
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Agent not available"));
    };
  });
};
```

Usage:

```typescript
const agentRunning = await isAgentAvailable();

if (agentRunning) {
  await printWithAgent(html, { pageSize: "A4", copies: 1 });
} else {
  // fallback to window.print() or show a download prompt
  window.print();
}
```

---

## Development

### Prerequisites

- Node.js v18 or later
- npm

### Setup

```bash
git clone https://github.com/rozengoza/silent-print-agent.git
cd silent-print-agent
npm install
```

### Run in development

```bash
npm start
```

The agent starts with the WebSocket server on `ws://localhost:8282` and a tray icon appears in your taskbar.

### Build installers

```bash
# Windows
npm run build:win

# Mac
npm run build:mac

# Linux
npm run build:linux
```

Output is placed in the `dist/` directory.

---

## Platform Support

| Platform | Status |
|---|---|
| Windows 10 / 11 | ✅ Supported |
| macOS Intel | ✅ Supported |
| macOS Apple Silicon (M1/M2/M3) | ✅ Supported |
---

## Built With

- [Electron](https://www.electronjs.org/) — cross-platform desktop framework
- [ws](https://github.com/websockets/ws) — lightweight WebSocket server

---

## Contributing

Contributions are welcome. Open an issue to discuss what you would like to change, or submit a pull request directly. All printer types, page sizes, and platform improvements are fair game.

---

## License

MIT — free for personal and commercial use.
