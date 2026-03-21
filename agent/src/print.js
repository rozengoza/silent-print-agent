const { BrowserWindow } = require('electron');
const path = require('path');

const silentPrint = (job) => {
    return new Promise((resolve, reject) => {
        const { html, options =  {} } = job;

        // Create a completely hidden browser window
        const win = new BrowserWindow({
            show: false,
            skipTaskbar: true,
            // For MacOS, to prevent dock icon flash
            ...BrowserWindow(process.platform === "darwin" && {
                type: "panel",
            }),
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                javascript: true,
            },
        });

        // Prevent any new windows from opening
        win.webContents.setWindowOpenHandler(() => {
            return { action: 'deny' };
        });

        // Determine page size 
        const pageSize = resolvePageSize(options.pageSize || "A4");

        // Load your invoice HTML
        win.loadURL(
            `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
        );

        // Wait for content to fully render before printing
        win.webContents.on('did-finish-load', () => {
            // Small delay to allow fonts/images to render
            setTimeout(() => {
                win.webContents.print({
                    silent: true,
                    printBackground: true,
                    deviceName: options.printer || '',
                    pageSize: pageSize,
                    copies: options.copies || 1,
                    landscape: options.landscape || false,
                    margins: {
                        marginType: options.margins || "default",
                    }
            }, (success, failureReason) => {
                // Always destroy window after printing
                win.destroy();

                if (success) {
                    console.log("Print job completed successfully");
                    resolve({ success: true});
                } else {
                    console.error("Print job failed:", failureReason);
                    reject(new Error(failureReason || "Unknown print error"));
                }
            });
            }, 500);
    });

    // Handle load errors
    win.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
        win.destroy();
        reject(new Error(`Failed to load content: ${errorDescription} (Code: ${errorCode})`));
    });
});
}

// Resolve page size for different print types
const resolvePageSize = (size) => {
    const sizes = {
        // Standard paper sizes
        "A4": "A4",
        "A5": "A5",
        // Thermal receipt sizes (in microns)
        "thermal80": {
          width: 80000,   // 80mm
          height: 297000, // auto scroll
        },
        "thermal58": {
          width: 58000,   // 58mm
          height: 297000,
        },
    
        // Label printing
        "label": {
          width: 100000,  // 100mm
          height: 150000, // 150mm
        },
    };
    return sizes[size] || "A4"; // Default to A4 if unknown
};

// Get list of available printers on the machine
const getAvailablePrinters = async () => {
    try {
        const printers = await mainWindow.webContents.getPrintersAsync();
        return printers.map((p) => ({
            name: p.name,
        isDefault: p.isDefault,
        status: p.status,
        }));
    } catch (err) {
        console.error("Failed to get printers:", err);
        return [];
    }
};

module.exports = { silentPrint, getAvailablePrinters };