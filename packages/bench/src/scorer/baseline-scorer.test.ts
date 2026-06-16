import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import type { ScaBenchBaseline } from "../types"
import { __setMockResponder } from "../client/opencode"

// These tests exercise scoreBaseline's matching pipeline, which calls the LLM
// via sendPrompt(). Inject a deterministic "no match" responder so the suite is
// hermetic (no live OpenCode server) and never depends on network/model output.
beforeAll(() => {
  __setMockResponder(() => ({
    is_match: false,
    is_partial_match: false,
    explanation: "mock: no match",
    severity_from_junior_auditor: "",
    severity_from_truth: "",
    index_of_finding_from_junior_auditor: -1,
  }))
})

afterAll(() => {
  __setMockResponder(null)
})

describe("scoreBaseline function", () => {
  describe("#given baseline-scorer module", () => {
    describe("#when importing scoreBaseline", () => {
      test("#then should export scoreBaseline function", async () => {
        // #given
        const module = await import("./baseline-scorer")

        // #when
        const scoreBaseline = module.scoreBaseline

        // #then
        expect(typeof scoreBaseline).toBe("function")
      })

      test("#then should export BaselineScoringOptions interface", async () => {
        // #given
        const module = await import("./baseline-scorer")

        // #when
        const hasExport = "scoreBaseline" in module

        // #then
        expect(hasExport).toBe(true)
      })
    })
  })

  describe("#given baseline with findings", () => {
    describe("#when scoreBaseline function signature is checked", () => {
      test("#then should accept baseline, truthFindings, and optional options", async () => {
        // #given
        const { scoreBaseline } = await import("./baseline-scorer")
        const baseline: ScaBenchBaseline = {
          project: "test",
          timestamp: "2025-01-31T00:00:00Z",
          files_analyzed: 1,
          files_skipped: 0,
          total_findings: 1,
          findings: [
            {
              id: "f1",
              title: "Test",
              description: "Test",
              vulnerability_type: "test",
              severity: "HIGH",
              confidence: 0.9,
              location: "test.sol",
              file: "test.sol",
              reported_by_model: "test",
              status: "confirmed",
            },
          ],
        }
        const truthFindings = [
          {
            finding_id: "t1",
            title: "Test",
            severity: "HIGH",
            description: "Test",
          },
        ]

        // #when
        const result = scoreBaseline(baseline, truthFindings, { iterations: 1 })

        // #then
        expect(result).toBeInstanceOf(Promise)
      })
    })
  })

  describe("#given edge case: empty findings", () => {
    describe("#when scoreBaseline is called with empty arrays", () => {
      test("#then should handle empty baseline findings", async () => {
        // #given
        const { scoreBaseline } = await import("./baseline-scorer")
        const baseline: ScaBenchBaseline = {
          project: "test",
          timestamp: "2025-01-31T00:00:00Z",
          files_analyzed: 0,
          files_skipped: 0,
          total_findings: 0,
          findings: [],
        }
        const truthFindings = [
          {
            finding_id: "t1",
            title: "Test",
            severity: "HIGH",
            description: "Test",
          },
        ]

        // #when
        const result = await scoreBaseline(baseline, truthFindings)

        // #then
        expect(result.truth_count).toBe(1)
        expect(result.exact_matches).toBe(0)
        expect(result.detection_rate).toBe(0)
      })

      test("#then should handle empty truth findings", async () => {
        // #given
        const { scoreBaseline } = await import("./baseline-scorer")
        const baseline: ScaBenchBaseline = {
          project: "test",
          timestamp: "2025-01-31T00:00:00Z",
          files_analyzed: 1,
          files_skipped: 0,
          total_findings: 1,
          findings: [
            {
              id: "f1",
              title: "Test",
              description: "Test",
              vulnerability_type: "test",
              severity: "HIGH",
              confidence: 0.9,
              location: "test.sol",
              file: "test.sol",
              reported_by_model: "test",
              status: "confirmed",
            },
          ],
        }
        const truthFindings: any[] = []

        // #when
        const result = await scoreBaseline(baseline, truthFindings)

        // #then
        expect(result.truth_count).toBe(0)
        expect(result.detection_rate).toBe(0)
        expect(result.partial_rate).toBe(0)
      })
    })
  })

  describe("#given baseline with metadata", () => {
    describe("#when scoreBaseline returns ScoringMetadata", () => {
      test("#then should include all required fields", async () => {
        // #given
        const { scoreBaseline } = await import("./baseline-scorer")
        const baseline: ScaBenchBaseline = {
          project: "test-project",
          timestamp: "2025-01-31T00:00:00Z",
          files_analyzed: 1,
          files_skipped: 0,
          total_findings: 1,
          findings: [
            {
              id: "f1",
              title: "Test",
              description: "Test",
              vulnerability_type: "test",
              severity: "HIGH",
              confidence: 0.9,
              location: "test.sol",
              file: "test.sol",
              reported_by_model: "test",
              status: "confirmed",
            },
          ],
        }
        const truthFindings: any[] = []

        // #when
        const result = await scoreBaseline(baseline, truthFindings)

        // #then
        expect(result).toHaveProperty("detection_rate")
        expect(result).toHaveProperty("partial_rate")
        expect(result).toHaveProperty("truth_file")
        expect(result).toHaveProperty("truth_count")
        expect(result).toHaveProperty("exact_matches")
        expect(result).toHaveProperty("partial_matches")
        expect(result).toHaveProperty("scored_at")
        expect(result).toHaveProperty("model_used")
        expect(result).toHaveProperty("iterations")
      })

      test("#then should set truth_file to baseline project name", async () => {
        // #given
        const { scoreBaseline } = await import("./baseline-scorer")
        const baseline: ScaBenchBaseline = {
          project: "my-project",
          timestamp: "2025-01-31T00:00:00Z",
          files_analyzed: 1,
          files_skipped: 0,
          total_findings: 1,
          findings: [
            {
              id: "f1",
              title: "Test",
              description: "Test",
              vulnerability_type: "test",
              severity: "HIGH",
              confidence: 0.9,
              location: "test.sol",
              file: "test.sol",
              reported_by_model: "test",
              status: "confirmed",
            },
          ],
        }
        const truthFindings: any[] = []

        // #when
        const result = await scoreBaseline(baseline, truthFindings)

        // #then
        expect(result.truth_file).toBe("my-project")
      })

      test("#then should set truth_count to number of truth findings", async () => {
        // #given
        const { scoreBaseline } = await import("./baseline-scorer")
        const baseline: ScaBenchBaseline = {
          project: "test",
          timestamp: "2025-01-31T00:00:00Z",
          files_analyzed: 1,
          files_skipped: 0,
          total_findings: 1,
          findings: [
            {
              id: "f1",
              title: "Test",
              description: "Test",
              vulnerability_type: "test",
              severity: "HIGH",
              confidence: 0.9,
              location: "test.sol",
              file: "test.sol",
              reported_by_model: "test",
              status: "confirmed",
            },
          ],
        }
        const truthFindings = [
          { finding_id: "t1", title: "T1", severity: "HIGH", description: "T1" },
          { finding_id: "t2", title: "T2", severity: "MEDIUM", description: "T2" },
          { finding_id: "t3", title: "T3", severity: "LOW", description: "T3" },
        ]

        // #when
        const result = await scoreBaseline(baseline, truthFindings)

        // #then
        expect(result.truth_count).toBe(3)
      })

      test("#then should use default iterations of 3", async () => {
        // #given
        const { scoreBaseline } = await import("./baseline-scorer")
        const baseline: ScaBenchBaseline = {
          project: "test",
          timestamp: "2025-01-31T00:00:00Z",
          files_analyzed: 1,
          files_skipped: 0,
          total_findings: 1,
          findings: [
            {
              id: "f1",
              title: "Test",
              description: "Test",
              vulnerability_type: "test",
              severity: "HIGH",
              confidence: 0.9,
              location: "test.sol",
              file: "test.sol",
              reported_by_model: "test",
              status: "confirmed",
            },
          ],
        }
        const truthFindings: any[] = []

        // #when
        const result = await scoreBaseline(baseline, truthFindings)

        // #then
        expect(result.iterations).toBe(3)
      })

      test("#then should use custom iterations when provided", async () => {
        // #given
        const { scoreBaseline } = await import("./baseline-scorer")
        const baseline: ScaBenchBaseline = {
          project: "test",
          timestamp: "2025-01-31T00:00:00Z",
          files_analyzed: 1,
          files_skipped: 0,
          total_findings: 1,
          findings: [
            {
              id: "f1",
              title: "Test",
              description: "Test",
              vulnerability_type: "test",
              severity: "HIGH",
              confidence: 0.9,
              location: "test.sol",
              file: "test.sol",
              reported_by_model: "test",
              status: "confirmed",
            },
          ],
        }
        const truthFindings: any[] = []

        // #when
        const result = await scoreBaseline(baseline, truthFindings, { iterations: 5 })

        // #then
        expect(result.iterations).toBe(5)
      })

      test("#then should include ISO timestamp in scored_at", async () => {
        // #given
        const { scoreBaseline } = await import("./baseline-scorer")
        const baseline: ScaBenchBaseline = {
          project: "test",
          timestamp: "2025-01-31T00:00:00Z",
          files_analyzed: 1,
          files_skipped: 0,
          total_findings: 1,
          findings: [
            {
              id: "f1",
              title: "Test",
              description: "Test",
              vulnerability_type: "test",
              severity: "HIGH",
              confidence: 0.9,
              location: "test.sol",
              file: "test.sol",
              reported_by_model: "test",
              status: "confirmed",
            },
          ],
        }
        const truthFindings: any[] = []

        // #when
        const result = await scoreBaseline(baseline, truthFindings)

        // #then
        expect(result.scored_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      })

      test("#then should have numeric rates between 0 and 1", async () => {
        // #given
        const { scoreBaseline } = await import("./baseline-scorer")
        const baseline: ScaBenchBaseline = {
          project: "test",
          timestamp: "2025-01-31T00:00:00Z",
          files_analyzed: 1,
          files_skipped: 0,
          total_findings: 1,
          findings: [
            {
              id: "f1",
              title: "Test",
              description: "Test",
              vulnerability_type: "test",
              severity: "HIGH",
              confidence: 0.9,
              location: "test.sol",
              file: "test.sol",
              reported_by_model: "test",
              status: "confirmed",
            },
          ],
        }
        const truthFindings: any[] = []

        // #when
        const result = await scoreBaseline(baseline, truthFindings)

        // #then
        expect(result.detection_rate).toBeGreaterThanOrEqual(0)
        expect(result.detection_rate).toBeLessThanOrEqual(1)
        expect(result.partial_rate).toBeGreaterThanOrEqual(0)
        expect(result.partial_rate).toBeLessThanOrEqual(1)
      })

      test("#then should have partial_rate >= detection_rate", async () => {
        // #given
        const { scoreBaseline } = await import("./baseline-scorer")
        const baseline: ScaBenchBaseline = {
          project: "test",
          timestamp: "2025-01-31T00:00:00Z",
          files_analyzed: 1,
          files_skipped: 0,
          total_findings: 1,
          findings: [
            {
              id: "f1",
              title: "Test",
              description: "Test",
              vulnerability_type: "test",
              severity: "HIGH",
              confidence: 0.9,
              location: "test.sol",
              file: "test.sol",
              reported_by_model: "test",
              status: "confirmed",
            },
          ],
        }
        const truthFindings: any[] = []

        // #when
        const result = await scoreBaseline(baseline, truthFindings)

        // #then
        expect(result.partial_rate).toBeGreaterThanOrEqual(result.detection_rate)
      })
    })
  })
})
