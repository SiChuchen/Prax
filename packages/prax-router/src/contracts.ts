import type { KnowledgeIndex } from "prax-knowledge";
import type { Confidence, GateStatus } from "prax-runtime";

export interface CandidateAudit {
  selected_because: string;
  trigger: string;
  scope_match: string[];
  confidence: Confidence;
}

export interface RoutedCandidate extends KnowledgeIndex {
  routing: CandidateAudit;
}

export interface ExcludedCandidate {
  id: string;
  reason: string;
}

export interface RoutingResult {
  status: GateStatus;
  candidate_domains: string[];
  principles: RoutedCandidate[];
  heuristics: RoutedCandidate[];
  patterns: RoutedCandidate[];
  platform_profile: RoutedCandidate[];
  excluded: ExcludedCandidate[];
  confidence: Confidence;
}

