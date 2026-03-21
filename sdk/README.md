# silent-print-agent

A free, open source browser SDK that connects your web application to the [Silent Print Agent](https://github.com/rozengoza/silent-print-agent) desktop app for silent, dialog-free printing via WebSocket.

## How It Works
```
Your Web App → WebSocket → Silent Print Agent (desktop) → Printer
```

No print dialogs. No browser previews. Works in Chrome, Firefox, Brave, Edge.

---

## Requirements

The **Silent Print Agent** desktop app must be installed on the user's machine.

Download from [GitHub Releases](https://github.com/rozengoza/silent-print-agent/releases):

| Platform | Download |
|---|---|
| Windows 10/11 | `.exe` installer |
| macOS Intel | `.dmg` |
| macOS Apple Silicon | `-arm64.dmg` |

---

## Installation
```bash
npm install silent-print-agent
```

---

## Usage
```typescript
import {
  isAgentAvailable,
  printWithAgent,
  getAvailablePrinters,
  getAgentInfo,
  registerOrigin,
} from "silent-print-agent";

// Check if desktop agent is running
const running = await isAgentAvailable();

// Silent print
await printWithAgent(html, { pageSize: "A4" });

// Get available printers
const printers = await getAvailablePrinters();

// Get agent version info
const info = await getAgentInfo();

// Register current domain (multi-tenant)
await registerOrigin();
```

---

## Print Options
```typescript
await printWithAgent(html, {
  pageSize: "A4",        // A4 | A5 | Letter | Legal | thermal80 | thermal58 | label
  printer: "",           // "" = default printer, or specify printer name
  copies: 1,
  landscape: false,
});
```

---

## Supported Page Sizes

| Size | Setting | Dimensions |
|---|---|---|
| A4 | `A4` | 210 × 297 mm |
| A5 | `A5` | 148 × 210 mm |
| Letter | `Letter` | 216 × 279 mm |
| Legal | `Legal` | 216 × 356 mm |
| Thermal 80mm | `thermal80` | 80mm width |
| Thermal 58mm | `thermal58` | 58mm width |
| Label | `label` | 100 × 150 mm |

---

## Fallback to window.print()
```typescript
const agentRunning = await isAgentAvailable();

if (agentRunning) {
  await printWithAgent(html, { pageSize: "A4" });
} else {
  // Agent not installed — fallback
  window.print();
  // Or show download prompt pointing to GitHub Releases
}
```

---

## TypeScript Support

Full TypeScript support included out of the box.
```typescript
import type { PrintOptions, PrintResult, AgentInfo } from "silent-print-agent";
```

---

## Links

- [GitHub Repository](https://github.com/rozengoza/silent-print-agent)
- [Download Desktop Agent](https://github.com/rozengoza/silent-print-agent/releases)
- [Report Issues](https://github.com/rozengoza/silent-print-agent/issues)

---

## License

MIT