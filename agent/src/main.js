const { app, BrowserWindow } = require('electron');
const { createTray, updateTray } = require('./tray');
const { startServer, stopServer } = require('./server');
const { silentPrint, getAvailablePrinters } = require('./print');
const path = require("path");

/** 
    *Disable GPU process — not needed for a print agent
    * These are the default behavior of electron 
*/ 

app.disableHardwareAcceleration();

app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-software-rasterizer");
app.commandLine.appendSwitch("disable-gpu-compositing");

// Hide from dock on Mac 
if (process.platform === 'darwin') {
    app.dock.hide();
}

// Prevent multiple instances of the agent
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.exit(0); // already running, exit this instance
    process.exit(0); //kill the process immediately
}

let tray = null; 
let mainWindow = null;

app.whenReady().then(async () => {
    // Create a hidden main window
    mainWindow = new BrowserWindow({
        show: false,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Auto start with Windows on login
    // Only set in packaged app, not in development mode
    if (app.isPackaged) {
        app.setLoginItemSettings({
            openAtLogin: true,
            openAsHidden: true,
        });
    }

    // Create system tray
    tray = createTray(app, "running");

    // Start WebSocket server
    // Pass silentPrint as the callback
    startServer(async (job) => {
        // Handle printer list request
        if (job.type === "getPrinters") {
            const printers = await getAvailablePrinters(mainWindow);
            return { printers };
        }
        // Handle print job
        return await silentPrint(job);
    });

    console.log("Silent Print Agent started successfully");
});

// Prevent app from  closing when all windows are closed
// Agent should keep running in tray
app.on("window-all-closed", (e) => {
    e.preventDefault();
});

app.on("before-quit", () => {
    stopServer();
});
