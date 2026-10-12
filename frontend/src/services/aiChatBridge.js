import { PuterLLMProvider } from "./puterLLMProvider";
import { AIOrchestrator } from "./aiOrchestrator";

const llmProvider = new PuterLLMProvider();
const orchestrator = new AIOrchestrator(llmProvider, {
    confidenceThreshold: 0.7
});

const idOf = (v) => (v && v._id ? v._id : v || "").toString();

// Flatten a raw catalog doc (pnx shape) or a saved Document attached to THIS
// message into the flat {title, abstract, authors, date, type} shape the
// orchestrator's ARIA/MINERVA/CLIO scopes expect. Mirrors flattenAttachedDoc
// in backend/controllers/aiController.js.
function flattenAttachedDoc(doc)
{
    const title = doc?.pnx?.display?.title?.[0] || doc?.pnx?.display?.title || doc?.title || "Untitled";
    const abstract = doc?.pnx?.addata?.abstract?.[0] || doc?.pnx?.addata?.abstract || doc?.doc_abstract || doc?.abstract || "";
    const rawAuthors = doc?.pnx?.addata?.au || doc?.pnx?.addata?.addau || doc?.doc_authors || doc?.authors || [];
    const authors = Array.isArray(rawAuthors) ? rawAuthors.join(", ") : String(rawAuthors || "");
    const date = doc?.pnx?.display?.creationdate?.[0] || doc?.pnx?.display?.creationdate || doc?.doc_date || doc?.date || "";
    const type = doc?.pnx?.display?.type?.[0] || doc?.pnx?.display?.type || doc?.doc_type || doc?.type || "";

    return { title, abstract, authors, date: String(date || ""), type: String(type || "") };
}

/**
 * Build the SAME six scoped slices backend buildWorkspaceContext() builds, so
 * the mirrored orchestrator's buildScopedInput() and preflight() receive
 * exactly the input they expect:
 *   attachedDocs, queryHistory, savedDocs, deletedDocs, activityByUser, conversation
 * Source is the whole workspace (every query and its documents, saved and
 * removed), plus the current topic's timeline documents for freshness.
 */
function buildWorkspaceContext({ workspaceHistory, workspaceId, attachedDocs, recentMessages })
{
    const flatAttached = Array.isArray(attachedDocs) ? attachedDocs.map(flattenAttachedDoc) : [];
    const wsId = (workspaceId || "").toString();

    const queries = (Array.isArray(workspaceHistory?.queries) ? workspaceHistory.queries : [])
        .filter((q) => !wsId || !q?.workspaceId || idOf(q.workspaceId) === wsId)
        .slice()
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

    const documents = [
        ...queries.flatMap((q) => (Array.isArray(q.documents) ? q.documents : [])),
        ...(Array.isArray(workspaceHistory?.timeline?.documents) ? workspaceHistory.timeline.documents : [])
            .filter((d) => !wsId || !d?.workspaceId || idOf(d.workspaceId) === wsId)
    ].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

    // queryHistory - every search query, with resilient username
    const queryHistory = queries
        .map((q) => ({
            query: q.query || "",
            username: q.username || q.userId?.username || "Unknown",
            createdAt: q.createdAt || null
        }))
        .filter((q) => q.query);

    // Split saved vs deleted, deduped by catalog record id
    const seen = new Set();
    const savedDocs = [];
    const deletedDocs = [];
    const uniqueDocs = [];
    documents.forEach((d) => {
        const recordId = (d.documentId || "").toString();
        const mongoId = (d._id || "").toString();
        const key = recordId ? `rec:${recordId}` : mongoId ? `id:${mongoId}` : null;
        if (!key || seen.has(key)) return;
        seen.add(key);
        uniqueDocs.push(d);

        const entry = {
            title: d.title || "Untitled",
            abstract: d.doc_abstract || "",
            authors: Array.isArray(d.doc_authors) ? d.doc_authors.join(", ") : String(d.doc_authors || ""),
            date: String(d.doc_date || ""),
            username: d.username || d.userId?.username || "Unknown",
            savedAt: d.createdAt || null,
            isRemoved: !!d.doc_isRemoved
        };
        (entry.isRemoved ? deletedDocs : savedDocs).push(entry);
    });

    // activityByUser - per-collaborator queries + active saved titles (JANUS)
    const activityByUser = {};
    const ensureUser = (name) => {
        const u = name || "Unknown";
        if (!activityByUser[u]) activityByUser[u] = { queries: [], savedTitles: [] };
        return activityByUser[u];
    };
    queries.forEach((q) => {
        const qUser = q.username || q.userId?.username || "Unknown";
        if (q.query) ensureUser(qUser).queries.push(q.query);
    });
    uniqueDocs.forEach((d) => {
        if (d.doc_isRemoved) return;
        const dUser = d.username || d.userId?.username || "Unknown";
        ensureUser(dUser).savedTitles.push(d.title || "Untitled");
    });

    // conversation - last turns for follow-up reference resolution only
    const conversation = (Array.isArray(recentMessages) ? recentMessages : []).slice(-12).map((m) => ({
        speaker: m.username || "Unknown",
        isAI: !!m.isAIMessage,
        text: m.text || "",
        createdAt: m.createdAt || null
    }));

    return {
        attachedDocs: flatAttached,
        queryHistory,
        savedDocs,
        deletedDocs,
        activityByUser,
        conversation
    };
}

/**
 * Puter AI path: Manager-Worker orchestration with strict per-agent scoping
 */
class ResearchAIChatBridge {
    /**
     * @param {object} p
     * @param {string} p.message - Full user message (include @ai / @aria etc.)
     * @param {Array} [p.attachedDocs] - Documents explicitly dragged into this message
     * @param {object} [p.workspaceHistory] - { workspaceName, queries (with documents), timeline }
     * @param {string} [p.workspaceId]
     * @param {string} [p.queryId]
     * @param {string} [p.queryText] - Current search topic (aligns with chat channel key)
     * @param {string} [p.explicitAgentKey] - From UI dropdown when not "manager"
     * @param {Array} [p.enabledAgentKeys] - Agent keys currently toggled on in the Agents panel; when provided, restricts both explicit and Manager auto-routing to this set
     * @param {Array} [p.recentMessages] - Recent chat messages for follow-up resolution
     */
    async sendResearchRequest({
        message,
        attachedDocs,
        workspaceHistory,
        workspaceId,
        queryId,
        queryText,
        explicitAgentKey,
        enabledAgentKeys,
        recentMessages
    }) {
        const slices = buildWorkspaceContext({ workspaceHistory, workspaceId, attachedDocs, recentMessages });

        const context = {
            ...slices,
            workspace: {
                id: workspaceId || null,
                name: workspaceHistory?.workspaceName || workspaceHistory?.name || null,
                queryId: queryId || null,
                queryText: queryText || null
            }
        };

        const options = {};
        if (explicitAgentKey && explicitAgentKey !== "manager")
        {
            options.explicitAgentKey = explicitAgentKey;
        }
        if (Array.isArray(enabledAgentKeys))
        {
            options.enabledAgentKeys = enabledAgentKeys;
        }

        return orchestrator.process(message, context, options);
    }
}

export { ResearchAIChatBridge, buildWorkspaceContext, flattenAttachedDoc };
