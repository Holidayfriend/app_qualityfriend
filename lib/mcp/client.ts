import "server-only";

const defaultBaseUrl = "https://apis.qualityfriend.solutions";
type JsonObject = Record<string, unknown>;

export class McpApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "McpApiError"; }
}

function baseUrl() { return (process.env.MCP_API_BASE_URL || defaultBaseUrl).replace(/\/$/, ""); }

async function request(path: string, body: JsonObject | null, method = "POST", token?: string) {
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(15_000) });
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
  const user = data.user && typeof data.user === "object" ? data.user as JsonObject : null;
  const nestedData = data.data && typeof data.data === "object" ? data.data as JsonObject : null;
  const id = data.id ?? nested?.id ?? user?.id ?? nestedData?.id;
  if (typeof id !== "string" || !id) throw new McpApiError(`The MCP service did not return a ${resource} ID.`, 502);
  return id;
}

export async function createMcpHotel(name: string) { return requiredId(await request("/hotels", { name }), "hotel"); }
export async function createMcpDepartment(hotelId: string) { return requiredId(await request("/departments", { hotelId, name: "Default", description: "Default department for hotel users", isActive: true }), "department"); }
export async function createSyncedMcpDepartment(token: string, hotelId: string, name: string) { return requiredId(await request("/departments", { hotelId, name, description: `QualityFriend department: ${name}`, isActive: true }, "POST", token), "department"); }
export async function updateMcpDepartment(token: string, departmentId: string, hotelId: string, name: string, isActive: boolean) { await request(`/departments/${encodeURIComponent(departmentId)}`, { hotelId, name, description: `QualityFriend department: ${name}`, isActive }, "PATCH", token); }
export async function createMcpUser(email: string, password: string, hotelId: string, departmentId: string, userType = "author") { await request("/auth/register", { email, password, hotelId, userType, departmentId }); }
async function findMcpUserId(token: string, hotelId: string, email: string) {
  let response: Response;
  try { response = await fetch(`${baseUrl()}/users?hotelId=${encodeURIComponent(hotelId)}&activeOnly=false`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) }); }
  catch { throw new McpApiError("The MCP service could not be reached.", 502); }
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) throw new McpApiError("MCP users could not be loaded.", 502);
  const object = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as JsonObject : null;
  const users = Array.isArray(payload) ? payload : Array.isArray(object?.users) ? object.users : Array.isArray(object?.data) ? object.data : [];
  const match = users.find((entry) => entry && typeof entry === "object" && typeof (entry as JsonObject).email === "string" && ((entry as JsonObject).email as string).toLowerCase() === email.toLowerCase()) as JsonObject | undefined;
  return typeof match?.id === "string" ? match.id : null;
}

export async function createSyncedMcpUser(token: string, email: string, password: string, hotelId: string, departmentId: string, userType: string) {
  let registrationError: unknown = null;
  try { await request("/auth/register", { email, password, hotelId, userType, departmentId }); } catch (error) { registrationError = error; }
  const id = await findMcpUserId(token, hotelId, email);
  if (id) return id;
  if (registrationError) throw registrationError;
  throw new McpApiError("The created MCP user could not be found.", 502);
}
export async function updateMcpUser(token: string, userId: string, data: { hotelId: string; email: string; role: string; isActive: boolean; departmentId: string }) { await request(`/users/${encodeURIComponent(userId)}`, data, "PATCH", token); }
export async function deleteMcpUser(token: string, userId: string, hotelId: string) { await request(`/users/${encodeURIComponent(userId)}`, { hotelId }, "DELETE", token); }
export async function loginMcpUser(email: string, password: string) { const data = await request("/auth/login", { email, password }); if (typeof data.token !== "string" || !data.token) throw new McpApiError("The MCP login response did not contain a token.", 502); return data.token; }

export async function createDefaultMcpServers(hotelId: string) {
  const servers = [{ name: "energy-mcp", args: ["src/mcp/servers/energy.ts"] }, { name: "brevo-mcp", args: ["src/mcp/servers/brevo.ts"] }, { name: "xml-mcp", args: ["src/mcp/servers/xml.ts"] }];
  await Promise.all(servers.map((server) => request("/mcp/servers", { ...server, transport: "stdio", command: "tsx", isActive: true, hotelId })));
}

export type McpProvider = "openai" | "deepseek" | "perplexity" | "brevo" | "claude";
export async function getMcpProviderCredentials(token: string, hotelId: string, provider: McpProvider) { return request(`/hotels/${encodeURIComponent(hotelId)}/providers/${provider}/credentials`, null, "GET", token); }
export async function setMcpProviderCredentials(token: string, hotelId: string, provider: McpProvider, apiKey: string, baseUrl: string, label: string) { return request(`/hotels/${encodeURIComponent(hotelId)}/providers/${provider}/credentials`, { apiKey, baseUrl, label }, "PUT", token); }
export async function getMcpProviders(token: string, hotelId: string) { return request(`/hotels/${encodeURIComponent(hotelId)}/providers`, null, "GET", token) as unknown; }
export async function setMcpProvider(token: string, hotelId: string, provider: Exclude<McpProvider, "brevo">, isEnabled: boolean, defaultModel: string) { return request(`/hotels/${encodeURIComponent(hotelId)}/providers/${provider}`, { isEnabled, defaultModel }, "PUT", token); }
