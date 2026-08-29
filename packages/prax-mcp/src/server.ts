import { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { PraxRuntimeError } from "prax-runtime";
import {
  DesignContextInputSchema,
  DesignCorrectInputSchema,
  DesignDecideInputSchema,
  DesignStartClientSchema,
  DesignFrameInputSchema,
  DesignInspectInputSchema,
  DesignPrepareImplementationInputSchema,
  DesignRealizeInputSchema,
  DesignReconcileInputSchema,
  DesignRouteInputSchema,
  DesignSdirInputSchema,
  DesignValidateInputSchema,
} from "./schemas.js";
import { PraxService, type PraxOutput } from "./service.js";

function toolResult(output: PraxOutput): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    structuredContent: output,
    ...(output.status === "BLOCK" && output.code !== "GATE_NOT_SATISFIED" ? { isError: true } : {}),
  };
}

async function invoke(operation: () => Promise<PraxOutput>): Promise<CallToolResult> {
  try {
    return toolResult(await operation());
  } catch (error) {
    const output: PraxOutput = {
      status: "BLOCK",
      code: error instanceof PraxRuntimeError ? error.code : "PRAX_INTERNAL_ERROR",
      message: error instanceof Error ? error.message : String(error),
    };
    return toolResult(output);
  }
}

export function createPraxMcpServer(service: PraxService): McpServer {
  const server = new McpServer(
    { name: "Prax MCP", version: "0.1.0", title: "Prax MCP" },
    { capabilities: { tools: { listChanged: false } } },
  );

  server.registerTool("design_start", {
    title: "Start product-first design session",
    description: "Create a persisted Prax Design Session. Returns no design knowledge.",
    inputSchema: DesignStartClientSchema,
  }, (input) => invoke(() => service.designStart(input)));

  server.registerTool("design_frame", {
    title: "Validate Product Frame",
    description: "Establish user, goal, tasks, product objects, mental model, and success before routing.",
    inputSchema: DesignFrameInputSchema,
  }, (input) => invoke(() => service.designFrame(input)));

  server.registerTool("design_context", {
    title: "Validate Design Context",
    description: "Record task, domain, information, platform, risk, density, confidence, and material unknowns.",
    inputSchema: DesignContextInputSchema,
  }, (input) => invoke(() => service.designContext(input)));

  server.registerTool("design_route", {
    title: "Route scoped design knowledge",
    description: "Return capped L0 candidate indexes with routing audit; never dumps the knowledge base.",
    inputSchema: DesignRouteInputSchema,
  }, (input) => invoke(() => service.designRoute(input)));

  server.registerTool("design_inspect", {
    title: "Inspect routed knowledge progressively",
    description: "Expand routed candidates at L0–L3 under decision-specific disclosure gates.",
    inputSchema: DesignInspectInputSchema,
  }, (input) => invoke(() => service.designInspect(input)));

  server.registerTool("design_decide", {
    title: "Validate design decisions",
    description: "Persist chosen Pattern, rationale, hierarchy, density, major choices, and rejected alternatives.",
    inputSchema: DesignDecideInputSchema,
  }, (input) => invoke(() => service.designDecide(input)));

  server.registerTool("design_sdir", {
    title: "Generate or validate SDIR",
    description: "Create or lint semantic design intent and reject render-level fields.",
    inputSchema: DesignSdirInputSchema,
  }, (input) => invoke(() => service.designSdir(input)));

  server.registerTool("design_reconcile", {
    title: "Reconcile product needs and capabilities",
    description: "Record supported, composable, gap, and blocked capabilities with explicit resolution.",
    inputSchema: DesignReconcileInputSchema,
  }, (input) => invoke(() => service.designReconcile(input)));

  server.registerTool("design_realize", {
    title: "Decide and steer design realization",
    description:
      "Propose the realization strategy (direct_code | figma_first) after SDIR; submit representation drafts and human review outcomes for figma_first sessions.",
    inputSchema: DesignRealizeInputSchema,
  }, (input) => invoke(() => service.designRealize(input)));

  server.registerTool("design_prepare_implementation", {
    title: "Prepare implementation packet",
    description: "Emit the React/Web Desktop implementation brief only after prior gates pass.",
    inputSchema: DesignPrepareImplementationInputSchema,
  }, (input) => invoke(() => service.designPrepareImplementation(input)));

  server.registerTool("design_validate", {
    title: "Plan and evaluate validation",
    description: "Return context-routed checks, accept real evidence, and evaluate without fabricating user evidence.",
    inputSchema: DesignValidateInputSchema,
  }, (input) => invoke(() => service.designValidate(input)));

  server.registerTool("design_correct", {
    title: "Record a project-local correction",
    description:
      "Write an evidence-backed project correction to <project>/.prax/corrections.yaml (agent-facing ingestion; supersedes must reference existing correction ids). Legal in any session phase; later sessions carry scoped corrections into compiled context and validation obligations.",
    inputSchema: DesignCorrectInputSchema,
  }, (input) => invoke(() => service.designCorrect(input)));

  return server;
}

