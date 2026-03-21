const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const { app } = require("electron");

// Config file lives outside asar - in userData (writable)
const getConfigPath = () => {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "origins.json");
};

// Default origins bunded with the app
const getDefaultConfig = () => {
  const defaultPath = app.isPackaged
    ? path.join(process.resourcesPath, "origins.json")
    : path.join(__dirname, "origins.json");

  try {
    return JSON.parse(fs.readFileSync(defaultPath, "utf-8"));
  } catch {
    return { allowedOrigins: [] };
  }
};

// Load config - useData takes priority over bundled defaults
const loadConfig = () => {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const userConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      console.log("Loaded config from userData:", configPath);
      return userConfig;
    }
  } catch (err) {
    console.error("Error loading user config, falling back to defaults:", err);
  }

  // Fall back to bundled defaults
  const defaultConfig = getDefaultConfig();
  console.log("Using bundled default config");
  return defaultConfig;
};

// Save config to userData (persists across updates)
const saveConfig = (config) => {
  const configPath = getConfigPath();
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    console.log("Config saved to:", configPath);
  } catch (err) {
    console.error("Error saving config:", err);
    return false;
  }
};

// Add a new origin at runtime
const addOrigin = (origin) => {
  const config = loadConfig();
  if (!config.allowedOrigins.includes(origin)) {
    config.allowedOrigins.push(origin);
    saveConfig(config);
    console.log(`Origin added: ${origin}`);
  }
  return config;
};

// Remove an origin
const removeOrigin = (origin) => {
  const config = loadConfig();
  config.allowedOrigins = config.allowedOrigins.filter((o) => o !== origin);
  saveConfig(config);
  console.log(`Origin removed: ${origin}`);
  return config;
};

// Get just the origins array
const getAllowedOrigins = () => {
  return loadConfig().allowedOrigins || [];
};

// Hash password - never store plain text
const hashPassword = (password) => {
  return crypto
    .createHash("sha256")
    .update(password + "silent-print-agent-salt-2026")
    .digest("hex");
};

// Default admin password - change on first setup
const DEFAULT_ADMIN_PASSWORD = hashPassword("admin@1234");

const verifyAdminPassword = (inputPassword) => {
  const config = loadConfig();
  const storedHash = config.adminPasswordHash || DEFAULT_ADMIN_PASSWORD;
  return hashPassword(inputPassword) === storedHash;
};

const setAdminPassword = (newPassword) => {
  const config = loadConfig();
  config.adminPasswordHash = hashPassword(newPassword);
  saveConfig(config);
};

module.exports = {
  loadConfig,
  saveConfig,
  addOrigin,
  removeOrigin,
  getAllowedOrigins,
  verifyAdminPassword,
  setAdminPassword,
};
