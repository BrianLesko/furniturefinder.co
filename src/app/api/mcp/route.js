import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { userForApiKey } from "@/lib/auth";
import { isPaid } from "@/lib/billing";
import { registerTools } from "@/lib/mcp-tools";

export const dynamic = "force-dynamic";

// The hosted MCP server. Stateless: each request authenticates with the
// account's key and gets a fresh server that only sees that account's rooms.

function unauthorized() {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32001, message: "Send a Furniture Finder key as 'Authorization: Bearer ff_…'. Make one at furniturefinder.co/dashboard." }, id: null },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="furniturefinder"' } },
  );
}

async function handle(request) {
  const header = request.headers.get("authorization") ?? "";
  const user = userForApiKey(header.replace(/^Bearer\s+/i, "").trim());
  if (!user) return unauthorized();
  if (!isPaid(user)) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32002, message: "This Furniture Finder account isn't subscribed. Subscribe at furniturefinder.co/subscribe." }, id: null },
      { status: 402 },
    );
  }

  const server = new McpServer({ name: "furniture-finder", version: "0.2.0" });
  registerTools(server, { ownerId: user.id });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
