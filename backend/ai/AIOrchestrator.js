/**
 * AIOrchestrator (backend mirror)
 * Manager-Worker orchestrator, 7 named agents with STRICT per-agent input scoping.
 * Kept in exact parity with frontend/src/services/aiOrchestrator.js (the runtime copy) -
 * same agents, same prompts, same scoping and preflight rules.
 *
 * Workers:
 *   - ARIA (Synthesizer)        - only attached docs; refuses if none
 *   - CLIO (Citations)          - attached docs' metadata, else saved docs
 *   - HERMES (Navigator)        - query history + saved/deleted titles; 5 queries <=7 words, JSON
 *   - SOCRATES (Critic)         - whole history: queries + saved AND deleted abstracts
 *   - MINERVA (Methods)         - attached docs' abstracts, else saved docs
 *   - MOMUS (Counterpoint)      - saved + deleted corpus + query history; contradictions
 *   - JANUS (Bridge)            - per-user activity; bridges collaborators' threads
 */

function extractJsonObject(text) 
{
    if (text == null) return null;

    const s = String(text).trim();

    if (!s) return null;

    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fence ? fence[1].trim() : s;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) 
    {
        try { return JSON.parse(candidate); } catch { return null; }
    }
    try 
    {
        return JSON.parse(candidate.slice(start, end + 1));
    } 
    catch 
    {
        try { return JSON.parse(candidate); } catch { return null; }
    }
}

function stripLeadingAgentMention(prompt) 
{
    return String(prompt || "").replace(/^\s*@\w+\s*/i, "").trim();
}

// Enforce the ≤7-word rule on HERMES suggestions client-side, never trusting
// the model to have obeyed.
function clampQueryWords(q, maxWords = 7) 
{
    return String(q || "").trim().split(/\s+/).slice(0, maxWords).join(" ");
}

