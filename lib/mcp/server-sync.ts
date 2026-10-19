import "server-only";
import { createMcpServer, disableMcpServer, enableMcpServer, getMcpServers } from "./client";
import { object, rows } from "./prompt-data";

const defaults = [
  { name: "energy-mcp", command: "node", args: ["dist/mcp/servers/energy.js"] },
  { name: "brevo-mcp", command: "node", args: ["dist/mcp/servers/brevo.js"] },
  { name: "xml-mcp", command: "node", args: ["dist/mcp/servers/xml.js"] },
] as const;

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function stringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }

export async function ensureDefaultMcpServers(token: string, hotelId: string) {
  const servers = rows(await getMcpServers(token), ["servers", "data"]).map(object);

  for (const expected of defaults) {
    const matching = servers.filter((server) => text(server.name) === expected.name);
    const correctlyConfigured = matching.find((server) => text(server.command) === expected.command && JSON.stringify(stringArray(server.args)) === JSON.stringify(expected.args));

    for (const server of matching) {
      if (server !== correctlyConfigured && server.isActive !== false && text(server.id)) {
        await disableMcpServer(token, text(server.id));
      }
    }

    if (correctlyConfigured) {
      if (correctlyConfigured.isActive === false && text(correctlyConfigured.id)) await enableMcpServer(token, text(correctlyConfigured.id));
      continue;
    }

    await createMcpServer(token, hotelId, expected);
  }
}
