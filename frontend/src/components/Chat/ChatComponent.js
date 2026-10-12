import React, { useState, useEffect, useRef } from "react";
import CloseIcon from "@mui/icons-material/Close";
import HubIcon from "@mui/icons-material/Hub";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import ExploreIcon from "@mui/icons-material/Explore";
import PsychologyIcon from "@mui/icons-material/Psychology";
import ScienceIcon from "@mui/icons-material/Science";
import GavelIcon from "@mui/icons-material/Gavel";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import TuneIcon from "@mui/icons-material/Tune";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import styles from "./Chat.module.css";
import axios from 'axios'
import { ResearchAIChatBridge } from "../../services/aiChatBridge";
import {
    USER_COLOURS,
    getColorIndexForUsername,
    isHumanChatParticipant,
} from "../../colours/userColors";

const chat_backend_url = "http://localhost:5006/api/chat";

// Suggestions in AI mode, user can press Tab key to accept suggestion
const AI_SUGGESTIONS = [
    "reformulate my query",
    "summarize these documents",
    "summarize the results",
    "compare these documents",
    "gap analysis",
    "identify knowledge gaps",
    "help me refine my query",
    "give me an overview of these papers",
    "format these as citations",
    "extract the methodology",
];

// The five named archival agents. `key` matches backend/ai/AIOrchestrator.js
// and frontend/src/services/aiOrchestrator.js — keep all three in sync.
const AGENTS = [
    { key: "aria", name: "ARIA", role: "Synthesizer", symbol: "A", hex: "#4f46e5", Icon: HubIcon, description: "Summarizes exactly the documents you attach — drag papers in, then ask." },
    { key: "clio", name: "CLIO", role: "Citations", symbol: "C", hex: "#0891b2", Icon: FormatQuoteIcon, description: "Formats citations for attached documents (or your saved set)." },
    { key: "hermes", name: "HERMES", role: "Navigator", symbol: "H", hex: "#059669", Icon: ExploreIcon, description: "Suggests 5 clickable search queries built from this workspace's history." },
    { key: "socrates", name: "SOCRATES", role: "Critic", symbol: "S", hex: "#d97706", Icon: PsychologyIcon, description: "Finds gaps across the whole workspace: every query, saved and deleted doc." },
    { key: "minerva", name: "MINERVA", role: "Methods", symbol: "M", hex: "#7c3aed", Icon: ScienceIcon, description: "Extracts research design, sample, and analysis from attached documents." },
    { key: "momus", name: "MOMUS", role: "Counterpoint", symbol: "Ω", hex: "#be123c", Icon: GavelIcon, description: "Challenges the group's consensus — surfaces contradictions and counter-evidence." },
    { key: "janus", name: "JANUS", role: "Bridge", symbol: "J", hex: "#0d9488", Icon: CompareArrowsIcon, description: "Connects collaborators' research threads and proposes bridging searches." },
];
const AGENT_BY_KEY = Object.fromEntries(AGENTS.map((a) => [a.key, a]));
const DEFAULT_ENABLED_AGENTS = Object.fromEntries(AGENTS.map((a) => [a.key, true]));

// function to normalize query text
function normalizeQueryText(str) {
    if (str == null || typeof str !== 'string') return '';
    return str.trim().toLowerCase();
}

const chatService = {
    // Chat history belongs to the whole workspace by default (stays visible
    // across new searches), unless a topic is passed — the Workspace Details
    // page scopes to whichever topic is selected in its sidebar.
    fetchMessages: async (workspaceId, queryText) => {
        if (!workspaceId)
            return [];

        const normalized = normalizeQueryText(queryText);
        const params = normalized ? { workspaceId, queryText: normalized } : { workspaceId };

        const res = await axios.get(chat_backend_url, { params });
        return res.data;
    },
    sendMessage: async (message) => {
        const res = await axios.post(chat_backend_url, message);
        return res.data;
    },
    deleteMessage: async (messageId, username) => {
        const res = await axios.delete(`${chat_backend_url}/${messageId}`, { data: { username } });
        return res.data;
    }
};

// Check if Puter AI is available in the browser (reserved for future UI gating)
// const isPuterAIAvailable = typeof window !== 'undefined' && window.puter?.ai;

const aiChatBridge = new ResearchAIChatBridge();

