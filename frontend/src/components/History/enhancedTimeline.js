import React, { useState, useEffect, useMemo } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import VideocamIcon from '@mui/icons-material/Videocam';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ReplayIcon from '@mui/icons-material/Replay';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useNavigate } from "react-router-dom";
import documentService from '../../features/Document/documentService';
import styles from "./enhancedTimeline.module.css";
import {
    USER_COLOURS,
    getColorIndexForUsername,
    getReadableTextColor,
} from "../../colours/userColors";

// Same event system as components/History/timeline.js (the Search Results
// Page's Research Timeline) — kept in sync so both surfaces behave and look
// identical. See that file for the fuller rationale comment on why there's
// no "filter"/"export" event type.
const EVENT_COLORS = {
    search: '#2563eb', // blue
    save: '#059669',   // emerald
    view: '#7c3aed',   // violet
    delete: '#c0392b', // red
};

const TYPE_LABELS = {
    search: 'Search',
    save: 'Saved',
    view: 'Viewed',
    delete: 'Deleted',
};

const FILTER_TABS = [
    { key: 'all', label: 'all' },
    { key: 'search', label: 'queries' },
    { key: 'view', label: 'views' },
    { key: 'save', label: 'saves' },
    { key: 'delete', label: 'deletes' },
];

// Date formatting helper functions
const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDateTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    });
};

const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    });
};

const dayKey = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const getRelativeDateLabel = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const startOfDay = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
    const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return formatDate(date);
};

// Simple icon mapper based on document format/type — always sized explicitly
// so it never falls back to MUI's unstyled default (24px) rendering.
const IconMapper = ({ format, style }) => {
    const formatLower = format?.toLowerCase() || '';
    const iconStyle = { fontSize: 16, ...style };

    if (formatLower.includes('book') || formatLower.includes('ebook')) 
    {
        return <MenuBookIcon style={iconStyle} />;
    } 
    else if (formatLower.includes('article') || formatLower.includes('journal')) 
    {
        return <NewspaperIcon style={iconStyle} />;
    } 
    else if (formatLower.includes('video')) 
    {
        return <VideocamIcon style={iconStyle} />;
    } 
    else if (formatLower.includes('audio')) 
    {
        return <AudioFileIcon style={iconStyle} />;
    } 
    else 
    {
        return <InsertDriveFileIcon style={iconStyle} />;
    }
};

