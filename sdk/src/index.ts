const AGENT_URL = "ws://localhost:8282";
const CONNECTION_TIMEOUT = 3000;

export interface PrintOptions {
  printer?: string;
  pageSize?: "A4" | "A5" | "Letter" | "Legal" | "thermal80" | "thermal58" | "label" | string;
  copies?: number;
  landscape?: boolean;
}

export interface PrintResult {
  success: boolean;
  error?: string;
}

export interface AgentInfo {
  agent: string;
  version: string;
}

// Check if the desktop agent is installed and running
export const isAgentAvailable = (): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(AGENT_URL);

      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, CONNECTION_TIMEOUT);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
};

// Get agent info (name and version)
export const getAgentInfo = (): Promise<AgentInfo | null> => {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(AGENT_URL);

      const timeout = setTimeout(() => {
        ws.close();
        resolve(null);
      }, CONNECTION_TIMEOUT);

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const response = JSON.parse(event.data);
        if (response.type === "connected") {
          ws.close();
          resolve({ agent: response.agent, version: response.version });
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
};

// Send HTML to the desktop agent for silent printing
export const printWithAgent = (
  html: string,
  options: PrintOptions = {}
): Promise<PrintResult> => {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(AGENT_URL);

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("Connection to print agent timed out"));
      }, CONNECTION_TIMEOUT);

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            html,
            options: {
              pageSize: options.pageSize || "A4",
              printer: options.printer || "",
              copies: options.copies || 1,
              landscape: options.landscape || false,
            },
          })
        );
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const response = JSON.parse(event.data);

        // Skip initial connection message
        if (response.type === "connected") return;

        ws.close();

        if (response.success) {
          resolve({ success: true });
        } else {
          reject(new Error(response.error || "Print failed"));
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Agent not available"));
      };

      ws.onclose = (event) => {
        if (event.code !== 1000) {
          clearTimeout(timeout);
          reject(new Error("Agent connection closed unexpectedly"));
        }
      };
    } catch {
      reject(new Error("WebSocket connection failed"));
    }
  });
};

// Get list of available printers from the agent
export const getAvailablePrinters = (): Promise<
  { name: string; isDefault: boolean }[]
> => {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(AGENT_URL);

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("Timed out getting printers"));
      }, CONNECTION_TIMEOUT);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "getPrinters" }));
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const response = JSON.parse(event.data);
        if (response.type === "connected") return;
        ws.close();
        resolve(response.printers || []);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Agent not available"));
      };
    } catch {
      reject(new Error("WebSocket connection failed"));
    }
  });
};

// Register current page origin with the agent (for multi-tenant setups)
export const registerOrigin = (
  origin?: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(AGENT_URL);
      const targetOrigin = origin || window.location.origin;

      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, CONNECTION_TIMEOUT);

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "registerOrigin",
          origin: targetOrigin,
        }));
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const response = JSON.parse(event.data);
        if (response.type === "connected") return;
        ws.close();
        resolve(response.success ?? false);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
};

// Remove an origin from the agent's allowlist
export const removeOrigin = (
  origin?: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(AGENT_URL);
      const targetOrigin = origin || window.location.origin;

      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, CONNECTION_TIMEOUT);

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "removeOrigin",
          origin: targetOrigin,
        }));
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const response = JSON.parse(event.data);
        if (response.type === "connected") return;
        ws.close();
        resolve(response.success ?? false);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
};