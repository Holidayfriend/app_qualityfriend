import "server-only";

const defaultBaseUrl = "https://apis.qualityfriend.solutions";
type JsonObject = Record<string, unknown>;

export class McpApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "McpApiError"; }
}

function baseUrl() { return (process.env.MCP_API_BASE_URL || defaultBaseUrl).replace(/\/$/, ""); }

async function request(path: string, body: JsonObject, method = "POST", token?: string) {
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch { throw new McpApiError("The MCP service could not be reached.", 502); }
  const data = (await response.json().catch(() => null)) as JsonObject | null;
  if (!response.ok) {
    const detail = typeof data?.error === "string" ? data.error : typeof data?.message === "string" ? data.message : "MCP request failed.";
    throw new McpApiError(detail, 502);
  }
  if (!data) throw new McpApiError("The MCP service returned an invalid response.", 502);
  return data;
}

function requiredId(data: JsonObject, resource: string) {
  const nested = data.record && typeof data.record === "object" ? data.record as JsonObject : null;
  const id = data.id ?? nested?.id;
  if (typeof id !== "string" || !id) throw new McpApiError(`The MCP service did not return a ${resource} ID.`, 502);
  return id;
}

export async function createMcpHotel(name: string) { return requiredId(await request("/hotels", { name }), "hotel"); }
export async function createMcpDepartment(hotelId: string) { return requiredId(await request("/departments", { hotelId, name: "Default", description: "Default department for hotel users", isActive: true }), "department"); }
export async function createSyncedMcpDepartment(token: string, hotelId: string, name: string) { return requiredId(await request("/departments", { hotelId, name, description: `QualityFriend department: ${name}`, isActive: true }, "POST", token), "department"); }
export async function updateMcpDepartment(token: string, departmentId: string, hotelId: string, name: string, isActive: boolean) { await request(`/departments/${encodeURIComponent(departmentId)}`, { hotelId, name, description: `QualityFriend department: ${name}`, isActive }, "PATCH", token); }
export async function createMcpUser(email: string, password: string, hotelId: string, departmentId: string) { await request("/auth/register", { email, password, hotelId, userType: "author", departmentId }); }
export async function loginMcpUser(email: string, password: string) { const data = await request("/auth/login", { email, password }); if (typeof data.token !== "string" || !data.token) throw new McpApiError("The MCP login response did not contain a token.", 502); return data.token; }

export async function createDefaultMcpServers(hotelId: string) {
  const servers = [{ name: "energy-mcp", args: ["src/mcp/servers/energy.ts"] }, { name: "brevo-mcp", args: ["src/mcp/servers/brevo.ts"] }, { name: "xml-mcp", args: ["src/mcp/servers/xml.ts"] }];
  await Promise.all(servers.map((server) => request("/mcp/servers", { ...server, transport: "stdio", command: "tsx", isActive: true, hotelId })));
}
