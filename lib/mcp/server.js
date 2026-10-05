const { Server } = require("@modelcontextprotocol/server");
const { StdioServerTransport } = require("@modelcontextprotocol/server/stdio");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/server/types");
const fs = require('fs');
const server = new Server({
  name: "824-mcp-server",
  version: "1.0.0",
}, {
  capabilities: { tools: {} }
});
// Define the tools the Agent can use
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      { name: "read_file", description: "Read a file", inputSchema: { type: "object", properties: { path: { type: "string" } } } },
      { name: "list_files", description: "List files", inputSchema: { type: "object", properties: { path: { type: "string" } } } }
    ]
  };
});
// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "read_file") {
    const content = fs.readFileSync(request.params.arguments.path, 'utf8');
    return { content: [{ type: "text", text: content }] };
  }
  if (request.params.name === "list_files") {
    const files = fs.readdirSync(request.params.arguments.path);
    return { content: [{ type: "text", text: JSON.stringify(files) }] };
  }
});
const transport = new StdioServerTransport();
await server.connect(transport);


