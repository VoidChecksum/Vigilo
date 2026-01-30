import { tool, type PluginInput, type ToolDefinition } from "@opencode-ai/plugin"
import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import type { BackgroundManager } from "../../features/background-agent"
import type { DelegateTaskArgs } from "./types"

import { findNearestMessageWithFields, findFirstMessageWithAgent, MESSAGE_STORAGE } from "../../features/hook-message-injector"
import { resolveMultipleSkillsAsync } from "../../features/opencode-skill-loader/skill-content"
import { discoverSkills } from "../../features/opencode-skill-loader"
import { getTaskToastManager } from "../../features/task-toast-manager"
import { subagentSessions, getSessionAgent } from "../../features/claude-code-session-state"
import { log, getAgentToolRestrictions, findByNameCaseInsensitive } from "../../shared"
import { AUDITOR_SKILL_MAPPING } from "../../agents/auditors/constants"
import { AUDIT_CATEGORIES, AUDIT_CATEGORY_PROMPT_APPENDS, AUDIT_CATEGORY_DESCRIPTIONS } from "./constants"

type OpencodeClient = PluginInput["client"]

// Default agent for category-based tasks (similar to OMO's sisyphus-junior)
const CATEGORY_EXECUTOR_AGENT = "category-executor"

function parseModelString(model: string): { providerID: string; modelID: string } | undefined {
  const parts = model.split("/")
  if (parts.length >= 2) {
    return { providerID: parts[0], modelID: parts.slice(1).join("/") }
  }
  return undefined
}


function getMessageDir(sessionID: string): string | null {
  if (!existsSync(MESSAGE_STORAGE)) return null

  const directPath = join(MESSAGE_STORAGE, sessionID)
  if (existsSync(directPath)) return directPath

  for (const dir of readdirSync(MESSAGE_STORAGE)) {
    const sessionPath = join(MESSAGE_STORAGE, dir, sessionID)
    if (existsSync(sessionPath)) return sessionPath
  }

  return null
}

