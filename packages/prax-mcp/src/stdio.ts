#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createPraxMcpServer } from "./server.js";
import { PraxService } from "./service.js";

const service = await PraxService.create();

serveStdio(() => createPraxMcpServer(service), {
  onerror: (error) => {
    process.stderr.write(`[Prax MCP] ${error.message}\n`);
  },
});