class AIOrchestrator {
    constructor(llmProvider, options = {}) {
        this.llm = llmProvider;
        this.CONFIDENCE_THRESHOLD = options.confidenceThreshold || 0.7;

        // Seven named specialist workers. Prompts are deliberately short,
        // imperative, and each states its EXACT input and a hard length cap.
        this.agents = {
            aria: {
                key: "aria",
                name: "ARIA",
                role: "Synthesizer",
                color: "indigo",
                description: "Summarizes ONLY the documents you attach to the message.",
                instruction:
                    "You are ARIA, the Synthesizer.\n" +
                    "INPUT: input.attachedDocs — the documents the user attached to this message. Nothing else exists.\n" +
                    "TASK: Summarize EXACTLY these documents — one short summary per document plus a one-line takeaway. Do NOT compare or contrast them against each other.\n" +
                    "RULES:\n" +
                    "- Never reference documents outside input.attachedDocs.\n" +
                    "- Use input.conversation only to resolve follow-up phrases like 'the second one'.\n" +
                    "- No preamble. Start with the substance.\n" +
                    "HARD LIMIT: 120 words."
            },

            clio: {
                key: "clio",
                name: "CLIO",
                role: "Citations",
                color: "cyan",
                description: "Formats citations for attached documents (or saved docs if none attached).",
                instruction:
                    "You are CLIO, the Citations specialist.\n" +
                    "INPUT: input.docs — document metadata (title, authors, date). Nothing else exists.\n" +
                    "TASK: Produce a formatted reference list (APA 7th unless the user names another style).\n" +
                    "RULES:\n" +
                    "- Mark missing metadata as [n.d.] / [publisher unknown]. NEVER invent a DOI, page range, or publisher.\n" +
                    "- One citation per line. No commentary between citations.\n" +
                    "HARD LIMIT: the reference list plus at most one closing sentence."
            },

            hermes: {
                key: "hermes",
                name: "HERMES",
                role: "Navigator",
                color: "emerald",
                description: "Suggests 5 clickable search queries from your workspace history.",
                instruction:
                    "You are HERMES, the Navigator.\n" +
                    "INPUT: input.queryHistory (past searches), input.savedDocs and input.deletedDocs (titles only). Nothing else exists.\n" +
                    "TASK: Propose EXACTLY 5 new search queries that extend or sharpen this workspace's search direction. " +
                    "Avoid repeating past queries. Each query MUST be 7 words or fewer.\n" +
                    "OUTPUT: Return ONLY this JSON, no other text:\n" +
                    '{"note":"<one sentence, max 15 words>","queries":["q1","q2","q3","q4","q5"]}'
            },

            socrates: {
                key: "socrates",
                name: "SOCRATES",
                role: "Critic",
                color: "amber", 
                description: "Finds gaps in the whole workspace: all queries + saved and deleted doc abstracts.",
                instruction:
                    "You are SOCRATES, the Critic.\n" +
                    "INPUT: input.queryHistory, input.savedDocs, input.deletedDocs (titles + abstracts), input.conversation (recent chat turns). Nothing else exists.\n" +
                    "TASK: If the user is asking you to judge a specific claim (their own or a named collaborator's, e.g. 'is X right?'), " +
                    "find that claim in input.conversation, state directly whether the evidence base supports it, and cite what's missing that would change your answer. " +
                    "Otherwise, list the most important gaps in this evidence base — missing themes, methods, populations, or perspectives. " +
                    "Treat deleted documents as directions the group considered and dropped; flag if a dropped direction left a gap.\n" +
                    "RULES:\n" +
                    "- Use input.conversation only to resolve who said what and what they claimed — never invent a claim that isn't there.\n" +
                    "- Numbered list, max 4 gaps, one line each.\n" +
                    "- End with ONE pointed question that would sharpen the research direction.\n" +
                    "HARD LIMIT: 100 words."
            },

            minerva: {
                key: "minerva",
                name: "MINERVA",
                role: "Methods",
                color: "violet",
                description: "Extracts methodology from attached documents (or saved docs if none attached).",
                instruction:
                    "You are MINERVA, the Methods specialist.\n" +
                    "INPUT: input.docs — titles + abstracts. Nothing else exists.\n" +
                    "TASK: For each document, extract: design, data source, sample, analysis method — only where stated or clearly inferable from the abstract.\n" +
                    "RULES:\n" +
                    "- One compact line per document: 'Title — design; data; sample; analysis'. Write 'not stated' for missing parts. NEVER invent details.\n" +
                    "- If asked to compare, add one closing line grouping by methodology family.\n" +
                    "HARD LIMIT: one line per document + one closing line."
            },

            momus: {
                key: "momus",
                name: "MOMUS",
                role: "Counterpoint",
                color: "rose",
                description: "Challenges the group's consensus: finds contradictions and counter-evidence.",
                instruction:
                    "You are MOMUS, the Counterpoint. Your job is to counter confirmation bias.\n" +
                    "INPUT: input.savedDocs and input.deletedDocs (the group's consensus corpus, titles + abstracts), input.queryHistory, input.conversation (recent chat turns). Nothing else exists.\n" +
                    "TASK:\n" +
                    "1. If the user is asking you to judge a specific person's claim (e.g. 'is X right?'), find that claim in input.conversation and open with a direct verdict — supported, contradicted, or unsupported by this corpus — before anything else.\n" +
                    "2. State in ONE sentence the dominant claim/assumption this corpus leans toward.\n" +
                    "3. List any contradictions BETWEEN the provided documents (cite their titles).\n" +
                    "4. Name up to 3 well-known opposing works, authors, or counter-arguments from scholarly knowledge that challenge the dominant claim — clearly label these 'to verify' since you cannot fetch them.\n" +
                    "RULES:\n" +
                    "- Use input.conversation only to resolve who said what — never invent a claim that isn't there.\n" +
                    "- Be adversarial but factual. Never soften into agreement.\n" +
                    "- If the corpus is too small or balanced to show a lean, say so in one sentence and stop.\n" +
                    "HARD LIMIT: 120 words."
            },

            janus: {
                key: "janus",
                name: "JANUS",
                role: "Bridge",
                color: "teal",
                description: "Bridges collaborators' research threads: finds where teammates' interests connect.",
                instruction:
                    "You are JANUS, the Bridge. You connect collaborators' separate research threads (transactive memory: who is looking at what).\n" +
                    "INPUT: input.activityByUser — each collaborator's queries and saved-document titles, grouped by username — and input.conversation (recent chat turns). Nothing else exists.\n" +
                    "TASK:\n" +
                    "1. If the user is asking you to judge a specific person's claim (e.g. 'is X right?'), find that claim in input.conversation and check it against that person's activityByUser entry before anything else.\n" +
                    "2. In one line each, name what each collaborator's thread is about.\n" +
                    "3. Identify the strongest connection point between two (or more) threads.\n" +
                    "4. Propose ONE bridging search query (7 words max) and, if scholarly knowledge suggests one, ONE known survey/bridging work — labeled 'to verify'.\n" +
                    "RULES:\n" +
                    "- Use input.conversation only to resolve who said what — never invent a claim that isn't there.\n" +
                    "- If only one user has activity, say a bridge needs at least two active collaborators and stop.\n" +
                    "HARD LIMIT: 100 words."
            }
        };
    }