function formatDuration(start: Date, end?: Date): string {
  const duration = (end ?? new Date()).getTime() - start.getTime()
  const seconds = Math.floor(duration / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

interface ErrorContext {
  operation: string
  args?: DelegateTaskArgs
  sessionID?: string
  agent?: string
}

function formatDetailedError(error: unknown, ctx: ErrorContext): string {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  const lines: string[] = [
    `${ctx.operation} failed`,
    "",
    `**Error**: ${message}`,
  ]

  if (ctx.sessionID) {
    lines.push(`**Session ID**: ${ctx.sessionID}`)
  }

  if (ctx.agent) {
    lines.push(`**Agent**: ${ctx.agent}`)
  }

  if (ctx.args) {
    lines.push("", "**Arguments**:")
    lines.push(`- description: "${ctx.args.description}"`)
    lines.push(`- subagent_type: ${ctx.args.subagent_type ?? "(none)"}`)
    lines.push(`- run_in_background: ${ctx.args.run_in_background}`)
    lines.push(`- load_skills: [${ctx.args.load_skills?.join(", ") ?? ""}]`)
    if (ctx.args.session_id) {
      lines.push(`- session_id: ${ctx.args.session_id}`)
    }
  }

  if (stack) {
    lines.push("", "**Stack Trace**:")
    lines.push("```")
    lines.push(stack.split("\n").slice(0, 10).join("\n"))
    lines.push("```")
  }

  return lines.join("\n")
}

type ToolContextWithMetadata = {
  sessionID: string
  messageID: string
  agent: string
  abort: AbortSignal
  metadata?: (input: { title?: string; metadata?: Record<string, unknown> }) => void
}



export interface SyncSessionCreatedEvent {
  sessionID: string
  parentID: string
  title: string
}

export interface DelegateTaskToolOptions {
  manager: BackgroundManager
  client: OpencodeClient
  directory: string
  onSyncSessionCreated?: (event: SyncSessionCreatedEvent) => Promise<void>
}

export interface BuildSystemContentInput {
  skillContent?: string
  categoryPromptAppend?: string
}

export function buildSystemContent(input: BuildSystemContentInput): string | undefined {
  const { skillContent, categoryPromptAppend } = input
  const parts: string[] = []
  
  if (skillContent) parts.push(skillContent)
  if (categoryPromptAppend) parts.push(categoryPromptAppend)
  
  return parts.length > 0 ? parts.join("\n\n") : undefined
}

export function createDelegateTask(options: DelegateTaskToolOptions): ToolDefinition {
  const { manager, client, directory, onSyncSessionCreated } = options

  const categoryNames = Object.keys(AUDIT_CATEGORIES)
  const categoryList = categoryNames.map(name => {
    const desc = AUDIT_CATEGORY_DESCRIPTIONS[name]
    return desc ? `  - ${name}: ${desc}` : `  - ${name}`
  }).join("\n")

  const description = `Spawn agent task with category-based or direct agent selection.

MUTUALLY EXCLUSIVE: Provide EITHER category OR subagent_type, not both (unless continuing a session).

- load_skills: ALWAYS REQUIRED. Pass at least one skill name (e.g., ["reentrancy"], ["oracle", "flashloan"]).
- category: Use predefined audit category (auto-selects appropriate model)
  Available categories:
${categoryList}
- subagent_type: Use specific agent directly (e.g., "reentrancy-auditor", "oracle-auditor")
- run_in_background: true=async (returns task_id), false=sync (waits for result). Default: false.
- session_id: Existing Task session to continue (from previous task output).
- command: The command that triggered this task (optional).

**WHEN TO USE session_id:**
- Task failed/incomplete → session_id with "fix: [specific issue]"
- Need follow-up on previous result → session_id with additional question
- Multi-turn conversation with same agent → always session_id instead of new task

Prompts MUST be in English.`

  return tool({
    description,
    args: {
      load_skills: tool.schema.array(tool.schema.string()).describe("Skill names to inject. REQUIRED - pass [] if no skills needed."),
      description: tool.schema.string().describe("Short task description (3-5 words)"),
      prompt: tool.schema.string().describe("Full detailed prompt for the agent"),
      run_in_background: tool.schema.boolean().describe("true=async (returns task_id), false=sync (waits). Default: false"),
      category: tool.schema.string().optional().describe(`Audit category (${categoryNames.join(", ")}). Mutually exclusive with subagent_type.`),
      subagent_type: tool.schema.string().optional().describe("Agent name (e.g., 'reentrancy-auditor'). Mutually exclusive with category."),
      session_id: tool.schema.string().optional().describe("Existing Task session to continue"),
      command: tool.schema.string().optional().describe("The command that triggered this task"),
    },
    async execute(args: DelegateTaskArgs, toolContext) {
      const ctx = toolContext as ToolContextWithMetadata
      if (args.run_in_background === undefined) {
        throw new Error(`Invalid arguments: 'run_in_background' parameter is REQUIRED. Use run_in_background=false for task delegation, run_in_background=true only for parallel exploration.`)
      }
      if (args.load_skills === undefined) {
        throw new Error(`Invalid arguments: 'load_skills' parameter is REQUIRED. Pass [] if no skills needed, but IT IS HIGHLY RECOMMENDED to pass proper skills like ["playwright"], ["git-master"] for best results.`)
      }
      if (args.load_skills === null) {
        throw new Error(`Invalid arguments: load_skills=null is not allowed. Pass [] if no skills needed, but IT IS HIGHLY RECOMMENDED to pass proper skills.`)
      }

      // Validate category and subagent_type mutual exclusivity
      if (!args.session_id) {
        if (args.category && args.subagent_type) {
          return `Invalid arguments: 'category' and 'subagent_type' are mutually exclusive. Use one or the other.`
        }
        if (!args.category && !args.subagent_type) {
          return `Invalid arguments: Either 'category' or 'subagent_type' is required.`
        }
      }

      // Resolve category config
      let categoryConfig: { model?: string; promptAppend?: string } | undefined
      if (args.category) {
        const config = AUDIT_CATEGORIES[args.category]
        if (!config) {
          const available = Object.keys(AUDIT_CATEGORIES).join(", ")
          return `Unknown category: "${args.category}". Available: ${available}`
        }
        categoryConfig = {
          model: config.model,
          promptAppend: AUDIT_CATEGORY_PROMPT_APPENDS[args.category],
        }
        log("[delegate_task] Category resolved", { category: args.category, model: categoryConfig.model })
      }

      const runInBackground = args.run_in_background === true

      let skillContent: string | undefined
      if (args.load_skills.length > 0) {
        const { resolved, notFound } = await resolveMultipleSkillsAsync(args.load_skills, {})
        if (notFound.length > 0) {
          const allSkills = await discoverSkills({ includeClaudeCodePaths: true })
          const available = allSkills.map(s => s.name).join(", ")
          return `Skills not found: ${notFound.join(", ")}. Available: ${available}`
        }
        skillContent = Array.from(resolved.values()).join("\n\n")
      }

      const messageDir = getMessageDir(ctx.sessionID)
      const prevMessage = messageDir ? findNearestMessageWithFields(messageDir) : null
      const firstMessageAgent = messageDir ? findFirstMessageWithAgent(messageDir) : null
      const sessionAgent = getSessionAgent(ctx.sessionID)
      const parentAgent = ctx.agent ?? sessionAgent ?? firstMessageAgent ?? prevMessage?.agent

      log("[delegate_task] parentAgent resolution", {
        sessionID: ctx.sessionID,
        messageDir,
        ctxAgent: ctx.agent,
        sessionAgent,
        firstMessageAgent,
        prevMessageAgent: prevMessage?.agent,
        resolvedParentAgent: parentAgent,
      })
      const parentModel = prevMessage?.model?.providerID && prevMessage?.model?.modelID
        ? { providerID: prevMessage.model.providerID, modelID: prevMessage.model.modelID }
        : undefined

      if (args.session_id) {
        if (runInBackground) {
          try {
            const task = await manager.resume({
              sessionId: args.session_id,
              prompt: args.prompt,
              parentSessionID: ctx.sessionID,
              parentMessageID: ctx.messageID,
              parentModel,
              parentAgent,
            })

            ctx.metadata?.({
              title: `Continue: ${task.description}`,
              metadata: {
                prompt: args.prompt,
                agent: task.agent,
                load_skills: args.load_skills,
                description: args.description,
                run_in_background: args.run_in_background,
                sessionId: task.sessionID,
                command: args.command,
              },
            })

            return `Background task continued.

Task ID: ${task.id}
Session ID: ${task.sessionID}
Description: ${task.description}
Agent: ${task.agent}
Status: ${task.status}

Agent continues with full previous context preserved.
Use \`background_output\` with task_id="${task.id}" to check progress.`
          } catch (error) {
            return formatDetailedError(error, {
              operation: "Continue background task",
              args,
              sessionID: args.session_id,
            })
          }
        }

        const toastManager = getTaskToastManager()
        const taskId = `resume_sync_${args.session_id.slice(0, 8)}`
        const startTime = new Date()

        if (toastManager) {
          toastManager.addTask({
            id: taskId,
            description: args.description,
            agent: "continue",
            isBackground: false,
          })
        }

        ctx.metadata?.({
          title: `Continue: ${args.description}`,
          metadata: {
            prompt: args.prompt,
            load_skills: args.load_skills,
            description: args.description,
            run_in_background: args.run_in_background,
            sessionId: args.session_id,
            sync: true,
            command: args.command,
          },
        })

        try {
          let resumeAgent: string | undefined
          let resumeModel: { providerID: string; modelID: string } | undefined

          try {
            const messagesResp = await client.session.messages({ path: { id: args.session_id } })
            const messages = (messagesResp.data ?? []) as Array<{
              info?: { agent?: string; model?: { providerID: string; modelID: string }; modelID?: string; providerID?: string }
            }>
            for (let i = messages.length - 1; i >= 0; i--) {
              const info = messages[i].info
              if (info?.agent || info?.model || (info?.modelID && info?.providerID)) {
                resumeAgent = info.agent
                resumeModel = info.model ?? (info.providerID && info.modelID ? { providerID: info.providerID, modelID: info.modelID } : undefined)
                break
              }
            }
          } catch {
            const resumeMessageDir = getMessageDir(args.session_id)
            const resumeMessage = resumeMessageDir ? findNearestMessageWithFields(resumeMessageDir) : null
            resumeAgent = resumeMessage?.agent
            resumeModel = resumeMessage?.model?.providerID && resumeMessage?.model?.modelID
              ? { providerID: resumeMessage.model.providerID, modelID: resumeMessage.model.modelID }
              : undefined
          }

          await client.session.prompt({
            path: { id: args.session_id },
            body: {
              ...(resumeAgent !== undefined ? { agent: resumeAgent } : {}),
              ...(resumeModel !== undefined ? { model: resumeModel } : {}),
              tools: {
                ...(resumeAgent ? getAgentToolRestrictions(resumeAgent) : {}),
                task: false,
                delegate_task: false,
                call_vigilo_agent: true,
              },
              parts: [{ type: "text", text: args.prompt }],
            },
          })
        } catch (promptError) {
          if (toastManager) {
            toastManager.removeTask(taskId)
          }
          const errorMessage = promptError instanceof Error ? promptError.message : String(promptError)
          return `Failed to send continuation prompt: ${errorMessage}\n\nSession ID: ${args.session_id}`
        }

        // Wait for message stability after prompt completes
        const POLL_INTERVAL_MS = 500
        const MIN_STABILITY_TIME_MS = 5000
        const STABILITY_POLLS_REQUIRED = 3
        const pollStart = Date.now()
        let lastMsgCount = 0
        let stablePolls = 0

        while (Date.now() - pollStart < 60000) {
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))

          const elapsed = Date.now() - pollStart
          if (elapsed < MIN_STABILITY_TIME_MS) continue

          const messagesCheck = await client.session.messages({ path: { id: args.session_id } })
          const msgs = ((messagesCheck as { data?: unknown }).data ?? messagesCheck) as Array<unknown>
          const currentMsgCount = msgs.length

          if (currentMsgCount > 0 && currentMsgCount === lastMsgCount) {
            stablePolls++
            if (stablePolls >= STABILITY_POLLS_REQUIRED) break
          } else {
            stablePolls = 0
            lastMsgCount = currentMsgCount
          }
        }

        const messagesResult = await client.session.messages({
          path: { id: args.session_id },
        })

        if (messagesResult.error) {
          if (toastManager) {
            toastManager.removeTask(taskId)
          }
          return `Error fetching result: ${messagesResult.error}\n\nSession ID: ${args.session_id}`
        }

        const messages = ((messagesResult as { data?: unknown }).data ?? messagesResult) as Array<{
          info?: { role?: string; time?: { created?: number } }
          parts?: Array<{ type?: string; text?: string }>
        }>

        const assistantMessages = messages
          .filter((m) => m.info?.role === "assistant")
          .sort((a, b) => (b.info?.time?.created ?? 0) - (a.info?.time?.created ?? 0))
        const lastMessage = assistantMessages[0]

        if (toastManager) {
          toastManager.removeTask(taskId)
        }

        if (!lastMessage) {
          return `No assistant response found.\n\nSession ID: ${args.session_id}`
        }

        // Extract text from both "text" and "reasoning" parts (thinking models use "reasoning")
        const textParts = lastMessage?.parts?.filter((p) => p.type === "text" || p.type === "reasoning") ?? []
        const textContent = textParts.map((p) => p.text ?? "").filter(Boolean).join("\n")

        const duration = formatDuration(startTime)

        return `Task continued and completed in ${duration}.

Session ID: ${args.session_id}

---

${textContent || "(No text output)"}

---
To continue this session: session_id="${args.session_id}"`
      }

      let agentToUse: string
      if (args.subagent_type?.trim()) {
        agentToUse = args.subagent_type.trim()
      } else if (args.category) {
        agentToUse = CATEGORY_EXECUTOR_AGENT
      } else {
        return `Either 'category' or 'subagent_type' is required.`
      }

      // Validate agent exists when subagent_type is provided
      if (agentToUse) {
        try {
          const agentsResult = await client.app.agents()
          type AgentInfo = { name: string; mode?: "subagent" | "primary" | "all" }
          const agents = (agentsResult as { data?: AgentInfo[] }).data ?? agentsResult as unknown as AgentInfo[]

          const callableAgents = agents.filter((a) => a.mode !== "primary")

          const matchedAgent = findByNameCaseInsensitive(callableAgents, agentToUse)
          if (!matchedAgent) {
            const isPrimaryAgent = findByNameCaseInsensitive(
              agents.filter((a) => a.mode === "primary"),
              agentToUse
            )
            if (isPrimaryAgent) {
              return `Cannot call primary agent "${isPrimaryAgent.name}" via delegate_task. Primary agents are top-level orchestrators.`
            }

            const availableAgents = callableAgents
              .map((a) => a.name)
              .sort()
              .join(", ")
            return `Unknown agent: "${agentToUse}". Available agents: ${availableAgents}`
          }
          agentToUse = matchedAgent.name
        } catch {
          // If we can't fetch agents, proceed anyway
        }

        // Auto-inject skills for auditors when load_skills is empty
        const auditorSkills = AUDITOR_SKILL_MAPPING[agentToUse]
        if (auditorSkills && args.load_skills.length === 0) {
          log("[delegate_task] Auto-injecting skills for auditor", { agent: agentToUse, skills: auditorSkills })
          const { resolved, notFound } = await resolveMultipleSkillsAsync(auditorSkills, {})
          if (notFound.length > 0) {
            log("[delegate_task] Some auditor skills not found", { notFound })
          }
          if (resolved.size > 0) {
            skillContent = Array.from(resolved.values()).join("\n\n")
          }
        }
      }

      const systemContent = buildSystemContent({ 
        skillContent, 
        categoryPromptAppend: categoryConfig?.promptAppend 
      })

      if (runInBackground) {
        try {
          const task = await manager.launch({
            description: args.description,
            prompt: args.prompt,
            agent: agentToUse,
            parentSessionID: ctx.sessionID,
            parentMessageID: ctx.messageID,
            parentModel,
            parentAgent,
            skills: args.load_skills.length > 0 ? args.load_skills : undefined,
            skillContent: systemContent,
          })

          ctx.metadata?.({
            title: args.description,
            metadata: {
              prompt: args.prompt,
              agent: task.agent,
              load_skills: args.load_skills,
              description: args.description,
              run_in_background: args.run_in_background,
              sessionId: task.sessionID,
              command: args.command,
            },
          })

          return `Background task launched.

Task ID: ${task.id}
Session ID: ${task.sessionID}
Description: ${task.description}
Agent: ${task.agent}
Status: ${task.status}

System notifies on completion. Use \`background_output\` with task_id="${task.id}" to check.
To continue this session: session_id="${task.sessionID}"`
        } catch (error) {
          return formatDetailedError(error, {
            operation: "Launch background task",
            args,
            agent: agentToUse,
          })
        }
      }

      const toastManager = getTaskToastManager()
      let taskId: string | undefined
      let syncSessionID: string | undefined

      try {
        const parentSession = client.session.get
          ? await client.session.get({ path: { id: ctx.sessionID } }).catch(() => null)
          : null
        const parentDirectory = parentSession?.data?.directory ?? directory

        const createResult = await client.session.create({
          body: {
            parentID: ctx.sessionID,
            title: `Task: ${args.description}`,
          },
          query: {
            directory: parentDirectory,
          },
        })

        if (createResult.error) {
          return `Failed to create session: ${createResult.error}`
        }

        const sessionID = createResult.data.id
        syncSessionID = sessionID
        subagentSessions.add(sessionID)

        if (onSyncSessionCreated) {
          log("[delegate_task] Invoking onSyncSessionCreated callback", { sessionID, parentID: ctx.sessionID })
          await onSyncSessionCreated({
            sessionID,
            parentID: ctx.sessionID,
            title: args.description,
          }).catch((err) => {
            log("[delegate_task] onSyncSessionCreated callback failed", { error: String(err) })
          })
          await new Promise(r => setTimeout(r, 200))
        }

        taskId = `sync_${sessionID.slice(0, 8)}`
        const startTime = new Date()

        if (toastManager) {
          toastManager.addTask({
            id: taskId,
            description: args.description,
            agent: agentToUse,
            isBackground: false,
            skills: args.load_skills,
          })
        }

        ctx.metadata?.({
          title: args.description,
          metadata: {
            prompt: args.prompt,
            agent: agentToUse,
            load_skills: args.load_skills,
            description: args.description,
            run_in_background: args.run_in_background,
            sessionId: sessionID,
            sync: true,
            command: args.command,
          },
        })

        try {
          const categoryModel = categoryConfig?.model ? parseModelString(categoryConfig.model) : undefined
          
          await client.session.prompt({
            path: { id: sessionID },
            body: {
              ...(agentToUse ? { agent: agentToUse } : {}),
              ...(categoryModel ? { model: categoryModel } : {}),
              system: systemContent,
              tools: {
                task: false,
                delegate_task: false,
                call_vigilo_agent: true,
              },
              parts: [{ type: "text", text: args.prompt }],
            },
          })
        } catch (promptError) {
          if (toastManager && taskId !== undefined) {
            toastManager.removeTask(taskId)
          }
          const errorMessage = promptError instanceof Error ? promptError.message : String(promptError)
          if (errorMessage.includes("agent.name") || errorMessage.includes("undefined")) {
            return formatDetailedError(new Error(`Agent "${agentToUse}" not found. Make sure the agent is registered in your opencode.json or provided by a plugin.`), {
              operation: "Send prompt to agent",
              args,
              sessionID,
          agent: agentToUse,
        })
          }
          return formatDetailedError(promptError, {
            operation: "Send prompt",
            args,
            sessionID,
          agent: agentToUse,
        })
        }

        // Poll for session completion with stability detection
        // The session may show as "idle" before messages appear, so we also check message stability
        const POLL_INTERVAL_MS = 500
        const MAX_POLL_TIME_MS = 10 * 60 * 1000
        const MIN_STABILITY_TIME_MS = 10000  // Minimum 10s before accepting completion
        const STABILITY_POLLS_REQUIRED = 3
        const pollStart = Date.now()
        let lastMsgCount = 0
        let stablePolls = 0
        let pollCount = 0

        log("[delegate_task] Starting poll loop", { sessionID, agentToUse })

        while (Date.now() - pollStart < MAX_POLL_TIME_MS) {
          if (ctx.abort?.aborted) {
            log("[delegate_task] Aborted by user", { sessionID })
            if (toastManager && taskId) toastManager.removeTask(taskId)
            return `Task aborted.\n\nSession ID: ${sessionID}`
          }

          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
          pollCount++

          const statusResult = await client.session.status()
          const allStatuses = (statusResult.data ?? {}) as Record<string, { type: string }>
          const sessionStatus = allStatuses[sessionID]

          if (pollCount % 10 === 0) {
            log("[delegate_task] Poll status", {
              sessionID,
              pollCount,
              elapsed: Math.floor((Date.now() - pollStart) / 1000) + "s",
              sessionStatus: sessionStatus?.type ?? "not_in_status",
              stablePolls,
              lastMsgCount,
            })
          }

          if (sessionStatus && sessionStatus.type !== "idle") {
            stablePolls = 0
            lastMsgCount = 0
            continue
          }

          const elapsed = Date.now() - pollStart
          if (elapsed < MIN_STABILITY_TIME_MS) {
            continue
          }

          const messagesCheck = await client.session.messages({ path: { id: sessionID } })
          const msgs = ((messagesCheck as { data?: unknown }).data ?? messagesCheck) as Array<unknown>
          const currentMsgCount = msgs.length

          if (currentMsgCount === lastMsgCount) {
            stablePolls++
            if (stablePolls >= STABILITY_POLLS_REQUIRED) {
              log("[delegate_task] Poll complete - messages stable", { sessionID, pollCount, currentMsgCount })
              break
            }
          } else {
            stablePolls = 0
            lastMsgCount = currentMsgCount
          }
        }

        if (Date.now() - pollStart >= MAX_POLL_TIME_MS) {
          log("[delegate_task] Poll timeout reached", { sessionID, pollCount, lastMsgCount, stablePolls })
        }

        const messagesResult = await client.session.messages({
          path: { id: sessionID },
        })

        if (messagesResult.error) {
          return `Error fetching result: ${messagesResult.error}\n\nSession ID: ${sessionID}`
        }

        const messages = ((messagesResult as { data?: unknown }).data ?? messagesResult) as Array<{
          info?: { role?: string; time?: { created?: number } }
          parts?: Array<{ type?: string; text?: string }>
        }>

        const assistantMessages = messages
          .filter((m) => m.info?.role === "assistant")
          .sort((a, b) => (b.info?.time?.created ?? 0) - (a.info?.time?.created ?? 0))
        const lastMessage = assistantMessages[0]

        if (!lastMessage) {
          return `No assistant response found.\n\nSession ID: ${sessionID}`
        }

        // Extract text from both "text" and "reasoning" parts (thinking models use "reasoning")
        const textParts = lastMessage?.parts?.filter((p) => p.type === "text" || p.type === "reasoning") ?? []
        const textContent = textParts.map((p) => p.text ?? "").filter(Boolean).join("\n")

        const duration = formatDuration(startTime)

        if (toastManager) {
          toastManager.removeTask(taskId)
        }

        subagentSessions.delete(sessionID)

        return `Task completed in ${duration}.

Agent: ${agentToUse}
Session ID: ${sessionID}

---

${textContent || "(No text output)"}

---
To continue this session: session_id="${sessionID}"`
      } catch (error) {
        if (toastManager && taskId !== undefined) {
          toastManager.removeTask(taskId)
        }
        if (syncSessionID) {
          subagentSessions.delete(syncSessionID)
        }
        return formatDetailedError(error, {
          operation: "Execute task",
          args,
          sessionID: syncSessionID,
          agent: agentToUse,
        })
      }
    },
  })
}
