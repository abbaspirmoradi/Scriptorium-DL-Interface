import React, { useMemo, useState } from "react";
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
import styles from "./timeline.module.css";
import {
  USER_COLOURS,
  getColorIndexForUsername,
  getReadableTextColor,
} from "../../colours/userColors";

// Event-type colors for the History timeline. "search", "save", "view", and
// "delete" are all backed by real data (see backend/models/viewLogModel.js
// for views; deletes are derived from doc_isRemoved + updatedAt). There is
// still no "filter" or "export" event anywhere in the app — no faceted
// filtering UI and no export feature exist — so those aren't represented
// here rather than faking them.
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

  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

const formatDateTime = (date) => {
  if (!date) return '';

  const d = new Date(date);

  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const formatTime = (date) => {
  if (!date) return '';

  const d = new Date(date);
  
  return d.toLocaleTimeString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// Today / Yesterday / formatted date — supports the multi-day session
// requirement by making recent activity easy to scan at a glance.
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

// Simple icon mapper based on document format/type
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
  allWorkspaceQueries,
  setPageLoading,
  setShowDetails,
  setDetails,
  queryId,
  workspaceId,
  queryText,
  currentUsername,
  currentUserId,
  viewLogs,
  onLogView,
}) {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');

  const currentQuery = useMemo(() => {
    if (!Array.isArray(queries) || !queryId) return null;

    return queries.find((q) => q?._id === queryId) || null;
  }, [queries, queryId]);

  const currentQueryLabel = useMemo(() => {
    const labelFromQuery = currentQuery?.query;
    if (typeof labelFromQuery === "string" && labelFromQuery.trim()) return labelFromQuery;

    if (typeof queryText === "string" && queryText.trim()) return queryText;
    const ls = localStorage.getItem("query");

    if (typeof ls === "string" && ls.trim()) return ls;

    return "";
  }, [currentQuery, queryText]);

  const getSearchResult = async ({ searchTerm, nextWorkspaceId, nextQueryId }) => {
    if (typeof searchTerm === "string") 
    {
      localStorage.setItem("searchTerm", searchTerm);
      localStorage.setItem("query", searchTerm);
    }

    // Navigate to results page (always use the intended query/workspace, never queries[0])
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

  // Opening a document from the timeline is itself a real "view" event —
  // logging is owned by the parent (Contentlists.js) so the SRP results list
  // and this panel share one live list instead of drifting out of sync.
  const openDocument = (entry) => {
    if (entry.docUrl) {
      window.open(entry.docUrl, '_blank', 'noopener,noreferrer');
    }
    onLogView?.(entry.controlNumber, entry.title, entry.queryIdRef || queryId);
  };

  // Build the unified, filterable activity stream from four real sources:
  // searches (workspace queries), saves (active documents attached to each
  // query), deletes (documents unsaved — doc_isRemoved, timestamped by
  // updatedAt), and views (the ViewLog collection, passed down live from the
  // parent). No "filter"/"export" events are synthesized because those
  // actions don't exist anywhere in the app yet.
  const allEvents = useMemo(() => {
    // ViewLog rows don't store a URL (they only track that a view happened) —
    // cross-reference the matching document's stored doc_url by documentId so
    // "view" entries can still open in a new tab like save/delete entries do.
    const docUrlByDocumentId = new Map();
    (allWorkspaceQueries || []).forEach((q) => {
      (q.documents || []).forEach((doc) => {
        const key = doc.documentId || doc._id;
        if (key && doc.doc_url) docUrlByDocumentId.set(String(key), doc.doc_url);
      });
    });

    const searchEvents = (allWorkspaceQueries || []).map((q) => ({
      type: 'search',
      key: `search-${q._id}`,
      title: q.query || 'Untitled search',
      createdAt: q.createdAt,
      username: q.username || q.userId?.username || 'Unknown',
      queryIdRef: q._id,
      workspaceIdRef: q.workspaceId,
    }));

    const saveEvents = (allWorkspaceQueries || []).flatMap((q) =>
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
        }))
    );

    // A document that's currently unsaved is a real, timestamped "delete"
    // event — Mongoose's `timestamps: true` updates `updatedAt` the moment
    // toggleDocumentSave flips doc_isRemoved, so this is an accurate event
    // time, not a guess.
    const deleteEvents = (allWorkspaceQueries || []).flatMap((q) =>
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
        }))
    );

    const viewEvents = (viewLogs || []).map((v) => ({
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
  }, [allWorkspaceQueries, viewLogs]);

  const filteredEvents = activeFilter === 'all'
    ? allEvents
    : allEvents.filter((e) => e.type === activeFilter);

  // Group by calendar day, label Today/Yesterday/date, newest day first
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

  return (
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
                      {/* Header: event-type dot, icon, TYPE LABEL ... time on the right */}
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

                      {/* title */}
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

                      {/* Actor identity: a small avatar chip (not the card border/badge) so
                          "who did it" reads as its own signal, separate from "what happened"
                          (border + dot + icon + label, all one color = event type). */}
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

        <div className={styles.magnifyingRow} />
    </div>
  );
}
