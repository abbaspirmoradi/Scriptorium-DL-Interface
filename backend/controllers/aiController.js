const Workspace = require('../models/workspaceModel');
const Query = require('../models/queryModel');
const Document = require('../models/documentModel');
const ChatMessage = require('../models/chatMessageModel');

const { AIOrchestrator } = require('../ai/AIOrchestrator');
const MockLLMProvider = require('../ai/MockLLMProvider');

// Single shared orchestrator instance for the process
const llmProvider = new MockLLMProvider();
const orchestrator = new AIOrchestrator(llmProvider, {
  confidenceThreshold: 0.7
});

// Flatten a raw catalog doc (pnx shape) attached to THIS message into the flat
// {title, abstract, authors, date, type} shape the orchestrator's ARIA/MINERVA/
// CLIO scopes expect. Mirrors flattenAttachedDoc in frontend aiChatBridge.js.
function flattenAttachedDoc(doc) 
{
  const title = doc?.pnx?.display?.title?.[0] || doc?.pnx?.display?.title || doc?.title || 'Untitled';
  const abstract = doc?.pnx?.addata?.abstract?.[0] || doc?.pnx?.addata?.abstract || doc?.doc_abstract || doc?.abstract || '';
  const rawAuthors = doc?.pnx?.addata?.au || doc?.pnx?.addata?.addau || doc?.doc_authors || doc?.authors || [];
  const authors = Array.isArray(rawAuthors) ? rawAuthors.join(', ') : String(rawAuthors || '');
  const date = doc?.pnx?.display?.creationdate?.[0] || doc?.pnx?.display?.creationdate || doc?.doc_date || doc?.date || '';
  const type = doc?.pnx?.display?.type?.[0] || doc?.pnx?.display?.type || doc?.doc_type || doc?.type || '';

  return { title, abstract, authors, date: String(date || ''), type: String(type || '') };
}

/**
 * Build the SAME six scoped slices the frontend bridge builds, so the mirrored
 * orchestrator's buildScopedInput() and preflight() receive exactly the input
 * they expect. Shapes must match aiChatBridge.js:
 *   attachedDocs, queryHistory, savedDocs, deletedDocs, activityByUser, conversation
 */
async function buildWorkspaceContext({ workspaceId, username, attachedDocs, recentMessages }) 
{
  const flatAttached = Array.isArray(attachedDocs) ? attachedDocs.map(flattenAttachedDoc) : [];

  const emptySlices = {
    workspace: null,
    attachedDocs: flatAttached,
    queryHistory: [],
    savedDocs: [],
    deletedDocs: [],
    activityByUser: {},
    conversation: []
  };

  if (!workspaceId) return emptySlices;

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return emptySlices;

  // Queries for this workspace (populate username for per-user activity)
  const queries = await Query.find({ workspaceId })
    .populate({ path: 'userId', select: 'username', model: 'User' })
    .sort({ createdAt: 1 });
  const queryIds = queries.map((q) => q._id);

  const documents = await Document.find({ queryId: { $in: queryIds } })
    .populate({ path: 'userId', select: 'username', model: 'User' })
    .sort({ createdAt: 1 });

  // queryHistory — every search query, with resilient username
  const queryHistory = queries
    .map((q) => ({
      query: q.query || '',
      username: q.username || q.userId?.username || 'Unknown',
      createdAt: q.createdAt || null
    }))
    .filter((q) => q.query);

  // Split saved vs deleted, deduped by catalog record id
  const seen = new Set();
  const savedDocs = [];
  const deletedDocs = [];
  documents.forEach((d) => {
    const recordId = (d.documentId || '').toString();
    const mongoId = (d._id || '').toString();
    const key = recordId ? `rec:${recordId}` : mongoId ? `id:${mongoId}` : null;
    if (!key || seen.has(key)) return;
    seen.add(key);

    const entry = {
      title: d.title || 'Untitled',
      abstract: d.doc_abstract || '',
      authors: Array.isArray(d.doc_authors) ? d.doc_authors.join(', ') : String(d.doc_authors || ''),
      date: String(d.doc_date || ''),
      username: d.username || d.userId?.username || 'Unknown',
      savedAt: d.createdAt || null,
      isRemoved: !!d.doc_isRemoved
    };
    (entry.isRemoved ? deletedDocs : savedDocs).push(entry);
  });

  // activityByUser — per-collaborator queries + active saved titles (JANUS)
  const activityByUser = {};
  const ensureUser = (name) => {
    const u = name || 'Unknown';
    if (!activityByUser[u]) activityByUser[u] = { queries: [], savedTitles: [] };
    return activityByUser[u];
  };
  queries.forEach((q) => {
    const qUser = q.username || q.userId?.username || 'Unknown';
    if (q.query) ensureUser(qUser).queries.push(q.query);
  });
  documents.forEach((d) => {
    if (d.doc_isRemoved) return;
    const dUser = d.username || d.userId?.username || 'Unknown';
    ensureUser(dUser).savedTitles.push(d.title || 'Untitled');
  });

  // conversation — last turns for follow-up reference resolution only. Prefer
  // caller-supplied recentMessages (full thread); else this workspace's stored chats.
  let conversation = [];
  if (Array.isArray(recentMessages) && recentMessages.length > 0) 
  {
    conversation = recentMessages.slice(-12).map((m) => ({
      speaker: m.username || 'Unknown',
      isAI: !!m.isAIMessage,
      text: m.text || '',
      createdAt: m.createdAt || null
    }));
  } 
  else 
  {
    const chatHistory = await ChatMessage.find({ workspaceId }).sort({ createdAt: -1 }).limit(12);
    conversation = chatHistory.reverse().map((m) => ({
      speaker: m.username || 'Unknown',
      isAI: !!m.isAIMessage,
      text: m.text || '',
      createdAt: m.createdAt || null
    }));
  }

  return {
    workspace,
    attachedDocs: flatAttached,
    queryHistory,
    savedDocs,
    deletedDocs,
    activityByUser,
    conversation
  };
}