    getAgentsMetadata() {
        return Object.values(this.agents).map(({ key, name, role, description }) => ({
            key,
            name,
            role,
            description
        }));
    }

    // One line per agent — used verbatim by the Manager's clarification reply
    buildAgentDirectory() {
        return Object.values(this.agents)
            .map((a) => `@${a.key} — ${a.description}`)
            .join("\n");
    }

    /**
     * STRICT SCOPING — the heart of this orchestrator. Each agent gets only
     * its slice; everything else is withheld even if present in context.
     */
    buildScopedInput(agentKey, context) {
        const attachedDocs = Array.isArray(context.attachedDocs) ? context.attachedDocs : [];
        const queryHistory = Array.isArray(context.queryHistory) ? context.queryHistory : [];
        const savedDocs = Array.isArray(context.savedDocs) ? context.savedDocs : [];
        const deletedDocs = Array.isArray(context.deletedDocs) ? context.deletedDocs : [];
        const activityByUser = context.activityByUser || {};
        const conversation = Array.isArray(context.conversation) ? context.conversation.slice(-8) : [];

        const titlesOnly = (docs) => docs.map((d) => ({ title: d.title }));
        const metaOnly = (docs) => docs.map((d) => ({ title: d.title, authors: d.authors || "", date: d.date || "" }));
        const withAbstract = (docs) => docs.map((d) => ({ title: d.title, abstract: d.abstract || "" }));

        switch (agentKey) 
        {
            case "aria":
                return { attachedDocs: withAbstract(attachedDocs), conversation };
            case "clio":
                return { docs: metaOnly(attachedDocs.length > 0 ? attachedDocs : savedDocs), conversation };
            case "hermes":
                return {
                    queryHistory,
                    savedDocs: titlesOnly(savedDocs),
                    deletedDocs: titlesOnly(deletedDocs)
                };
            case "socrates":
                return {
                    queryHistory,
                    savedDocs: withAbstract(savedDocs),
                    deletedDocs: withAbstract(deletedDocs),
                    conversation
                };
            case "minerva":
                return { docs: withAbstract(attachedDocs.length > 0 ? attachedDocs : savedDocs), conversation };
            case "momus":
                return {
                    savedDocs: withAbstract(savedDocs),
                    deletedDocs: withAbstract(deletedDocs),
                    queryHistory,
                    conversation
                };
            case "janus":
                return { activityByUser, conversation };
            default:
                return { conversation };
        }
    }

    // Guard checks that must pass BEFORE any LLM call — enforcing the strict
    // input contract deterministically rather than trusting the prompt.
    preflight(agentKey, context) {
        const attached = Array.isArray(context.attachedDocs) ? context.attachedDocs : [];
        const saved = Array.isArray(context.savedDocs) ? context.savedDocs : [];
        const activity = context.activityByUser || {};

        if (agentKey === "aria" && attached.length === 0) 
        {
            return "ARIA summarizes exactly what you attach. Drag one or more documents into the chat, then ask again.";
        }
        if ((agentKey === "clio" || agentKey === "minerva") && attached.length === 0 && saved.length === 0) 
        {
            return `${this.agents[agentKey].name} needs documents. Attach some, or save documents to this topic first.`;
        }
        if ((agentKey === "socrates" || agentKey === "momus") && saved.length === 0 && (context.deletedDocs || []).length === 0) 
        {
            return `${this.agents[agentKey].name} works on this workspace's saved documents — there are none yet. Save a few papers first.`;
        }
        if (agentKey === "janus" && Object.keys(activity).length < 2) 
        {
            return "JANUS bridges collaborators — it needs search/save activity from at least two people in this workspace.";
        }
        return null;
    }

