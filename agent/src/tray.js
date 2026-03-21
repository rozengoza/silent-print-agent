const { Tray, Menu, nativeImage, BrowserWindow, ipcMain } = require("electron");
const {
  addOrigin,
  getAllowedOrigins,
  removeOrigin,
  verifyAdminPassword,
} = require("./config/configManager");
const path = require("path");
const fs = require("fs");

let tray = null;
let _appInstance = null;

// Track pending action after auth
let pendingAction = null;

// Wrap origin management with password check
const openPasswordPrompt = (onSuccess) => {
  const win = new BrowserWindow({
    width: 380,
    height: 220,
    resizable: false,
    title: "Admin Access",
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.setMenu(null);

  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { box-sizing: border-box; font-family: system-ui, sans-serif; }
          body { margin: 0; padding: 24px; background: #fff; }
          h2 { font-size: 16px; margin: 0 0 6px; }
          p { font-size: 13px; color: #666; margin: 0 0 16px; }
          input {
            width: 100%; padding: 8px 12px;
            border: 1px solid #ddd; border-radius: 6px;
            font-size: 14px; margin-bottom: 6px; outline: none;
          }
          input:focus { border-color: #000; }
          .error { color: red; font-size: 12px; margin-bottom: 12px; display: none; }
          .buttons { display: flex; gap: 8px; justify-content: flex-end; }
          button {
            padding: 8px 20px; border-radius: 6px;
            font-size: 13px; cursor: pointer; border: none;
          }
          .cancel { background: #f1f1f1; color: #333; }
          .confirm { background: #000; color: #fff; }
        </style>
      </head>
      <body>
        <h2>🔒 Admin Access Required</h2>
        <p>Enter the admin password to manage origins.</p>
        <input
          id="password"
          type="password"
          placeholder="Enter admin password"
          autofocus
        />
        <p class="error" id="error">Incorrect password. Try again.</p>
        <div class="buttons">
          <button class="cancel" onclick="window.close()">Cancel</button>
          <button class="confirm" onclick="submit()">Confirm</button>
        </div>
        <script>
          const { ipcRenderer } = require("electron");

          document.getElementById("password").addEventListener("keydown", (e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") window.close();
          });

          function submit() {
            const password = document.getElementById("password").value;
            ipcRenderer.send("check-admin-password", password);
          }

          ipcRenderer.on("password-result", (event, success) => {
            if (success) {
              window.close();
            } else {
              document.getElementById("error").style.display = "block";
              document.getElementById("password").value = "";
              document.getElementById("password").focus();
            }
          });
        </script>
      </body>
      </html>
    `)}`
  );
};

ipcMain.on("check-admin-password", (event, password) => {
  const isValid = verifyAdminPassword(password);
  event.reply("password-result", isValid);

  if (isValid && pendingAction) {
    // Execute whatever was waiting
    pendingAction();
    pendingAction = null;
  }
});

// Register IPC handlers once - not inisde updateTray
ipcMain.on("add-origin", (event, origin) => {
  if (
    !origin ||
    (!origin.startsWith("http://") && !origin.startsWith("https://"))
  ) {
    console.warn(
      "Invalid origin format, must start with http:// or https://",
      origin,
    );
    return;
  }
  const cleaned = origin.trim().replace(/\/+$/, ""); // Remove trailing slashes
  addOrigin(cleaned);
  console.log(`Origin added via IPC: ${cleaned}`);
  updateTray(_appInstance, "running");
});

ipcMain.on("remove-origin", (event, origin) => {
  removeOrigin(origin);
  console.log(`Origin removed via IPC: ${origin}`);
  updateTray(_appInstance, "running");
});

// Add origin prompt window
const openAddOriginPrompt = () => {
  const win = new BrowserWindow({
    width: 460,
    height: 260,
    resizable: false,
    title: "Add Allowed Origin",
    skipTaskbar: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.setMenu(null); // Remove default menu

  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { box-sizing: border-box; font-family: system-ui, sans-serif; }
          body { margin: 0; padding: 24px; background: #fff; }
          h2 { font-size: 16px; margin: 0 0 6px; }
          p { font-size: 13px; color: #666; margin: 0 0 16px; }
          input {
            width: 100%; padding: 8px 12px;
            border: 1px solid #ddd; border-radius: 6px;
            font-size: 14px; margin-bottom: 6px; outline: none;
          }
          input:focus { border-color: #000; }
          .error {
            color: red; font-size: 12px;
            margin-bottom: 12px; display: none;
          }
          .buttons { display: flex; gap: 8px; justify-content: flex-end; }
          button {
            padding: 8px 20px; border-radius: 6px;
            font-size: 13px; cursor: pointer; border: none;
          }
          .cancel { background: #f1f1f1; color: #333; }
          .cancel:hover { background: #e5e5e5; }
          .add { background: #000; color: #fff; }
          .add:hover { background: #333; }
        </style>
      </head>
      <body>
        <h2>Add Allowed Origin</h2>
        <p>Enter the full URL of the domain to allow (e.g. https://client.com)</p>
        <input
          id="origin"
          type="text"
          placeholder="https://client.yourcompany.com"
          autofocus
        />
        <p class="error" id="error">
          Please enter a valid URL starting with http:// or https://
        </p>
        <div class="buttons">
          <button class="cancel" onclick="window.close()">Cancel</button>
          <button class="add" onclick="submit()">Add Origin</button>
        </div>
        <script>
          const { ipcRenderer } = require("electron");

          document.getElementById("origin").addEventListener("keydown", (e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") window.close();
          });

          function submit() {
            const origin = document.getElementById("origin").value.trim();
            const error = document.getElementById("error");

            if (!origin.startsWith("http://") && !origin.startsWith("https://")) {
              error.style.display = "block";
              return;
            }

            error.style.display = "none";
            ipcRenderer.send("add-origin", origin);
            window.close();
          }
        </script>
      </body>
      </html>
    `)}`,
  );
};

// Remove origin confirmation window
const openRemoveOriginPrompt = (origin) => {
  const win = new BrowserWindow({
    width: 420,
    height: 200,
    resizable: false,
    title: "Remove Allowed Origin",
    skipTaskbar: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.setMenu(null); // Remove default menu

  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { box-sizing: border-box; font-family: system-ui, sans-serif; }
          body { margin: 0; padding: 24px; background: #fff; }
          h2 { font-size: 16px; margin: 0 0 8px; }
          p { font-size: 13px; color: #666; margin: 0 0 6px; }
          .origin { font-size: 13px; color: #000; font-weight: 600; margin-bottom: 20px; word-break: break-all; }
          .buttons { display: flex; gap: 8px; justify-content: flex-end; }
          button {
            padding: 8px 20px; border-radius: 6px;
            font-size: 13px; cursor: pointer; border: none;
          }
          .cancel { background: #f1f1f1; color: #333; }
          .cancel:hover { background: #e5e5e5; }
          .remove { background: #dc2626; color: #fff; }
          .remove:hover { background: #b91c1c; }
        </style>
      </head>
      <body>
        <h2>Remove Origin</h2>
        <p>Are you sure you want to remove this origin?</p>
        <p class="origin">${origin}</p>
        <div class="buttons">
          <button class="cancel" onclick="window.close()">Cancel</button>
          <button class="remove" onclick="remove()">Remove</button>
        </div>
        <script>
          const { ipcRenderer } = require("electron");

          document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") window.close();
            if (e.key === "Enter") remove();
          });

          function remove() {
            ipcRenderer.send("remove-origin", "${origin}");
            window.close();
          }
        </script>
      </body>
      </html>
    `)}`
  );
};

const openManageOriginsWindow = () => {
  const currentOrigins = getAllowedOrigins();

  const win = new BrowserWindow({
    width: 500,
    height: 400,
    resizable: true,
    title: "Manage Allowed Origins",
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.setMenu(null);

  const originsHTML = currentOrigins.map((origin) => `
    <div class="origin-row">
      <span class="origin-url">${origin}</span>
      <button class="remove-btn" onclick="removeOrigin('${origin}')">Remove</button>
    </div>
  `).join("");

  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { box-sizing: border-box; font-family: system-ui, sans-serif; }
          body { margin: 0; padding: 24px; background: #fff; }
          h2 { font-size: 16px; margin: 0 0 4px; }
          p { font-size: 13px; color: #666; margin: 0 0 16px; }
          .origin-row {
            display: flex; align-items: center;
            justify-content: space-between;
            padding: 10px 12px; border: 1px solid #eee;
            border-radius: 6px; margin-bottom: 8px;
          }
          .origin-url { font-size: 13px; word-break: break-all; flex: 1; }
          .remove-btn {
            background: #dc2626; color: #fff;
            border: none; border-radius: 4px;
            padding: 4px 12px; font-size: 12px;
            cursor: pointer; margin-left: 12px;
            flex-shrink: 0;
          }
          .remove-btn:hover { background: #b91c1c; }
          .add-btn {
            width: 100%; padding: 10px;
            background: #000; color: #fff;
            border: none; border-radius: 6px;
            font-size: 13px; cursor: pointer; margin-top: 8px;
          }
          .add-btn:hover { background: #333; }
          .empty { color: #999; font-size: 13px; text-align: center; padding: 20px; }
        </style>
      </head>
      <body>
        <h2>Manage Allowed Origins</h2>
        <p>These domains are allowed to send print jobs to this agent.</p>

        <div id="origins-list">
          ${currentOrigins.length > 0 ? originsHTML : '<p class="empty">No origins configured.</p>'}
        </div>

        <button class="add-btn" onclick="addNew()">+ Add New Origin</button>

        <script>
          const { ipcRenderer } = require("electron");

          function removeOrigin(origin) {
            if (confirm("Remove " + origin + "?")) {
              ipcRenderer.send("remove-origin", origin);
              window.close();
            }
          }

          function addNew() {
            ipcRenderer.send("open-add-origin");
            window.close();
          }
        </script>
      </body>
      </html>
    `)}`
  );
};

// Handle open add origin from manage window
ipcMain.on("open-add-origin", () => {
  openAddOriginPrompt();
});

const createTray = (appInstance, status = "running") => {
  // Try multiple possible paths
  _appInstance = appInstance; // Store reference for later use in updateTray

  const possiblePaths = [
    path.join(process.resourcesPath, "icon.png"),
    path.join(process.resourcesPath, "app", "src", "assets", "icon.png"),
    path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      "src",
      "assets",
      "icon.png",
    ),
    path.join(__dirname, "assets", "icon.png"),
  ];

  let iconPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      iconPath = p;
      console.log("Found icon at:", p);
      break;
    }
  }
  if (!iconPath) {
    console.error("Icon not found in any path:");
    possiblePaths.forEach((p) => console.error(" -", p));
    const { nativeImage } = require("electron");
    const size = 16;
    const buffer = Buffer.alloc(size * size * 4);
    // Fill with blue color if icon is missing
    for (let i = 0; i < size * size; i++) {
      buffer[i * 4] = 0;
      buffer[i * 4 + 1] = 120;
      buffer[i * 4 + 2] = 255;
      buffer[i * 4 + 3] = 255;
    }
    const fallbackIcon = nativeImage.createFromBuffer(buffer, {
      width: size,
      height: size,
    });
    tray = new Tray(fallbackIcon);
  } else {
    const icon = nativeImage.createFromPath(iconPath).resize({
      width: 16,
      height: 16,
    });

    // For MacOS, mark as template image for dark/light mode support
    if (process.platform === "darwin") {
      icon.setTemplateImage(true);
    }
    tray = new Tray(icon);
  }

  updateTray(appInstance, status);
  return tray;
};

const updateTray = (appInstance, status = "running") => {
  if (!tray) return;

  // Status indicator in tooltip
  const statusLabel =
    status === "running" ? "Running" : status === "error" ? "Error" : "Stopped";

  tray.setToolTip(`Silent Print Agent\n${statusLabel}`);

  const currentOrigins = getAllowedOrigins();

  const originsSubMenu = currentOrigins.length > 0
  ? currentOrigins.map((origin) => ({
      label: origin,
      submenu: [
        {
          label: "Remove Origin",
          click: () => {
            pendingAction = () => openRemoveOriginPrompt(origin);
            openPasswordPrompt();
          },
        },
      ],
        }))
  : [{ label: "No allowed origins configured", enabled: false }];

  const contextMenu = Menu.buildFromTemplate([
    // Header - not clickable
    {
      label: "Silent Print Agent v1.0.0",
      enabled: false,
    },
    {
      label: `Status: ${statusLabel}`,
      enabled: false,
    },
    { type: "separator" },

    // Origin management ** Password required to add
    {
      label: "Add Allowed Origin",
      click: () => {
        pendingAction = () => openAddOriginPrompt();
        openPasswordPrompt();
      },
    },
    {
      label: `Manage Origins (Admin)`,
      // submenu: originsSubMenu,
      click: () => {
        pendingAction = () => openManageOriginsWindow();
        openPasswordPrompt();
      },
    },

    { type: "separator" },

    // Show recent print jobs
    {
      label: "Recent Print Jobs",
      enabled: false, // will enable in future
    },
    { type: "separator" },

    // Restart agent
    {
      label: "Restart Agent",
      click: () => {
        appInstance.relaunch();
        appInstance.exit(0);
      },
    },

    { type: "separator" },

    // Quit
    {
      label: "Quit Silent Print Agent",
      click: () => {
        appInstance.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
};

const destroyTray = () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
};

module.exports = {
  createTray,
  updateTray,
  destroyTray,
};