/**
 * POST /api/ai/chat
 * Body: { message, workspaceId?, queryId?, userId?, username?, agentKey? }
 */
const handleAIChat = async (req, res) => {
  const { message, workspaceId, queryId, queryText, username, agentKey, attachedDocs, recentMessages, enabledAgentKeys } = req.body || {};

  if (!message || typeof message !== 'string') 
  {
    return res.status(400).json({ success: false, error: 'message is required' });
  }

  // Default: the six scoped slices, all empty. buildScopedInput/preflight read these.
  let context = {
    attachedDocs: Array.isArray(attachedDocs) ? attachedDocs.map(flattenAttachedDoc) : [],
    queryHistory: [],
    savedDocs: [],
    deletedDocs: [],
    activityByUser: {},
    conversation: [],
    workspace: { id: workspaceId || null, queryId: queryId || null, queryText: queryText || null }
  };

  try 
  {
    const wc = await buildWorkspaceContext({ workspaceId, username, attachedDocs, recentMessages });

    context = {
      attachedDocs: wc.attachedDocs,
      queryHistory: wc.queryHistory,
      savedDocs: wc.savedDocs,
      deletedDocs: wc.deletedDocs,
      activityByUser: wc.activityByUser,
      conversation: wc.conversation,
      workspace: {
        id: wc.workspace ? wc.workspace._id.toString() : (workspaceId || null),
        name: wc.workspace ? wc.workspace.name : null,
        queryId: queryId || null,
        queryText: queryText || null
      }
    };
  } 
  catch (error) 
  {
    // If context building fails, log but still allow the orchestrator to run with empty slices
    console.error('Error building workspace context for AI:', error);
  }

  try 
  {
    const options = {};
    if (agentKey && agentKey !== 'manager') options.explicitAgentKey = agentKey;
    if (Array.isArray(enabledAgentKeys)) options.enabledAgentKeys = enabledAgentKeys;

    const result = await orchestrator.process(message, context, options);

    return res.status(200).json({
      success: true,
      result
    });
  } 
  catch (error) 
  {
    console.error('AI orchestrator error:', error);
    return res.status(500).json({
      success: false,
      error: 'AI Orchestrator failed to process the request.'
    });
  }
};

/**
 * GET /api/ai/agents
 * Returns lightweight registry of available agents for UI selection.
 */
const getAgents = (req, res) => {
  const agents = orchestrator.getAgentsMetadata();
  return res.status(200).json({
    success: true,
    agents
  });
};

module.exports = {
  handleAIChat,
  getAgents
};