    /**
     * @param {string} userPrompt
     * @param {object} context
     * @param {object} options - { explicitAgentKey?: string, enabledAgentKeys?: string[] }
     */
    async process(userPrompt, context = {}, options = {}) {
        const trimmed = (userPrompt || "").trim();
        if (!trimmed) 
        {
            return { type: "ERROR", content: "Prompt is empty." };
        }

        const enabledAgentKeys = Array.isArray(options.enabledAgentKeys) ? options.enabledAgentKeys : null;
        const isEnabled = (key) => !enabledAgentKeys || enabledAgentKeys.includes(key);

        const explicitFromText = this.getExplicitAgentKey(trimmed);
        const explicitFromOptions = options.explicitAgentKey;

        const resolvedExplicit =
            explicitFromOptions ||
            (explicitFromText && explicitFromText !== "manager" ? explicitFromText : null);

        if (resolvedExplicit && this.agents[resolvedExplicit]) 
        {
            if (!isEnabled(resolvedExplicit)) 
            {
                return {
                    type: "CLARIFICATION",
                    content: `${this.agents[resolvedExplicit].name} is currently turned off in the Agents panel. Turn it back on, or ask a different active agent.`
                };
            }
            return this.executeWorker(this.agents[resolvedExplicit], trimmed, context, { explicit: true });
        }

        return this.orchestrate(trimmed, context, enabledAgentKeys);
    }

    getExplicitAgentKey(prompt) {
        if (!prompt) return null;
        const match = prompt.match(/@(\w+)/);

        if (!match) return null;
        const raw = match[1].toLowerCase();

        if (raw === "ai" || raw === "manager") return "manager";

        if (raw === "aria" || raw === "synthesizer" || raw === "summarizer" || raw === "summary" || raw === "sum") return "aria";

        if (raw === "clio" || raw === "citations" || raw === "cite" || raw === "citation") return "clio";

        if (raw === "hermes" || raw === "navigator" || raw === "reformulator" || raw === "reformulate" || raw === "queryhelper") return "hermes";

        if (raw === "socrates" || raw === "critic" || raw === "gapdetector" || raw === "gap" || raw === "gaps") return "socrates";

        if (raw === "minerva" || raw === "methods" || raw === "methodology") return "minerva";

        if (raw === "momus" || raw === "devil" || raw === "devilsadvocate" || raw === "contradict" || raw === "counter") return "momus";

        if (raw === "janus" || raw === "bridge" || raw === "connect" || raw === "synthesisbridge") return "janus";

        return null;
    }

    /**
     * Manager routing (@ai): decide which of the 7 workers owns the request.
     * The Manager sees ONLY the user's message and the agent directory — it
     * never sees documents, so routing stays fast and cheap.
     * If no confident match: reply with the agent directory and ask the user
     * to mention one directly (per product spec).
     */
    async orchestrate(prompt, context, enabledAgentKeys = null) {
        const availableAgents = enabledAgentKeys
            ? Object.fromEntries(Object.entries(this.agents).filter(([key]) => enabledAgentKeys.includes(key)))
            : this.agents;

        if (Object.keys(availableAgents).length === 0) 
        {
            return {
                type: "CLARIFICATION",
                content: "All agents are currently turned off in the Agents panel. Turn at least one on to get a response."
            };
        }

        const managerInstruction =
            "You are the Research Manager. Route the user's request to EXACTLY ONE worker, or clarify.\n" +
            "Workers (key — what they do):\n" +
            Object.values(availableAgents).map((a) => `${a.key} — ${a.description}`).join("\n") +
            "\n\nRouting rules:\n" +
            "- summarize/compare attached docs → aria\n" +
            "- citations/references/bibliography → clio\n" +
            "- better/new search queries, keywords → hermes\n" +
            "- gaps, what's missing, critique evidence → socrates\n" +
            "- methodology, study design, how studies were done → minerva\n" +
            "- contradictions, counter-evidence, challenge our assumption, devil's advocate → momus\n" +
            "- connect/bridge collaborators' work, who is researching what → janus\n" +
            `- If confidence < ${this.CONFIDENCE_THRESHOLD}, return clarify.\n` +
            "Return ONLY JSON:\n" +
            '{"action":"delegate","agent":"<key>","conf":0.9}\n' +
            'or {"action":"clarify","conf":0.4}';

        let rawDecision;
        try 
        {
            rawDecision = await this.llm.call(managerInstruction, JSON.stringify({ userMessage: prompt }));
        } 
        catch 
        {
            const fallbackDecision = this.heuristicManager(prompt, enabledAgentKeys);
            return this.applyDecision(fallbackDecision, prompt, context, enabledAgentKeys);
        }

        let decision = extractJsonObject(rawDecision);
        if (!decision || typeof decision !== "object") 
        {
            decision = this.heuristicManager(prompt, enabledAgentKeys);
        }

        return this.applyDecision(decision, prompt, context, enabledAgentKeys);
    }