export default function UserTimeline({
    queries,
    setPageLoading,
    setShowDetails,
    setDetails,
    currentUsername,
    currentUserId,
}) 
{
    const navigate = useNavigate();
    const [activeFilter, setActiveFilter] = useState('all');
    const [viewLogs, setViewLogs] = useState([]);

    // This component isn't handed workspaceId directly (WorkspaceDetails.js
    // passes a topic's query list) — every query already carries it, so pull
    // it from there rather than requiring a prop change upstream.
    const workspaceId = useMemo(() => queries?.find((q) => q?.workspaceId)?.workspaceId || null, [queries]);

    // The most recent search performed within this topic — lets the user
    // jump straight back into it with one click, same as the Search Results
    // Page's "resume search" box.
    const lastQuery = useMemo(() => {
        if (!queries || queries.length === 0) return null;
        return [...queries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    }, [queries]);

    useEffect(() => {
        if (!workspaceId) 
        {
            setViewLogs([]);
            return;
        }

        let cancelled = false;
        documentService.getViewsByWorkspace(workspaceId)
            .then((views) => { if (!cancelled) setViewLogs(Array.isArray(views) ? views : []); })
            .catch((error) => {
                console.error("Failed to fetch view events:", error);
                if (!cancelled) setViewLogs([]);
            });
        return () => { cancelled = true; };
    }, [workspaceId]);

    const getSearchResult = async ({ searchTerm, nextWorkspaceId, nextQueryId }) => {
        if (typeof searchTerm === "string") 
        {
            localStorage.setItem("searchTerm", searchTerm);
            localStorage.setItem("query", searchTerm);
        }

        if (nextWorkspaceId && nextQueryId) 
        {
            navigate(`/task/${nextWorkspaceId}/${nextQueryId}`);
            return;
        }

        if (nextWorkspaceId) 
        {
            navigate(`/workspace/${nextWorkspaceId}`);
            return;
        }

        window.location.href = "/results";
    };

    const openDocument = (entry) => {
        if (entry.docUrl) {
            window.open(entry.docUrl, '_blank', 'noopener,noreferrer');
        }

        if (!workspaceId || !entry.controlNumber || !currentUsername) return;

        const payload = {
            workspaceId,
            queryId: entry.queryIdRef || null,
            queryText: entry.queryTextRef || '',
            documentId: entry.controlNumber,
            title: entry.title,
            userId: currentUserId || null,
            username: currentUsername,
        };

        documentService.logDocumentView(payload)
            .then((created) => { if (created) setViewLogs((prev) => [created, ...prev]); })
            .catch((error) => console.error("Failed to log view event:", error));
    };

    // Build the unified, filterable activity stream — identical shape to
    // components/History/timeline.js — from every query in this topic.
    const allEvents = useMemo(() => {
        const safeQueries = queries || [];

        // ViewLog rows don't store a URL (they only track that a view happened) —
        // cross-reference the matching document's stored doc_url by documentId so
        // "view" entries can still open in a new tab like save/delete entries do.
        const docUrlByDocumentId = new Map();
        safeQueries.forEach((q) => {
            (q.documents || []).forEach((doc) => {
                const key = doc.documentId || doc._id;
                if (key && doc.doc_url) docUrlByDocumentId.set(String(key), doc.doc_url);
            });
        });

        const searchEvents = safeQueries.map((q) => ({
            type: 'search',
            key: `search-${q._id}`,
            title: q.query || 'Untitled search',
            createdAt: q.createdAt,
            username: q.username || q.userId?.username || 'Unknown',
            queryIdRef: q._id,
            queryTextRef: q.query || '',
            workspaceIdRef: q.workspaceId,
        }));

        const saveEvents = safeQueries.flatMap((q) =>
            (q.documents || [])
                .filter((doc) => !doc.doc_isRemoved)
                .map((doc) => ({
                    type: 'save',
                    key: `save-${doc._id}`,
                    title: doc.title || 'Untitled Document',
                    createdAt: doc.createdAt,
                    username: doc.username || doc.userId?.username || 'Unknown',
                    docFormat: doc.doc_type || '',
                    controlNumber: doc.documentId || doc._id,
                    docUrl: doc.doc_url || '',
                    queryIdRef: q._id,
                    queryTextRef: q.query || '',
                }))
        );

        const deleteEvents = safeQueries.flatMap((q) =>
            (q.documents || [])
                .filter((doc) => doc.doc_isRemoved)
                .map((doc) => ({
                    type: 'delete',
                    key: `delete-${doc._id}`,
                    title: doc.title || 'Untitled Document',
                    createdAt: doc.updatedAt || doc.createdAt,
                    username: doc.username || doc.userId?.username || 'Unknown',
                    docFormat: doc.doc_type || '',
                    controlNumber: doc.documentId || doc._id,
                    docUrl: doc.doc_url || '',
                    queryIdRef: q._id,
                    queryTextRef: q.query || '',
                }))
        );

        // getViewsByWorkspace returns every view logged anywhere in the
        // workspace — restrict to the queries actually being shown (this
        // topic, or every topic in "All Topics" mode) so viewing a document
        // under a different search doesn't leak into this one's timeline.
        const relevantQueryIds = new Set(safeQueries.map((q) => String(q._id)));
        const viewEvents = (viewLogs || [])
            .filter((v) => relevantQueryIds.has(String(v.queryId)))
            .map((v) => ({
                type: 'view',
                key: `view-${v._id}`,
                title: v.title || 'Untitled Document',
                createdAt: v.createdAt,
                username: v.username || 'Unknown',
                controlNumber: v.documentId,
                docUrl: docUrlByDocumentId.get(String(v.documentId)) || '',
                queryIdRef: v.queryId,
            }));

        return [...searchEvents, ...saveEvents, ...deleteEvents, ...viewEvents];
    }, [queries, viewLogs]);

    const filteredEvents = activeFilter === 'all' ? allEvents : allEvents.filter((e) => e.type === activeFilter);

    const grouped = useMemo(() => {
        const byDay = {};
        filteredEvents.forEach((event) => {
            if (!event.createdAt) return;
            const key = dayKey(event.createdAt);
            if (!byDay[key]) 
            {
                byDay[key] = { label: getRelativeDateLabel(event.createdAt), timestamp: new Date(event.createdAt).getTime(), items: [] };
            }
            byDay[key].items.push(event);
        });

        Object.values(byDay).forEach((group) => {
            group.items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        });

        return Object.values(byDay).sort((a, b) => b.timestamp - a.timestamp);
    }, [filteredEvents]);

    if (!queries || queries.length === 0) 
    {
        return (
            <div className={styles.timelineContainer}>
                <h5 className={styles.noQueries}>No queries found for this topic</h5>
            </div>
        );
    }

    return (
        <div className={styles.timelineContainer}>
            <div className={styles.timelineWrapper}>
                <h3 className={styles.timelineTitle}>
                    <AccessTimeIcon style={{ fontSize: 14 }} />
                    Search Timeline
                </h3>

                <div className={styles.filterTabs} role="tablist" aria-label="Filter activity">
                    {FILTER_TABS.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            aria-selected={activeFilter === tab.key}
                            className={`${styles.filterTab} ${activeFilter === tab.key ? styles.filterTabActive : ''}`}
                            onClick={() => setActiveFilter(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className={styles.timelineScrollContainer}>
                    {grouped.length === 0 ? (
                        <div className={styles.noQueries}>No activity yet</div>
                    ) : (
                        grouped.map((group) => (
                            <div key={group.label + group.timestamp} className={styles.queryGroup}>
                                <h4 className={styles.queryDate}>{group.label}</h4>
                                {group.items.map((entry) => {
                                    const timechanger = formatTime(entry.createdAt || new Date());
                                    const colorIndex = getColorIndexForUsername(entry.username);
                                    const userColor = USER_COLOURS[colorIndex];
                                    const dotColor = EVENT_COLORS[entry.type];

                                    return (
                                        <div
                                            key={entry.key}
                                            className={styles.queryItem}
                                            style={{ borderLeftColor: dotColor }}
                                            title={`${TYPE_LABELS[entry.type] || entry.type} by ${entry.username}`}
                                        >
                                            <div className={styles.queryItemContent}>
                                                <div className={styles.queryItemHeader}>
                                                    <span className={styles.eventDot} style={{ background: dotColor }} />
                                                    <span className={styles.queryItemHeaderIcon} style={{ color: dotColor }}>
                                                        {entry.type === 'search' ? (
                                                            <SearchIcon style={{ fontSize: 16 }} />
                                                        ) : entry.type === 'delete' ? (
                                                            <DeleteOutlineIcon style={{ fontSize: 16 }} />
                                                        ) : entry.type === 'view' ? (
                                                            <VisibilityIcon style={{ fontSize: 16 }} />
                                                        ) : (
                                                            <IconMapper format={entry.docFormat} />
                                                        )}
                                                    </span>
                                                    <span className={styles.queryItemTypeLabel} style={{ color: dotColor }}>
                                                        {TYPE_LABELS[entry.type] || entry.type}
                                                    </span>
                                                    <span className={styles.queryItemTime}>{timechanger}</span>
                                                </div>

                                                <div
                                                    className={entry.type === 'delete' ? styles.queryItemTitleRemoved : styles.queryItemTitle}
                                                    onClick={() => {
                                                        if (entry.type === 'search') 
                                                        {
                                                            getSearchResult({
                                                                searchTerm: entry.title,
                                                                nextWorkspaceId: entry.workspaceIdRef || workspaceId,
                                                                nextQueryId: entry.queryIdRef,
                                                            });
                                                        } 
                                                        else 
                                                        {
                                                            openDocument(entry);
                                                        }
                                                    }}
                                                >
                                                    {entry.title}
                                                </div>

                                                <div className={styles.queryItemMeta}>
                                                    <span className={styles.userAvatar} style={{ background: userColor, color: getReadableTextColor(userColor) }}>
                                                        {(entry.username || '?').trim().charAt(0).toUpperCase()}
                                                    </span>
                                                    by {entry.username}
                                                </div>
                                            </div>

                                            {entry.type === 'search' && (
                                                <div
                                                    className={styles.queryItemAction}
                                                    title="Re-run this search"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        getSearchResult({
                                                            searchTerm: entry.title,
                                                            nextWorkspaceId: entry.workspaceIdRef || workspaceId,
                                                            nextQueryId: entry.queryIdRef,
                                                        });
                                                    }}
                                                >
                                                    <ReplayIcon style={{ fontSize: 12 }} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>

                {!!lastQuery && (
                    <div className={styles.magnifyingRow}>
                        <div
                            className={styles.queryBox}
                            onClick={() =>
                                getSearchResult({
                                    searchTerm: lastQuery.query,
                                    nextWorkspaceId: lastQuery.workspaceId || workspaceId,
                                    nextQueryId: lastQuery._id,
                                })
                            }
                        >
                            <span className={styles.queryText}>
                                <SearchIcon fontSize="small" />
                                <span style={{ marginLeft: "0.5rem" }}>{lastQuery.query}</span>
                            </span>
                        </div>
                        <div className={styles.queryTime}>{formatDateTime(lastQuery.createdAt)}</div>
                    </div>
                )}
            </div>
        </div>
    );
}
