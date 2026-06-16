# =============================================================================
# Vigilo Makefile - Development & Quality
# =============================================================================
#
# Vigilo is a Web3 smart-contract audit tool shipped as:
#   - an npm package + OpenCode plugin  (packages/opencode)
#   - a Claude Code plugin              (packages/claude)
#   - an audit-accuracy benchmark       (packages/bench)
#
# This Makefile only delegates to the real bun/npm workspace scripts and the
# repo's static-analysis tooling. There is no container stack.
#
# Usage:
#   make help        - Show all targets
#   make install     - Install workspace dependencies
#   make build       - Build the OpenCode plugin
#   make typecheck   - Type-check the OpenCode plugin
#   make test        - Run the test suite
#   make semgrep     - Run the Vigilo Solidity Semgrep rules on the fixtures
#   make benchmark   - Show how to run the audit-accuracy benchmark
# =============================================================================

OPENCODE_DIR ?= packages/opencode
BENCH_DIR    ?= packages/bench

.PHONY: help
help:
	@echo "Vigilo - Web3 Smart Contract Security Auditing Agent"
	@echo ""
	@echo "=== DEVELOPMENT / BUILD ==="
	@echo "  make install          - Install dependencies for all workspaces"
	@echo "  make build            - Build the OpenCode plugin"
	@echo "  make dev              - Build the OpenCode plugin in watch mode"
	@echo ""
	@echo "=== QUALITY ==="
	@echo "  make typecheck        - Type-check opencode + bench"
	@echo "  make test             - Run the test suites (opencode + bench)"
	@echo "  make test-coverage    - Run tests with coverage (enforces thresholds)"
	@echo "  make lint-skills      - Validate SKILL.md frontmatter across both skill trees"
	@echo ""
	@echo "=== BENCHMARKING ==="
	@echo "  make benchmark                    - Show audit-accuracy benchmark usage"
	@echo "  make benchmark-score CONTEST=<id> - Score findings vs ground truth"
	@echo ""
	@echo "=== STATIC ANALYSIS ==="
	@echo "  make semgrep          - Run Vigilo Solidity Semgrep rules on the fixtures"
	@echo "  make lint-rules       - Alias for 'make semgrep'"
	@echo ""
	@echo "=== CLEANUP ==="
	@echo "  make clean            - Remove build artifacts"
	@echo ""

# =============================================================================
# DEVELOPMENT / BUILD
# =============================================================================

.PHONY: install
install:
	@echo "Installing Vigilo workspace dependencies..."
	cd $(OPENCODE_DIR) && bun install
	cd $(BENCH_DIR) && bun install

.PHONY: build
build:
	cd $(OPENCODE_DIR) && bun run build

.PHONY: dev
dev:
	cd $(OPENCODE_DIR) && bun run dev

# =============================================================================
# QUALITY
# =============================================================================

.PHONY: typecheck
typecheck:
	cd $(OPENCODE_DIR) && bun run typecheck
	cd $(BENCH_DIR) && bun run typecheck

.PHONY: test
test:
	cd $(OPENCODE_DIR) && bun run test
	cd $(BENCH_DIR) && bun test

.PHONY: test-coverage
test-coverage:
	cd $(OPENCODE_DIR) && bun test --coverage
	cd $(BENCH_DIR) && bun test --coverage

.PHONY: lint-skills
lint-skills:
	cd $(OPENCODE_DIR) && bun run script/lint-skills.ts

# =============================================================================
# BENCHMARKING
# =============================================================================

.PHONY: benchmark
benchmark:
	@echo "Vigilo's benchmark harness (packages/bench) scores audit accuracy against"
	@echo "verified Code4rena / Sherlock / Cantina ground-truth reports."
	@echo ""
	@echo "  bunx vigilo-bench <contest-id> -v             # full pipeline (checkout -> audit -> score -> report)"
	@echo "  make benchmark-score CONTEST=<contest-id>     # score existing findings only"
	@echo ""
	@echo "See packages/bench/README.md for the full command reference."

.PHONY: benchmark-score
benchmark-score:
	@test -n "$(CONTEST)" || (echo "Usage: make benchmark-score CONTEST=<contest-id>" && exit 1)
	@cd $(BENCH_DIR) && bun run src/cli.ts score $(CONTEST) -v

# =============================================================================
# STATIC ANALYSIS (Semgrep rules)
# =============================================================================

# Custom Solidity Semgrep ruleset and its regression fixtures.
# NOTE: pass the .sol files EXPLICITLY — a bare `tests/semgrep-fixtures` directory
# scan reports "0 files" (semgrep's built-in .semgrepignore excludes tests/ and a
# directory scan only covers git-tracked files), which silently exits 0 as a false
# "pass". The authoritative pass/fail gate is the regression test
# (tests/semgrep-fixtures/semgrep-rules.test.ts), which asserts expected counts.
SEMGREP_CONFIG  ?= .semgrep/vigilo-rules.yml
SEMGREP_TARGET  ?= tests/semgrep-fixtures/vulnerable/*.sol tests/semgrep-fixtures/safe/*.sol

.PHONY: semgrep
semgrep:
	@command -v semgrep >/dev/null 2>&1 || { echo "semgrep not installed. Try: pipx install semgrep"; exit 1; }
	@echo "Running Vigilo Solidity Semgrep rules (findings on vulnerable fixtures are expected)..."
	semgrep --config ${SEMGREP_CONFIG} ${SEMGREP_TARGET}

.PHONY: lint-rules
lint-rules: semgrep

# =============================================================================
# CLEANUP
# =============================================================================

.PHONY: clean
clean:
	rm -rf $(OPENCODE_DIR)/dist $(BENCH_DIR)/dist