    heuristicManager(prompt, enabledAgentKeys = null) {
        const isEnabled = (key) => !enabledAgentKeys || enabledAgentKeys.includes(key);
        const lower = (prompt || "").toLowerCase();

        const momusHints = ["contradict", "counter", "refute", "oppose", "devil", "challenge", "against our", "bias"];
        const janusHints = ["bridge", "connect", "overlap", "both of us", "teammate", "collaborator", "each other", "who is looking"];
        const citationHints = ["citation", "cite", "reference list", "bibliography", "apa", "mla"];
        const methodHints = ["method", "methodology", "study design", "sample size", "data collection"];
        const queryHints = ["keyword", "query", "search term", "reformulat", "search string", "boolean", "broaden", "narrow", "refine", "better search"];

        if (momusHints.some((h) => lower.includes(h)) && isEnabled("momus")) return { action: "DELEGATE", agent: "momus", conf: 0.9 };
        if (janusHints.some((h) => lower.includes(h)) && isEnabled("janus")) return { action: "DELEGATE", agent: "janus", conf: 0.9 };
        if ((lower.includes("gap") || lower.includes("missing")) && isEnabled("socrates")) return { action: "DELEGATE", agent: "socrates", conf: 0.9 };
        if (citationHints.some((h) => lower.includes(h)) && isEnabled("clio")) return { action: "DELEGATE", agent: "clio", conf: 0.9 };
        if (methodHints.some((h) => lower.includes(h)) && isEnabled("minerva")) return { action: "DELEGATE", agent: "minerva", conf: 0.9 };
        if ((lower.includes("summar") || lower.includes("overview") || lower.includes("compare")) && isEnabled("aria")) return { action: "DELEGATE", agent: "aria", conf: 0.9 };
        if (queryHints.some((h) => lower.includes(h)) && isEnabled("hermes")) return { action: "DELEGATE", agent: "hermes", conf: 0.9 };

        return { action: "CLARIFY", conf: 0.4 };
    }

    async applyDecision(decision, prompt, context, enabledAgentKeys = null) {
        const conf = typeof decision.conf === "number" ? decision.conf : 0;
        const isEnabled = !enabledAgentKeys || !decision.agent || enabledAgentKeys.includes(decision.agent);

        if (
            String(decision.action || "").toUpperCase() === "CLARIFY" ||
            conf < this.CONFIDENCE_THRESHOLD ||
            !decision.agent ||
            !this.agents[decision.agent] ||
            !isEnabled
        ) 
        {
            return {
                type: "CLARIFICATION",
                content:
                    "I couldn't confidently match that to one agent. Each does one specific job — mention one directly:\n" +
                    this.buildAgentDirectory()
            };
        }

        return this.executeWorker(this.agents[decision.agent], prompt, context, { explicit: false, decision });
    }

    async executeWorker(agent, userPrompt, context, meta = {}) {
        // Deterministic input guard — refuse before any LLM call if the
        // agent's required input is missing (e.g. ARIA with no attached docs).
        const refusal = this.preflight(agent.key, context);
        if (refusal) 
        {
            return { type: "SUCCESS", agent: agent.name, agentKey: agent.key, content: refusal };
        }

        const taskPrompt = stripLeadingAgentMention(userPrompt);
        const scopedInput = this.buildScopedInput(agent.key, context);

        const workerInput = {
            userRequest: taskPrompt || userPrompt,
            input: scopedInput
        };

        let rawResponse;
        try 
        {
            rawResponse = await this.llm.call(agent.instruction, JSON.stringify(workerInput));
        } 
        catch 
        {
            return {
                type: "ERROR",
                agent: agent.name,
                agentKey: agent.key,
                content: `${agent.name} could not contact the underlying language model.`
            };
        }

        // HERMES returns structured JSON → clickable query suggestions
        if (agent.key === "hermes") 
        {
            const parsed = extractJsonObject(rawResponse);
            const queries = Array.isArray(parsed?.queries)
                ? parsed.queries.map((q) => clampQueryWords(q)).filter(Boolean).slice(0, 5)
                : [];

            if (queries.length > 0) 
            {
                const note = typeof parsed?.note === "string" && parsed.note.trim()
                    ? parsed.note.trim()
                    : "Suggested searches — click one to run it:";
                return {
                    type: "SUCCESS",
                    agent: agent.name,
                    agentKey: agent.key,
                    content: note,
                    suggestedQueries: queries
                };
            }
            // fall through to plain text if the model ignored the JSON contract
        }

        const content = typeof rawResponse === "string" ? rawResponse.trim() : JSON.stringify(rawResponse);
        return { type: "SUCCESS", agent: agent.name, agentKey: agent.key, content };
    }
}

module.exports = { AIOrchestrator, stripLeadingAgentMention };