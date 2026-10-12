const ChatMessage = require("../models/chatMessageModel");
const { normalizeQueryText } = require("../models/chatMessageModel");

// Get messages for a workspace. Passing workspaceId alone loads the whole
// workspace's chat (like the Search Timeline) — starting a new query doesn't
// make prior chat vanish. Passing workspaceId + queryText together scopes to
// just that topic (used by the Workspace Details page, where clicking a
// different past topic in the sidebar should show that topic's own thread).
// Falls back to queryText/queryId matching only for callers that can't yet
// supply a workspaceId.
const getAllMessages = async (req, res) => {
    try
    {
        const { queryText, queryId, workspaceId } = req.query;
        const hasQueryId = queryId !== undefined && queryId !== null && String(queryId).trim() !== "";
        const hasQueryText = queryText !== undefined && queryText !== null;
        const hasWorkspaceId = workspaceId !== undefined && workspaceId !== null && String(workspaceId).trim() !== "";

        if (!hasWorkspaceId && !hasQueryId && !hasQueryText)
        {
            return res.status(400).json({
                message: "Provide workspaceId, queryId, or queryText to load chat"
            });
        }

        let filter;
        if (hasWorkspaceId)
        {
            filter = { workspaceId: String(workspaceId).trim() };

            // Also scope to a topic when the caller asks for one.
            if (hasQueryText)
            {
                const normalized = normalizeQueryText(queryText);
                if (!normalized)
                {
                    return res.status(400).json({ message: "queryText (search topic) cannot be empty" });
                }
                filter.queryText = normalized;
            }
        }
        else if (hasQueryText)
        {
            const normalized = normalizeQueryText(queryText);
            if (!normalized)
            {
                return res.status(400).json({ message: "queryText (search topic) cannot be empty" });
            }
            filter = { queryText: normalized };
        }
        else
        {
            // Backward compatibility fallback when older clients send only queryId.
            filter = { queryId: String(queryId).trim() };
        }

        const msgs = await ChatMessage.find(filter).sort({ createdAt: 1 });
        res.status(200).json(msgs);
    }
    catch (error)
    {
        console.error(error);
        res.status(500).json({ message: "Unable to fetch messages" });
    }
};

// Getting Messages for a User
const getMessagesByUsername = async (req, res) => {
    try
    {
        const {username} = req.params;
        if (!username)
        {
            return res.status(400).json({message: "Username is required"});
        }
        const msgs = await ChatMessage.find({username}).sort({createdAt: 1});
        res.status(200).json(msgs);
    }
    catch (error)
    {
        console.error(error);
        res.status(500).json({message: "Unable to fetch messages"});
    }
};

// Save message to this search topic's chat (normalized queryText) shared across users/workspaces
const saveMessage = async (req, res) => {
    try 
    {
        const { workspaceId, queryText, queryId, username, userIndex, text, createdAt, docRefs, agentKey, suggestedQueries } = req.body;
        if (queryText === undefined || queryText === null)
        {
            return res.status(400).json({ message: "queryText (search topic) is required" });
        }
        if (!username || !text || userIndex === undefined)
        {
            return res.status(400).json({ message: "Missing required fields: username, text, userIndex" });
        }
        const normalized = normalizeQueryText(queryText);
        if (!normalized) 
        {
            return res.status(400).json({ message: "queryText (search topic) cannot be empty" });
        }
        const msg = await ChatMessage.create({
            workspaceId: workspaceId || null,
            queryText: normalized,
            queryId: queryId || null,
            username,
            userIndex,
            text,
            docRefs,
            agentKey: agentKey || null,
            suggestedQueries,
            createdAt: createdAt || new Date()
        });
        res.status(201).json(msg);
    } 
    catch (error) 
    {
        console.error(error);
        res.status(500).json({ message: "Unable to save message" });
    }
};

// Delete Message
const deleteMessage = async (req, res) =>
{
    try
    {
        const {messageId} = req.params;
        const {username} = req.body;
        
        if (!messageId)
        {
            return res.status(400).json({message: "Message ID is required"});
        }
        
        if (!username)
        {
            return res.status(400).json({message: "Username is required"});
        }
        
        const msg = await ChatMessage.findById(messageId);
        
        if (!msg)
        {
            return res.status(404).json({message: "Message not found"});
        }
        
        if (msg.username !== username)
        {
            return res.status(403).json({message: "You can only delete your own messages"});
        }
        
        await ChatMessage.findByIdAndDelete(messageId);
        res.status(200).json({message: "Message deleted successfully"});
    }
    catch (error)
    {
        console.error(error);
        res.status(500).json({message: "Unable to delete message"});
    }
};

module.exports = 
{
    saveMessage, 
    getMessagesByUsername, 
    getAllMessages,
    deleteMessage
};