function ChatComponent ({ currentUsername, currentUserIndex = 0, documents = [], workspaceHistory = null, workspaceId = null, queryId = null, queryText = null, currentUserId = null, onRunSuggestedQuery = null, scopeChatToTopic = false, hideAgentsPanel = false })
{
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isAIMode, setIsAIMode] = useState(false);
    const [isAILoading, setIsAILoading] = useState(false);
    const [selectedDocuments, setSelectedDocuments] = useState([]);
    const [isDragOverDropZone, setIsDragOverDropZone] = useState(false);
    const [selectedAgentKey, setSelectedAgentKey] = useState('manager');
    const [enabledAgents, setEnabledAgents] = useState(DEFAULT_ENABLED_AGENTS);
    const [showAgentPanel, setShowAgentPanel] = useState(false);
    const messagesEndRef = useRef(null);
    const messagesBoxRef = useRef(null);
    const previousMessagesLengthRef = useRef(0);
    const isUserScrolledUpRef = useRef(false);

    // Check if user is near the bottom of the chat
    const isNearBottom = () => {
        if (!messagesBoxRef.current) return true;
        const { scrollTop, scrollHeight, clientHeight } = messagesBoxRef.current;
        
        // Consider near bottom if within 100px at the bottom
        const threshold = 100;
        return scrollHeight - scrollTop - clientHeight < threshold;
    };

    // Scroll to bottom function
    const scrollToBottom = (smooth = true) => {
        if (messagesEndRef.current) 
        {
            messagesEndRef.current.scrollIntoView({ 
                behavior: smooth ? "smooth" : "auto",
                block: "end"
            });
        }
    };

    // Handle scroll events to track if user manually scrolled up
    const handleScroll = () => {
        if (messagesBoxRef.current) 
        {
            isUserScrolledUpRef.current = !isNearBottom();
        }
    };

    // Scroll to bottom on initial load
    useEffect(() => {
        if (messages.length > 0 && previousMessagesLengthRef.current === 0) 
        {
            // Initial load - scroll to bottom immediately without smooth animation
            setTimeout(() => {
                scrollToBottom(false);
            }, 100);
        }
        previousMessagesLengthRef.current = messages.length;
    }, [messages.length]);

    // Auto-scroll when new messages arrive (only if user is at bottom)
    useEffect(() => {
        const currentLength = messages.length;
        const previousLength = previousMessagesLengthRef.current;
        
        // If new messages were added
        if (currentLength > previousLength) 
        {
            // Check if user is near bottom or if it's a new message from current user
            const isNewMessageFromCurrentUser = currentLength > previousLength && 
                messages[currentLength - 1]?.username === currentUsername;
            
            // Auto-scroll if:
            // - User is near bottom, OR
            // - It's a message from the current user (they just sent it)
            if (isNearBottom() || isNewMessageFromCurrentUser || !isUserScrolledUpRef.current) 
            {
                setTimeout(() => {
                    scrollToBottom(true);
                    isUserScrolledUpRef.current = false;
                }, 100);
            }
        }
    }, [messages, currentUsername]);

    // Fetch messages for this workspace. By default scoped to the whole
    // workspace (not the current query/topic) so chat persists across new
    // searches — but scopeChatToTopic lets a page (e.g. Workspace Details,
    // which lets you click between past topics) re-scope chat to whichever
    // topic is currently selected. Poll so others see messages live.
    const topicScopeKey = scopeChatToTopic ? normalizeQueryText(queryText) : null;
    useEffect(() => {
        if (!workspaceId || (scopeChatToTopic && !topicScopeKey))
        {
            setMessages([]);
            return;
        }

        setMessages([]); // clear when switching workspace (or topic, when scoped)
        let previousLength = 0;

        async function fetchMessages() {
            try
            {
                const res = await chatService.fetchMessages(workspaceId, scopeChatToTopic ? queryText : undefined);
                const currentLength = Array.isArray(res) ? res.length : 0;

                if (currentLength !== previousLength)
                {
                    const wasNearBottom = isNearBottom();
                    setMessages(Array.isArray(res) ? res : []);

                    if (currentLength > previousLength && wasNearBottom && !isUserScrolledUpRef.current)
                    {
                        setTimeout(() => {
                            scrollToBottom(true);
                            isUserScrolledUpRef.current = false;
                        }, 100);
                    }
                    previousLength = currentLength;
                }
            }
            catch (error)
            {
                console.error("Failed to fetch chat messages:", error);
            }
        }
        fetchMessages();
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
        // queryText intentionally excluded — topicScopeKey (derived from it, only
        // when scopeChatToTopic) is the real trigger, so unscoped pages don't
        // refetch/flash on every new query.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId, scopeChatToTopic, topicScopeKey]);

    // Get the "query part" of input after the @-command (e.g. "@ai " -> "", "@aria ref" -> "ref")
    const getQueryPart = (value) => {
        const v = value || '';
        const patterns = [/^@ai\s*/i, /^@aria\s*/i, /^@clio\s*/i, /^@hermes\s*/i, /^@socrates\s*/i, /^@minerva\s*/i, /^@momus\s*/i, /^@janus\s*/i];
        let rest = v;
        for (const p of patterns) 
        {
            const match = rest.match(p);
            if (match) 
            {
                rest = rest.slice(match[0].length);
                break;
            }
        }
        return rest;
    };

    const agentKeyToMention = (agentKey) => {
        if (AGENT_BY_KEY[agentKey]) return `@${agentKey}`;
        return '@ai';
    };

    const mentionToAgentKey = (value) => {
        const lower = String(value || '').trim().toLowerCase();
        for (const agent of AGENTS) 
        {
            if (lower.startsWith(`@${agent.key}`)) return agent.key;
        }
        if (lower.startsWith('@ai')) return 'manager';
        return null;
    };

    // While the user is still typing the mention token itself (e.g. "@", "@ar"),
    // return the partial text so we can show a filtered agent picker. Returns
    // null once a space follows the mention (they've moved on to the message body).
    const getMentionQuery = (value) => {
        const v = value || '';
        const match = v.match(/^@(\w*)$/);
        return match ? match[1].toLowerCase() : null;
    };

    const insertAgentMention = (agentKey) => {
        setInput(`${agentKeyToMention(agentKey)} `);
        setIsAIMode(true);
        setSelectedAgentKey(agentKey);
    };

    // Active-agent selection: which agents are eligible for @mention /
    // drag-to-card / manager auto-routing right now. When the Agents panel
    // is hidden (Workspace Details), every agent is always active.
    const activeAgents = hideAgentsPanel ? AGENTS : AGENTS.filter((agent) => enabledAgents[agent.key]);

    const toggleAgentEnabled = (agentKey) => {
        setEnabledAgents((prev) => {
            const next = { ...prev, [agentKey]: !prev[agentKey] };
            // If the currently selected agent just got disabled, fall back to auto-routing
            if (!next[agentKey] && selectedAgentKey === agentKey)
            {
                setSelectedAgentKey('manager');
            }
            return next;
        });
    };

    const enableAllAgents = () => setEnabledAgents(DEFAULT_ENABLED_AGENTS);

    const resetAgents = () => {
        setEnabledAgents(Object.fromEntries(AGENTS.map((a) => [a.key, false])));
        setSelectedAgentKey('manager');
    };

    // Get suggestion suffix when in AI mode: first suggestion that starts with the query part (light-gray until Tab accept)
    const getSuggestion = (queryPart) => {
        if (!queryPart || !queryPart.length) 
            return null;

        const q = queryPart.toLowerCase();
        for (const s of AI_SUGGESTIONS) 
        {
            if (s.toLowerCase().startsWith(q) && s.length > q.length) 
            {
                return { full: s, suffix: s.slice(q.length) };
            }
        }
        return null;
    };

    // Handling @-agent detection and AI mode

    const handleInputChange = (e) => {
        const value = e.target.value;
        setInput(value);

        const detectedAgentKey = mentionToAgentKey(value);
        if (detectedAgentKey) 
        {
            setIsAIMode(true);
            setSelectedAgentKey(detectedAgentKey);
        } 
        else if ((value || '').trim() === '') 
        {
            setIsAIMode(false);
            setSelectedAgentKey('manager');
            // Only clear selected docs when the user fully empties the message
            setSelectedDocuments([]);
        }
        else
        {
            // Keep any dropped documents selected while the user types a regular message
            setIsAIMode(false);
            setSelectedAgentKey('manager');
        }
    };

    // Tab to accept suggestion: append suffix to input so it becomes normal text (same color)
    const handleInputKeyDown = (e) => {
        if (e.key === 'Enter' && !isAILoading && isPageScoped) 
        {
            e.preventDefault();
            sendMessage();
            return;
        }
        if (e.key === 'Tab' && isAIMode) 
        {
            const queryPart = getQueryPart(input);
            const suggestion = getSuggestion(queryPart);

            if (suggestion && suggestion.suffix) 
            {
                e.preventDefault();
                const prefix = input.slice(0, input.length - queryPart.length);
                setInput(prefix + suggestion.full);
            }
        }
    };

    const findDocumentByRecordId = (recordId) => 
    {
        if (!recordId || !Array.isArray(documents)) 
            return null;

        return documents.find((doc) => 
        {
            const id = doc?.pnx?.control?.recordid;             // note: chaining is used here to access the recordid property of the document
            if (Array.isArray(id)) 
            {
                return id[0] === recordId;
            }
            return id === recordId;
        });
    };

    const addSelectedDocument = (doc) => 
    {
        if (!doc) 
            return;

        const recordId = Array.isArray(doc?.pnx?.control?.recordid) 
            ? doc.pnx.control.recordid[0] 
            : doc?.pnx?.control?.recordid;
        
        if (!recordId) 
            return;

        setSelectedDocuments((prev) => 
        {
            // Avoid duplicates
            const alreadyExists = prev.some((item) => 
            {
                const existingId = Array.isArray(item?.pnx?.control?.recordid) 
                    ? item.pnx.control.recordid[0] 
                    : item?.pnx?.control?.recordid;
                return existingId === recordId;
            });
            if (alreadyExists) 
                return prev;

            return [...prev, doc];
        });
    };

    const getSelectedDocRefs = () => {
        if (!Array.isArray(selectedDocuments) || selectedDocuments.length === 0) return [];

        return selectedDocuments
            .map((doc) => {
                const title = doc?.pnx?.display?.title?.[0] || doc?.pnx?.display?.title || 'Untitled';
                const authors = doc?.pnx?.addata?.au
                    ? (Array.isArray(doc.pnx.addata.au) ? doc.pnx.addata.au.join(', ') : doc.pnx.addata.au)
                    : (doc?.pnx?.addata?.addau
                        ? (Array.isArray(doc.pnx.addata.addau) ? doc.pnx.addata.addau.join(', ') : doc.pnx.addata.addau)
                        : 'Unknown authors');

                return {
                    title,
                    authors: authors || 'Unknown authors'
                };
            })
            .filter((ref) => ref && ref.title);
    };

    const removeSelectedDocument = (indexToRemove) => {
        setSelectedDocuments((prev) => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleDragOver = (event) => 
    {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setIsDragOverDropZone(true);
    };

    const handleDragLeave = (event) => 
    {
        event.preventDefault();
        setIsDragOverDropZone(false);
    };

    const handleDrop = (event) => 
    {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOverDropZone(false);

        try 
        {
            const recordId = event.dataTransfer.getData('application/x-search-doc-recordid');
            if (recordId) 
            {
                const doc = findDocumentByRecordId(recordId);
                if (doc) 
                {
                    addSelectedDocument(doc);
                    return;
                }
            }

            const jsonPayload = event.dataTransfer.getData('application/json');     // note: payload of the document that is being dragged
            if (jsonPayload) 
            {
                try 
                {
                    const parsed = JSON.parse(jsonPayload);
                    if (parsed && parsed.type === 'search-doc' && parsed.payload?.recordId) 
                    {
                        const doc = findDocumentByRecordId(parsed.payload.recordId);
                        if (doc) 
                        {
                            addSelectedDocument(doc);
                        }
                    }
                } 
                catch (jsonError) 
                {
                    console.error("Failed to parse dropped document JSON:", jsonError);
                }
            }
        } 
        catch (error)
        {
            console.error("Error handling document drop:", error);
        }
    };

    // Dropping a document directly onto an agent card in the Agents panel:
    // adds the doc to the outgoing message AND activates + selects that agent,
    // enabling it first if it was toggled off.
    const handleAgentCardDrop = (event, agentKey) =>
    {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOverDropZone(false);

        let droppedDoc = null;
        try
        {
            const recordId = event.dataTransfer.getData('application/x-search-doc-recordid');
            if (recordId)
            {
                droppedDoc = findDocumentByRecordId(recordId);
            }
            if (!droppedDoc)
            {
                const jsonPayload = event.dataTransfer.getData('application/json');
                if (jsonPayload)
                {
                    const parsed = JSON.parse(jsonPayload);
                    if (parsed && parsed.type === 'search-doc' && parsed.payload?.recordId)
                    {
                        droppedDoc = findDocumentByRecordId(parsed.payload.recordId);
                    }
                }
            }
        }
        catch (error)
        {
            console.error("Error handling document drop on agent card:", error);
        }

        if (droppedDoc) addSelectedDocument(droppedDoc);

        setEnabledAgents((prev) => (prev[agentKey] ? prev : { ...prev, [agentKey]: true }));
        insertAgentMention(agentKey);
        setShowAgentPanel(false);
    };

    const sendMessage = async () =>
    {
        if (input.trim() === "")
            return;

        if (!currentUsername || currentUsername.trim() === "")
        {
            console.error("Cannot send message: username is missing");
            return;
        }

        const inputText = input.trim();
        const docRefs = getSelectedDocRefs();
        const docRefsForMsg = docRefs.length > 0 ? docRefs : undefined;
        const lowerInput = inputText.toLowerCase();
        const isAIMessage =
            // Only treat as AI when the user explicitly invoked it via @-mention in the textbox
            lowerInput.startsWith('@ai') ||
            AGENTS.some((agent) => lowerInput.startsWith(`@${agent.key.toLowerCase()}`));

        // If AI is requested, handle with AI bridge/proxy (browser-side)
        if (isAIMessage) 
        {
            setIsAILoading(true);

            const calculatedUserIndex = getColorIndexForUsername(currentUsername);
            
            // Add user message to chat
            const userMsg = 
            {
                username: currentUsername,
                userIndex: calculatedUserIndex,
                text: inputText,
                docRefs: docRefsForMsg,
                createdAt: new Date().toISOString(),
                isAIMessage: false
            };
            
            // Add user message immediately
            setMessages(prev => [...prev, userMsg]);
            
            try 
            {
                // STRICT SCOPING: only explicitly attached (dragged) documents
                // are sent as attachedDocs. There is deliberately NO fallback
                // to page results — ARIA refuses when nothing is attached.
                const typedAgentKey = mentionToAgentKey(inputText);
                const explicitAgentKey =
                    typedAgentKey === "manager" && selectedAgentKey && selectedAgentKey !== "manager"
                        ? selectedAgentKey
                        : undefined;

                const aiResult = await aiChatBridge.sendResearchRequest({
                    message: inputText,
                    attachedDocs: selectedDocuments,
                    workspaceHistory,
                    workspaceId,
                    queryId,
                    queryText,
                    explicitAgentKey,
                    enabledAgentKeys: activeAgents.map((a) => a.key),
                    recentMessages: [...messages, userMsg]
                });

                const responseText =
                    aiResult?.content ||
                    "Sorry, I could not produce a response.";

                let aiUsername = "Research Manager";
                let aiAgentKey = null;
                if (aiResult?.type === "SUCCESS" && aiResult?.agentKey) 
                {
                    const agentMeta = AGENT_BY_KEY[aiResult.agentKey];
                    if (agentMeta) 
                    {
                        aiUsername = `${agentMeta.name} · ${agentMeta.role}`;
                        aiAgentKey = agentMeta.key;
                    }
                } 
                else if (aiResult?.type === "CLARIFICATION") 
                {
                    aiUsername = "Research Manager";
                } 
                else if (aiResult?.type === "ERROR") 
                {
                    aiUsername = "AI Assistant";
                }


                // Add AI response to chat
                const aiMsg = {
                    username: aiUsername,
                    userIndex: -1, // Special index for AI
                    agentKey: aiAgentKey,
                    text: responseText,
                    suggestedQueries: Array.isArray(aiResult?.suggestedQueries) ? aiResult.suggestedQueries : [],
                    createdAt: new Date().toISOString(),
                    isAIMessage: true
                };

                setMessages(prev => [...prev, aiMsg]);
                
                // Always scroll to bottom when AI responds
                setTimeout(() => {
                    scrollToBottom(true);
                    isUserScrolledUpRef.current = false;
                }, 100);
                
                // Persist AI exchange to this topic's chat so others searching the same topic see it
                const normalizedTopic = normalizeQueryText(queryText);
                if (workspaceId && normalizedTopic) 
                {
                    try 
                    {
                        await chatService.sendMessage({
                            workspaceId,
                            queryText: normalizedTopic,
                            queryId: queryId || undefined,
                            username: userMsg.username,
                            userIndex: userMsg.userIndex,
                            docRefs: userMsg.docRefs,
                            text: userMsg.text,
                            createdAt: userMsg.createdAt
                        });
                        await chatService.sendMessage({
                            workspaceId,
                            queryText: normalizedTopic,
                            queryId: queryId || undefined,
                            username: aiMsg.username,
                            userIndex: aiMsg.userIndex,
                            text: aiMsg.text,
                            agentKey: aiMsg.agentKey || undefined,
                            suggestedQueries: aiMsg.suggestedQueries?.length ? aiMsg.suggestedQueries : undefined,
                            createdAt: aiMsg.createdAt
                        });
                    } 
                    catch (backendError) 
                    {
                        console.warn("Failed to save AI messages to backend:", backendError);
                    }
                }
            } 
            catch (error) 
            {
                console.error("Puter AI error:", error);
                console.error("Error details:", {
                    message: error?.message,
                    error: error?.error,
                    success: error?.success
                });

                const errorMessage = error?.error || error?.message || "Sorry, I encountered an error. Please try again.";
                const errorMsg = {
                    username: "AI Assistant",
                    userIndex: -1,
                    text: `Error: ${errorMessage}`,
                    createdAt: new Date().toISOString(),
                    isAIMessage: true,
                    isError: true
                };
                setMessages(prev => [...prev, errorMsg]);
            } 
            finally 
            {
                setIsAILoading(false);
                setInput("");
                setIsAIMode(false);
                setSelectedAgentKey("manager");
                setSelectedDocuments([]);       // Clear selected documents after  AI interaction completes
            }
            return;
        }

        // Regular chat message handling - same palette as typing, refs, AI prompt, and History
        const calculatedUserIndex = getColorIndexForUsername(currentUsername);
        const normalizedTopic = normalizeQueryText(queryText);
        const newMsg = {
            workspaceId: workspaceId || '',
            queryText: normalizedTopic || '',
            queryId: queryId || undefined,
            username: currentUsername,
            userIndex: calculatedUserIndex,
            text: inputText,
            docRefs: docRefsForMsg,
            createdAt: new Date().toISOString(),
            isAIMessage: false
        };

        if (!workspaceId || !normalizedTopic) 
        {
            console.warn("Chat is scoped to this search topic. workspaceId and queryText are required.");
            return;
        }

        try 
        {
            await chatService.sendMessage(newMsg);
            setMessages(prev => [...prev, newMsg]);
            // Always scroll to bottom when user sends their own message
            setTimeout(() => {
                scrollToBottom(true);
                isUserScrolledUpRef.current = false;
            }, 100);
            setInput("");
            setIsAIMode(false);
            // Clear after successful send so future messages don't keep referencing old drops
            setSelectedDocuments([]);
        }
        catch (error)
        {
            console.error("Failed to send message: ", error);
            if (error.response)
            {
                console.error("Error response data:", error.response.data);
                console.error("Error response status:", error.response.status);
            }
        }
    };

    const deleteMessage = async (messageId) =>
    {
        if (!currentUsername || currentUsername.trim() === "")
        {
            console.error("Cannot delete message: username is missing");
            return;
        }

        try
        {
            await chatService.deleteMessage(messageId, currentUsername);
            setMessages(prev => prev.filter(msg => msg._id !== messageId));
        }
        catch (error)
        {
            console.error("Failed to delete message: ", error);
            if (error.response)
            {
                console.error("Error response data:", error.response.data);
                console.error("Error response status:", error.response.status);
            }
        }
    };

    const isPageScoped = Boolean(workspaceId && normalizeQueryText(queryText));

    return (
        <div className={styles.chatContainer}>
            <div className={styles.titleRow}>
                <h3 className={styles.title}>
                    <ChatBubbleOutlineIcon style={{ fontSize: 14 }} />
                    Chat
                </h3>
                {!hideAgentsPanel && (
                    <button
                        type="button"
                        className={`${styles.agentsToggleBtn} ${showAgentPanel ? styles.agentsToggleBtnActive : ''}`}
                        onClick={() => setShowAgentPanel((s) => !s)}
                        aria-pressed={showAgentPanel}
                    >
                        <TuneIcon style={{ fontSize: 13 }} />
                        Agents
                        {showAgentPanel ? <KeyboardArrowUpIcon style={{ fontSize: 15 }} /> : <KeyboardArrowDownIcon style={{ fontSize: 15 }} />}
                    </button>
                )}
            </div>
            {!isPageScoped && (
                <p className={styles.hint} style={{ fontSize: '0.85rem', color: '#666', margin: '0.5rem 0' }}>
                    Chat is tied to each search topic. Open a search result page to talk with others on that topic.
                </p>
            )}

            {!hideAgentsPanel && showAgentPanel ? (
                <div className={styles.agentPanel}>
                    <p className={styles.agentPanelHint}>Select active agents — drag documents to a card or @mention in chat</p>
                    <div className={styles.agentCardList}>
                        {AGENTS.map((agent) => {
                            const isOn = enabledAgents[agent.key];
                            return (
                                <div
                                    key={agent.key}
                                    className={styles.agentCard}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleAgentCardDrop(e, agent.key)}
                                >
                                    <span className={styles.agentCardAvatar} style={{ background: agent.hex }}>
                                        <agent.Icon style={{ fontSize: 16, color: '#fff' }} />
                                    </span>
                                    <div className={styles.agentCardBody}>
                                        <div className={styles.agentCardHeader}>
                                            <span className={styles.agentCardName}>{agent.name}</span>
                                            <span className={styles.roleBadge} style={{ color: agent.hex, background: `${agent.hex}14`, borderColor: `${agent.hex}33` }}>
                                                {agent.role}
                                            </span>
                                        </div>
                                        <p className={styles.agentCardDesc}>{agent.description}</p>
                                    </div>
                                    <button
                                        type="button"
                                        className={`${styles.agentToggle} ${isOn ? styles.agentToggleOn : ''}`}
                                        style={isOn ? { background: agent.hex, borderColor: agent.hex } : undefined}
                                        onClick={() => toggleAgentEnabled(agent.key)}
                                        aria-pressed={isOn}
                                        title={isOn ? `Turn off ${agent.name}` : `Turn on ${agent.name}`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <div className={styles.agentPanelActions}>
                        <button type="button" className={styles.agentPanelActionBtn} onClick={enableAllAgents}>All on</button>
                        <button type="button" className={styles.agentPanelActionBtn} onClick={resetAgents}>Reset</button>
                    </div>
                </div>
            ) : (
            <>
            <div className={styles.messagesBoxWrapper}>
                <div
                    className={styles.messagesBox}
                    ref={messagesBoxRef}
                    onScroll={handleScroll}
                >
                    {messages.map((msg, i) => {
                            const isAgentMsg = msg.isAIMessage === true;
                            const agentMeta = isAgentMsg ? AGENT_BY_KEY[msg.agentKey] : null;
                            const isOwnMessage = msg.username === currentUsername;

                            let colorIndex;
                            if (!isHumanChatParticipant(msg.username, msg))
                            {
                                colorIndex = USER_COLOURS.length - 1;
                            } 
                            else 
                            {
                                colorIndex = msg.username
                                    ? getColorIndexForUsername(msg.username)
                                    : (msg.userIndex || 0);
                                colorIndex = Math.max(0, Math.min(colorIndex, USER_COLOURS.length - 1));
                            }
                            const userColor = USER_COLOURS[colorIndex];
                            const accentColor = agentMeta ? agentMeta.hex : userColor;

                            const bubbleClass = isOwnMessage
                                ? `${styles.message} ${styles.messageOwn}`
                                : isAgentMsg
                                    ? `${styles.message} ${styles.messageAgent}`
                                    : styles.message;

                            const timeLabel = new Date(msg.createdAt).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                            });
                            const shortTimeLabel = new Date(msg.createdAt).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: false
                            });

                            return (
                                <div
                                    key={msg._id || i}
                                    className={bubbleClass}
                                    style={isOwnMessage ? undefined : { borderLeftColor: accentColor }}
                                >
                                    <div className={styles.messageHeader}>
                                        <div className={styles.messageContent}>
                                            {isAgentMsg && agentMeta && (
                                                <span className={styles.agentHeaderRow}>
                                                    <span className={styles.agentAvatar} style={{ background: agentMeta.hex }}>
                                                        <agentMeta.Icon style={{ fontSize: 11, color: '#fff' }} />
                                                    </span>
                                                    <span className={styles.agentName} style={{ color: agentMeta.hex }}>
                                                        {agentMeta.name}
                                                    </span>
                                                    <span className={styles.roleBadge} style={{ color: agentMeta.hex, background: `${agentMeta.hex}14`, borderColor: `${agentMeta.hex}33` }}>
                                                        {agentMeta.role}
                                                    </span>
                                                    <span className={styles.agentHeaderTime}>{shortTimeLabel}</span>
                                                </span>
                                            )}
                                            {!isAgentMsg && (
                                                <span className={styles.user} style={{ color: isOwnMessage ? undefined : userColor }}>
                                                    {msg.username}:
                                                </span>
                                            )}
                                            <span className={styles.text}>
                                                {Array.isArray(msg.docRefs) && msg.docRefs.length > 0 && (
                                                    <>
                                                        {msg.docRefs.map((ref, idx) => (
                                                            <React.Fragment key={`${idx}-${ref?.title || 'doc'}`}>
                                                                <strong>{ref?.title || 'Untitled'}</strong>
                                                                {' — '}
                                                                <strong>{ref?.authors || 'Unknown authors'}</strong>
                                                                {idx < msg.docRefs.length - 1 ? <br /> : null}
                                                            </React.Fragment>
                                                        ))}
                                                        <br />
                                                        <br />
                                                    </>
                                                )}
                                                {msg.text}
                                            </span>
                                            {Array.isArray(msg.suggestedQueries) && msg.suggestedQueries.length > 0 && (
                                                <span className={styles.suggestedQueryList}>
                                                    {msg.suggestedQueries.map((q, qi) => (
                                                        <button
                                                            type="button"
                                                            key={`${qi}-${q}`}
                                                            className={styles.suggestedQueryChip}
                                                            title="Run this search"
                                                            onClick={() => onRunSuggestedQuery?.(q)}
                                                        >
                                                            <span className={styles.suggestedQueryChipIcon}>⌕</span>
                                                            {q}
                                                        </button>
                                                    ))}
                                                </span>
                                            )}
                                        </div>
                                        {isOwnMessage && msg._id && (
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={() => deleteMessage(msg._id)}
                                                title="Delete message"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                    {!isAgentMsg && (
                                        <div className={styles.messageFooter}>
                                            <span className={styles.time}>{timeLabel}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    <div ref={messagesEndRef} />
                </div>
                {isAILoading && (
                    <div className={styles.aiThinkingOverlay} aria-live="polite" aria-busy="true">
                        <div className={styles.aiThinkingBlock} style={AGENT_BY_KEY[selectedAgentKey] ? { borderLeftColor: AGENT_BY_KEY[selectedAgentKey].hex } : undefined}>
                            <div className={styles.aiThinkingContent}>
                                {AGENT_BY_KEY[selectedAgentKey] && (() => {
                                    const SelectedAgentIcon = AGENT_BY_KEY[selectedAgentKey].Icon;
                                    return (
                                        <span className={styles.agentAvatar} style={{ background: AGENT_BY_KEY[selectedAgentKey].hex }}>
                                            <SelectedAgentIcon style={{ fontSize: 11, color: '#fff' }} />
                                        </span>
                                    );
                                })()}
                                <span className={styles.aiThinkingText}>
                                    {AGENT_BY_KEY[selectedAgentKey] ? AGENT_BY_KEY[selectedAgentKey].name : "Research Manager"} is thinking
                                </span>
                                <span className={styles.typingDots} aria-hidden="true">
                                    <span></span><span></span><span></span>
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            <div 
                className={styles.inputRow}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div
                    className={`${styles.dropZone} ${isDragOverDropZone ? styles.dropZoneActive : ''}`}
                >
                    <span className={styles.dropZoneText}>Drop here</span>
                </div>

                {/* Single persistent wrapper and textarea so the input never remounts (avoids focus loss when suggestion appears/disappears) */}
                <div className={styles.inputWithSuggestion}>
                    {(() => {
                        const mentionQuery = getMentionQuery(input);
                        if (mentionQuery === null) return null;
                        const matches = activeAgents.filter((a) => a.key.startsWith(mentionQuery) || a.name.toLowerCase().startsWith(mentionQuery));
                        const showAuto = "ai".startsWith(mentionQuery);
                        if (!matches.length && !showAuto) return null;
                        return (
                            <div className={styles.mentionPopup} role="listbox">
                                {showAuto && (
                                    <button
                                        type="button"
                                        className={styles.mentionOption}
                                        onClick={() => { setInput('@ai '); setIsAIMode(true); setSelectedAgentKey('manager'); }}
                                    >
                                        <span className={styles.agentAvatar} style={{ background: '#6b6358' }}>
                                            <AutoAwesomeIcon style={{ fontSize: 11, color: '#fff' }} />
                                        </span>
                                        <span className={styles.mentionOptionText}>
                                            <span className={styles.mentionOptionName}>@ai — Auto</span>
                                            <span className={styles.mentionOptionDesc}>Let the Research Manager pick the right agent</span>
                                        </span>
                                    </button>
                                )}
                                {matches.map((agent) => (
                                    <button
                                        type="button"
                                        key={agent.key}
                                        className={styles.mentionOption}
                                        onClick={() => insertAgentMention(agent.key)}
                                    >
                                        <span className={styles.agentAvatar} style={{ background: agent.hex }}>
                                            <agent.Icon style={{ fontSize: 11, color: '#fff' }} />
                                        </span>
                                        <span className={styles.mentionOptionText}>
                                            <span className={styles.mentionOptionName}>@{agent.key} — {agent.name}, {agent.role}</span>
                                            <span className={styles.mentionOptionDesc}>{agent.description}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        );
                    })()}
                    {!isAIMode && !input && (
                        <div className={styles.placeholderOverlay} aria-hidden="true">
                            <span className={styles.placeholderMain}>Type your message</span>
                            <span className={styles.placeholderSub}> (type @ to ask an agent)</span>
                        </div>
                    )}
                    {isAIMode && (() => {
                        const queryPart = getQueryPart(input);
                        const suggestion = getSuggestion(queryPart);
                        const showSuggestion = suggestion && suggestion.suffix.length > 0;
                        return showSuggestion ? (
                            <div className={styles.inputSuggestionOverlay} aria-hidden="true">
                                <span className={styles.inputSuggestionTyped}>{input}</span>
                                <span className={styles.inputSuggestionSuffix}>{suggestion.suffix}</span>
                            </div>
                        ) : null;
                    })()}
                    <textarea
                        className={`${styles.input} ${styles.inputTextarea}`}
                        placeholder={isAIMode && getSuggestion(getQueryPart(input))?.suffix ? "Tab to accept suggestion" : isAIMode ? "Ask about the search results... (type for suggestions)" : ""}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleInputKeyDown}
                        disabled={isAILoading || !isPageScoped}
                        rows={1}
                        aria-label="Chat message"
                    />
                </div>

                <button
                    className={styles.sendBtn}
                    onClick={sendMessage}
                    disabled={isAILoading || !isPageScoped}
                >
                    {isAILoading ? 'Thinking…' : isAIMode ? `Ask ${AGENT_BY_KEY[selectedAgentKey]?.name || 'AI'}` : 'Send'}
                </button>
            </div>
            {selectedDocuments.length > 0 && (
                <div className={styles.selectedDocsRow}>
                    {/* loop through the selected documents and display */}
                    {selectedDocuments.map((doc, index) => {
                        const title = doc?.pnx?.display?.title?.[0] || doc?.pnx?.display?.title || 'Untitled';
                        // IF au exists, if is array, join with commas ELSE use it directly. ELSE IF addau exists, do  same thing. ELSE use "Unknown authors"
                        // IF array, then join, IF string, then use it directly
                        const authors = doc?.pnx?.addata?.au 
                            ? (Array.isArray(doc.pnx.addata.au) ? doc.pnx.addata.au.join(', ') : doc.pnx.addata.au)
                            : (doc?.pnx?.addata?.addau 
                                ? (Array.isArray(doc.pnx.addata.addau) ? doc.pnx.addata.addau.join(', ') : doc.pnx.addata.addau)
                                : 'Unknown authors');

                        return (
                            <div key={index} className={styles.selectedDocChip}>
                                <div className={styles.selectedDocAvatar} />
                                <div className={styles.selectedDocInfo}>
                                    <div className={styles.selectedDocTitle}>{title}</div>
                                    <div className={styles.selectedDocAuthors}>{authors}</div>
                                </div>
                                <button
                                    type="button"
                                    className={styles.selectedDocRemoveBtn}
                                    onClick={() => removeSelectedDocument(index)}
                                    title="Remove document"
                                    aria-label="Remove document"
                                >
                                    <CloseIcon fontSize="small" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
            {isAIMode && (
                <div className={styles.agentPickerRow}>
                    {activeAgents.map((agent) => {
                        const isActive = selectedAgentKey === agent.key;
                        return (
                            <button
                                type="button"
                                key={agent.key}
                                className={styles.agentChip}
                                style={isActive ? { borderColor: agent.hex, background: `${agent.hex}14`, color: agent.hex } : undefined}
                                disabled={isAILoading}
                                title={agent.description}
                                onClick={() => {
                                    setSelectedAgentKey(agent.key);
                                    // Keep the @ mention in the text area consistent with the selected agent
                                    // Preserve whatever the user already typed after the mention
                                    const nextMention = agentKeyToMention(agent.key);
                                    const rest = getQueryPart(input);
                                    setInput(`${nextMention} ${rest || ''}`);
                                }}
                            >
                                <span className={styles.agentChipAvatar} style={{ background: agent.hex }}>
                                    <agent.Icon style={{ fontSize: 9, color: '#fff' }} />
                                </span>
                                {agent.name}
                            </button>
                        );
                    })}
                </div>
            )}
            </>
            )}
        </div>
    );
}

export default ChatComponent;