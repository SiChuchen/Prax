export interface PatternSurfaces {
  dominant: string[];
  contextual: string[];
}

const PATTERN_SURFACE_CONTRACTS: Record<string, PatternSurfaces> = {
  "PAT-CANVAS-WORKSPACE": {
    dominant: ["architecture", "dominant_workspace"],
    contextual: ["inspector", "contextual_inspector"],
  },
  "PAT-DATA-EXPLORER": {
    dominant: ["data", "collection"],
    contextual: ["detail", "contextual_inspector"],
  },
  "PAT-SETTINGS-SECTIONS": {
    dominant: ["settings", "configuration_sections"],
    contextual: [],
  },
};

export function patternSurfaceContract(pattern: string | undefined): PatternSurfaces | undefined {
  return pattern === undefined ? undefined : PATTERN_SURFACE_CONTRACTS[pattern];
}
