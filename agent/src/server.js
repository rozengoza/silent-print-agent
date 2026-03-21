const WebSocket = require("ws");
const {
  getAllowedOrigins,
  addOrigin,
  removeOrigin,
} = require("./config/configManager");

const PORT = 8282;
let wss = null;
let onPrintRequest = null;

const startServer = (printCallback) => {
  onPrintRequest = printCallback;
  wss = new WebSocket.Server({ port: PORT });

  wss.on("listening", () => {
    console.log(`Silent Print Agent running on ws://localhost:${PORT}`);
  });

  wss.on("connection", (ws, req) => {
    const allowedOrigins = getAllowedOrigins();
    const origin = req.headers.origin;

    // Security — block unknown origins
    if (!allowedOrigins.includes(origin)) {
      console.warn(`Blocked connection from origin that is not allowed: ${origin}`);
      ws.close(1008, "Origin not allowed");
      return;
    }

    console.log(`Connected from: ${origin}`);

    ws.on("message", async (message) => {
      try {
        const job = JSON.parse(message);

        // Register origin via WebSocket (SDK's registerOrigin())
        if (job.type === "registerOrigin" && job.origin) {
          const cleaned = job.origin.trim().replace(/\/+$/, "");
          addOrigin(cleaned);
          console.log(`Origin registered via WebSocket: ${cleaned}`);
          ws.send(JSON.stringify({
            success: true,
            type: "originRegistered",
            origin: cleaned,
          }));
          return;
        }

        // Remove origin via WebSocket (SDK's removeOrigin())
        if (job.type === "removeOrigin" && job.origin) {
          const cleaned = job.origin.trim().replace(/\/+$/, "");
          removeOrigin(cleaned);
          console.log(`Origin removed via WebSocket: ${cleaned}`);
          ws.send(JSON.stringify({
            success: true,
            type: "originRemoved",
            origin: cleaned,
          }));
          return;
        }

        // Get printers (SDK's getAvailablePrinters())
        if (job.type === "getPrinters") {
          const result = await onPrintRequest(job);
          ws.send(JSON.stringify({
            success: true,
            printers: result?.printers || [],
          }));
          return;
        }

        // Validate print job structure
        if (!job.html) {
          ws.send(JSON.stringify({
            success: false,
            error: "No HTML content provided",
          }));
          return;
        }

        // Pass to print engine
        console.log(`Print job received - printer: ${job.options?.printer || "default"}`);
        const result = await onPrintRequest(job);
        ws.send(JSON.stringify({
          success: true,
          message: result || "Print job completed successfully",
        }));

      } catch (err) {
        console.error("Error processing print job:", err);
        ws.send(JSON.stringify({
          success: false,
          error: err.message || "Failed to process print job",
        }));
      }
    });

    ws.on("close", () => {
      console.log(`Connection closed from: ${origin}`);
    });

    ws.on("error", (err) => {
      console.error(`WebSocket error from ${origin}:`, err);
    });

    // ✅ Send agent info on connect (SDK's getAgentInfo() reads this)
    ws.send(JSON.stringify({
      type: "connected",
      agent: "Silent Print Agent",
      version: "1.0.0",
    }));
  });

  wss.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use. Is the Silent Print Agent already running?`);
    }
  });
};

const stopServer = () => {
  if (wss) {
    wss.close();
    wss = null;
  }
};

module.exports = {
  startServer,
  stopServer,
  PORT,
};
