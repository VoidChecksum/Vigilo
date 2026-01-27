import { describe, test, expect, beforeEach } from "bun:test"
import { buildSystemContent } from "./tools"
import { __resetModelCache } from "../../shared/model-availability"
import { clearSkillCache } from "../../features/opencode-skill-loader/skill-content"

const SYSTEM_DEFAULT_MODEL = "anthropic/claude-sonnet-4-5"

describe("delegate-task", () => {
  beforeEach(() => {
    __resetModelCache()
    clearSkillCache()
  })

  describe("buildSystemContent", () => {
    test("returns undefined when no skills", () => {
      const result = buildSystemContent({ skillContent: undefined })
      expect(result).toBeUndefined()
    })

    test("returns skill content when provided", () => {
      const skillContent = "You are a playwright expert"
      const result = buildSystemContent({ skillContent })
      expect(result).toBe(skillContent)
    })
  })

  describe("skills parameter", () => {
    test("skills parameter is required - throws error when not provided", async () => {
      const { createDelegateTask } = require("./tools")
      
      const mockManager = { launch: async () => ({}) }
      const mockClient = {
        app: { agents: async () => ({ data: [] }) },
        config: { get: async () => ({ data: { model: SYSTEM_DEFAULT_MODEL } }) },
        session: {
          create: async () => ({ data: { id: "test-session" } }),
          prompt: async () => ({ data: {} }),
          messages: async () => ({ data: [] }),
        },
      }
      
      const tool = createDelegateTask({
        manager: mockManager,
        client: mockClient,
      })
      
      const toolContext = {
        sessionID: "parent-session",
        messageID: "parent-message",
        agent: "vigilo",
        abort: new AbortController().signal,
      }
      
      await expect(tool.execute(
        {
          description: "Test task",
          prompt: "Do something",
          subagent_type: "explore",
          run_in_background: false,
        },
        toolContext
      )).rejects.toThrow("IT IS HIGHLY RECOMMENDED")
    })

    test("null skills throws error", async () => {
      const { createDelegateTask } = require("./tools")
      
      const mockManager = { launch: async () => ({}) }
      const mockClient = {
        app: { agents: async () => ({ data: [] }) },
        config: { get: async () => ({ data: { model: SYSTEM_DEFAULT_MODEL } }) },
        session: {
          create: async () => ({ data: { id: "test-session" } }),
          prompt: async () => ({ data: {} }),
          messages: async () => ({ data: [] }),
        },
      }
      
      const tool = createDelegateTask({
        manager: mockManager,
        client: mockClient,
      })
      
      const toolContext = {
        sessionID: "parent-session",
        messageID: "parent-message",
        agent: "vigilo",
        abort: new AbortController().signal,
      }
      
      await expect(tool.execute(
        {
          description: "Test task",
          prompt: "Do something",
          subagent_type: "explore",
          run_in_background: false,
          load_skills: null,
        },
        toolContext
      )).rejects.toThrow("IT IS HIGHLY RECOMMENDED")
    })
  })

  describe("session_id with background parameter", () => {
    test("session_id with background=false should wait for result and return content", async () => {
      const { createDelegateTask } = require("./tools")
      
      const mockTask = {
        id: "task-123",
        sessionID: "ses_continue_test",
        description: "Continued task",
        agent: "explore",
        status: "running",
      }
      
      const mockManager = {
        resume: async () => mockTask,
        launch: async () => mockTask,
      }
      
      const mockClient = {
        session: {
          prompt: async () => ({ data: {} }),
          messages: async () => ({
            data: [
              {
                info: { role: "assistant", time: { created: Date.now() } },
                parts: [{ type: "text", text: "This is the continued task result" }],
              },
            ],
          }),
        },
        config: { get: async () => ({ data: { model: SYSTEM_DEFAULT_MODEL } }) },
        app: {
          agents: async () => ({ data: [] }),
        },
      }
      
      const tool = createDelegateTask({
        manager: mockManager,
        client: mockClient,
      })
      
      const toolContext = {
        sessionID: "parent-session",
        messageID: "parent-message",
        agent: "vigilo",
        abort: new AbortController().signal,
      }
      
      const result = await tool.execute(
        {
          description: "Continue test",
          prompt: "Continue the task",
          session_id: "ses_continue_test",
          run_in_background: false,
          load_skills: [],
        },
        toolContext
      )
      
      expect(result).toContain("This is the continued task result")
      expect(result).not.toContain("Background task continued")
    }, { timeout: 10000 })

    test("session_id with background=true should return immediately without waiting", async () => {
      const { createDelegateTask } = require("./tools")
      
      const mockTask = {
        id: "task-456",
        sessionID: "ses_bg_continue",
        description: "Background continued task",
        agent: "explore",
        status: "running",
      }
      
      const mockManager = {
        resume: async () => mockTask,
      }
      
      const mockClient = {
        session: {
          prompt: async () => ({ data: {} }),
          messages: async () => ({ data: [] }),
        },
        config: { get: async () => ({ data: { model: SYSTEM_DEFAULT_MODEL } }) },
      }
      
      const tool = createDelegateTask({
        manager: mockManager,
        client: mockClient,
      })
      
      const toolContext = {
        sessionID: "parent-session",
        messageID: "parent-message",
        agent: "vigilo",
        abort: new AbortController().signal,
      }
      
      const result = await tool.execute(
        {
          description: "Continue bg test",
          prompt: "Continue in background",
          session_id: "ses_bg_continue",
          run_in_background: true,
          load_skills: [],
        },
        toolContext
      )
      
      expect(result).toContain("Background task continued")
      expect(result).toContain("task-456")
    })
  })
})
