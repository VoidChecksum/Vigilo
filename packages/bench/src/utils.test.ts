import { describe, test, expect } from "bun:test"
import { computeBaselineComparison } from "./utils"
import type { ScaBenchBaseline } from "./types"

describe("computeBaselineComparison", () => {
  const createBaseline = (overrides?: Partial<ScaBenchBaseline>): ScaBenchBaseline => ({
    project: "test-project",
    timestamp: "2025-01-31T00:00:00Z",
    files_analyzed: 10,
    files_skipped: 0,
    total_findings: 5,
    findings: [
      {
        id: "f1",
        title: "Test Finding",
        description: "Test description",
        vulnerability_type: "reentrancy",
        severity: "HIGH",
        confidence: 0.95,
        location: "src/test.sol:10",
        file: "src/test.sol",
        reported_by_model: "gpt-5",
        status: "confirmed",
      },
    ],
    ...overrides,
  })

  const truthFindings = [
    { finding_id: "t1", title: "Truth 1", severity: "HIGH", description: "Truth desc 1" },
    { finding_id: "t2", title: "Truth 2", severity: "MEDIUM", description: "Truth desc 2" },
    { finding_id: "t3", title: "Truth 3", severity: "LOW", description: "Truth desc 3" },
  ]

  describe("#given scored baseline with detection_rate and exact_matches", () => {
    describe("#when computeBaselineComparison is called", () => {
      test("#then should use actual baseline scores", () => {
        // #given
        const baseline = createBaseline({
          scoring: {
            detection_rate: 0.67,
            partial_rate: 0.89,
            truth_file: "test.json",
            truth_count: 3,
            exact_matches: 2,
            partial_matches: 1,
            scored_at: "2025-01-31T00:00:00Z",
            model_used: "gpt-5",
            iterations: 3,
          },
        })

        // #when
        const result = computeBaselineComparison(3, 1.0, truthFindings, baseline)

        // #then
        expect(result.baseline_detection_rate).toBe(0.67)
        expect(result.baseline_exact_matches).toBe(2)
        expect(result.baseline_model).toBe("gpt-5")
        expect(result.baseline_total_findings).toBe(5)
      })

      test("#then should calculate delta correctly when vigilo is better", () => {
        // #given
        const baseline = createBaseline({
          scoring: {
            detection_rate: 0.5,
            partial_rate: 0.7,
            truth_file: "test.json",
            truth_count: 3,
            exact_matches: 1,
            partial_matches: 1,
            scored_at: "2025-01-31T00:00:00Z",
            model_used: "gpt-5",
            iterations: 3,
          },
        })

        // #when
        const result = computeBaselineComparison(3, 0.9, truthFindings, baseline)

        // #then
        expect(result.vigilo_vs_baseline).toBe("better")
        expect(result.delta_detection_rate).toBeCloseTo(0.4, 2)
      })

      test("#then should calculate delta correctly when vigilo is worse", () => {
        // #given
        const baseline = createBaseline({
          scoring: {
            detection_rate: 0.9,
            partial_rate: 0.95,
            truth_file: "test.json",
            truth_count: 3,
            exact_matches: 3,
            partial_matches: 0,
            scored_at: "2025-01-31T00:00:00Z",
            model_used: "gpt-5",
            iterations: 3,
          },
        })

        // #when
        const result = computeBaselineComparison(1, 0.5, truthFindings, baseline)

        // #then
        expect(result.vigilo_vs_baseline).toBe("worse")
        expect(result.delta_detection_rate).toBeCloseTo(-0.4, 2)
      })

      test("#then should mark as equal when delta is within 1% threshold", () => {
        // #given
        const baseline = createBaseline({
          scoring: {
            detection_rate: 0.5,
            partial_rate: 0.7,
            truth_file: "test.json",
            truth_count: 3,
            exact_matches: 1,
            partial_matches: 1,
            scored_at: "2025-01-31T00:00:00Z",
            model_used: "gpt-5",
            iterations: 3,
          },
        })

        // #when
        const result = computeBaselineComparison(2, 0.505, truthFindings, baseline)

        // #then
        expect(result.vigilo_vs_baseline).toBe("equal")
        expect(result.delta_detection_rate).toBeCloseTo(0.005, 3)
      })
    })
  })

  describe("#given unscored baseline without scoring metadata", () => {
    describe("#when computeBaselineComparison is called", () => {
      test("#then should default to 0 for detection_rate and exact_matches", () => {
        // #given
        const baseline = createBaseline()
        // scoring field is undefined

        // #when
        const result = computeBaselineComparison(2, 0.8, truthFindings, baseline)

        // #then
        expect(result.baseline_detection_rate).toBe(0)
        expect(result.baseline_exact_matches).toBe(0)
      })

      test("#then should log warning when scoring metadata is missing", () => {
        // #given
        const baseline = createBaseline()
        const consoleSpy = console.warn as any
        let warnCalled = false
        let warnMessage = ""

        const originalWarn = console.warn
        console.warn = (msg: string) => {
          warnCalled = true
          warnMessage = msg
        }

        // #when
        computeBaselineComparison(2, 0.8, truthFindings, baseline)

        // #then
        console.warn = originalWarn
        expect(warnCalled).toBe(true)
        expect(warnMessage).toContain("Baseline scoring metadata missing")
        expect(warnMessage).toContain("test-project")
      })

      test("#then should calculate vigilo as better when baseline is 0", () => {
        // #given
        const baseline = createBaseline()

        // #when
        const result = computeBaselineComparison(2, 0.5, truthFindings, baseline)

        // #then
        expect(result.vigilo_vs_baseline).toBe("better")
        expect(result.delta_detection_rate).toBeCloseTo(0.5, 2)
      })
    })
  })

  describe("#given edge case: 0 findings in baseline", () => {
    describe("#when computeBaselineComparison is called", () => {
      test("#then should handle empty findings array", () => {
        // #given
        const baseline = createBaseline({
          total_findings: 0,
          findings: [],
          scoring: {
            detection_rate: 0,
            partial_rate: 0,
            truth_file: "test.json",
            truth_count: 3,
            exact_matches: 0,
            partial_matches: 0,
            scored_at: "2025-01-31T00:00:00Z",
            model_used: "gpt-5",
            iterations: 3,
          },
        })

        // #when
        const result = computeBaselineComparison(2, 0.8, truthFindings, baseline)

        // #then
        expect(result.baseline_total_findings).toBe(0)
        expect(result.baseline_exact_matches).toBe(0)
        expect(result.baseline_detection_rate).toBe(0)
      })
    })
  })

  describe("#given edge case: missing reported_by_model field", () => {
    describe("#when computeBaselineComparison is called", () => {
      test("#then should default to 'gpt-5' when reported_by_model is missing", () => {
        // #given
        const baseline = createBaseline({
          findings: [
            {
              id: "f1",
              title: "Test Finding",
              description: "Test description",
              vulnerability_type: "reentrancy",
              severity: "HIGH",
              confidence: 0.95,
              location: "src/test.sol:10",
              file: "src/test.sol",
              reported_by_model: "", // empty string
              status: "confirmed",
            },
          ],
          scoring: {
            detection_rate: 0.5,
            partial_rate: 0.7,
            truth_file: "test.json",
            truth_count: 3,
            exact_matches: 1,
            partial_matches: 1,
            scored_at: "2025-01-31T00:00:00Z",
            model_used: "gpt-5",
            iterations: 3,
          },
        })

        // #when
        const result = computeBaselineComparison(1, 0.6, truthFindings, baseline)

        // #then
        expect(result.baseline_model).toBe("gpt-5")
      })
    })
  })

  describe("#given edge case: null scoring field", () => {
    describe("#when computeBaselineComparison is called", () => {
      test("#then should treat null as missing and default to 0", () => {
        // #given
        const baseline = createBaseline({
          scoring: undefined,
        })

        // #when
        const result = computeBaselineComparison(2, 0.8, truthFindings, baseline)

        // #then
        expect(result.baseline_detection_rate).toBe(0)
        expect(result.baseline_exact_matches).toBe(0)
      })
    })
  })
})
