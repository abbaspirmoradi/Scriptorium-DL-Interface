import React, { useState, useRef, useCallback, useEffect } from "react";
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ViewAgendaOutlinedIcon from '@mui/icons-material/ViewAgendaOutlined';
import styles from "./RightRail.module.css";

const STORAGE_KEY = "cdl_srp_rail_state_v1";
const EXPANDED_WIDTH = 370;
const SIMPLIFIED_WIDTH = 560;
const COLLAPSED_WIDTH = 52;
const MIN_SPLIT = 20;
const MAX_SPLIT = 80;
const DEFAULT_SPLIT = 55;

function loadPersistedState() {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
        return null;
    } catch {
        return null;
    }
}

function persistState(state) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Storage unavailable (private browsing, etc.) — fail silently, not critical
    }
}

/**
 * Persistent right-hand dock: History + Chat.
 *
 * Default (SRP / Search Results Page): expanded (370px) or collapsed to an
 * icon strip (52px); three panel modes — "both" (stacked, resizable split),
 * "history", "chat"; remembers collapsed/mode across sessions.
 *
 * `simplified` (Workspace Details page): always expanded, wider (560px),
 * no collapse, no "both" mode — just a Timeline/Chat tab switch, always
 * opens on Timeline. Its own topic sidebar is the primary navigation there,
 * so the extra chrome isn't needed.
 *
 * Dispatches to one of two full sub-components (rather than branching with
 * an early return) so each keeps its own consistent hook order.
 */
export default function RightRail({ historyContent, chatContent, simplified = false, matchHeight = null }) {
    if (simplified) {
        return <SimplifiedRightRail historyContent={historyContent} chatContent={chatContent} matchHeight={matchHeight} />;
    }
    return <FullRightRail historyContent={historyContent} chatContent={chatContent} />;
}

function FullRightRail({ historyContent, chatContent }) {
    const persisted = loadPersistedState();
    const [collapsed, setCollapsed] = useState(persisted?.collapsed ?? false);
    const [mode, setMode] = useState(persisted?.mode ?? "both");
    const [splitPercent, setSplitPercent] = useState(persisted?.splitPercent ?? DEFAULT_SPLIT);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        persistState({ collapsed, mode, splitPercent });
    }, [collapsed, mode, splitPercent]);

    const expandTo = (nextMode) => {
        setMode(nextMode);
        setCollapsed(false);
    };

    const handleDividerMouseDown = useCallback((event) => {
        event.preventDefault();
        setIsDragging(true);
    }, []);

    useEffect(() => {
        if (!isDragging) return undefined;

        const handleMouseMove = (event) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const relativeY = event.clientY - rect.top;
            let percent = (relativeY / rect.height) * 100;
            percent = Math.max(MIN_SPLIT, Math.min(MAX_SPLIT, percent));
            setSplitPercent(percent);
        };

        const handleMouseUp = () => setIsDragging(false);

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging]);

    if (collapsed) {
        return (
            <div className={styles.collapsedRail} style={{ width: COLLAPSED_WIDTH }}>
                <button
                    type="button"
                    className={styles.collapsedIconBtn}
                    title="Expand Search Timeline"
                    onClick={() => expandTo("history")}
                >
                    <AccessTimeIcon style={{ fontSize: 18 }} />
                </button>
                <button
                    type="button"
                    className={styles.collapsedIconBtn}
                    title="Expand Chat"
                    onClick={() => expandTo("chat")}
                >
                    <ChatBubbleOutlineIcon style={{ fontSize: 18 }} />
                </button>
                <button
                    type="button"
                    className={`${styles.collapsedIconBtn} ${styles.collapsedExpandBtn}`}
                    title="Expand panel"
                    onClick={() => setCollapsed(false)}
                >
                    <ChevronLeftIcon style={{ fontSize: 18 }} />
                </button>
            </div>
        );
    }

    return (
        <div className={styles.rail} style={{ width: EXPANDED_WIDTH }} ref={containerRef}>
            <div className={styles.railToolbar}>
                <div className={styles.modeSwitch} role="tablist" aria-label="Panel mode">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={mode === "both"}
                        className={`${styles.modeBtn} ${mode === "both" ? styles.modeBtnActive : ""}`}
                        onClick={() => setMode("both")}
                        title="Show Search Timeline and Chat"
                    >
                        <ViewAgendaOutlinedIcon style={{ fontSize: 15 }} />
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={mode === "history"}
                        className={`${styles.modeBtn} ${mode === "history" ? styles.modeBtnActive : ""}`}
                        onClick={() => setMode("history")}
                        title="Search Timeline only"
                    >
                        <AccessTimeIcon style={{ fontSize: 15 }} />
                        <span>Timeline</span>
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={mode === "chat"}
                        className={`${styles.modeBtn} ${mode === "chat" ? styles.modeBtnActive : ""}`}
                        onClick={() => setMode("chat")}
                        title="Chat only"
                    >
                        <ChatBubbleOutlineIcon style={{ fontSize: 15 }} />
                        <span>Chat</span>
                    </button>
                </div>
                <button
                    type="button"
                    className={styles.collapseBtn}
                    title="Collapse panel"
                    onClick={() => setCollapsed(true)}
                >
                    <ChevronRightIcon style={{ fontSize: 18 }} />
                </button>
            </div>

            <div className={styles.railBody}>
                {mode === "both" && (
                    <>
                        <div className={styles.paneHistory} style={{ height: `${splitPercent}%` }}>
                            {historyContent}
                        </div>
                        <div
                            className={`${styles.divider} ${isDragging ? styles.dividerActive : ""}`}
                            onMouseDown={handleDividerMouseDown}
                            role="separator"
                            aria-orientation="horizontal"
                            title="Drag to resize"
                        >
                            <span className={styles.dividerGrip} />
                        </div>
                        <div className={styles.paneChat} style={{ height: `calc(${100 - splitPercent}% - 15px)` }}>
                            {chatContent}
                        </div>
                    </>
                )}
                {mode === "history" && (
                    <div className={styles.paneFull}>{historyContent}</div>
                )}
                {mode === "chat" && (
                    <div className={styles.paneFull}>{chatContent}</div>
                )}
            </div>
        </div>
    );
}

// Workspace Details variant — see the `simplified` doc note above.
// matchHeight (px) lets the page match this panel's height to its own left
// column (e.g. the topics sidebar) instead of always filling the viewport.
function SimplifiedRightRail({ historyContent, chatContent, matchHeight = null }) {
    const [mode, setMode] = useState("history");

    return (
        <div
            className={styles.rail}
            style={{ width: SIMPLIFIED_WIDTH, ...(matchHeight ? { height: `${matchHeight}px` } : {}) }}
        >
            <div className={`${styles.railToolbar} ${styles.railToolbarCompact}`}>
                <div className={styles.modeSwitch} role="tablist" aria-label="Panel mode">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={mode === "history"}
                        className={`${styles.modeBtn} ${mode === "history" ? styles.modeBtnActive : ""}`}
                        onClick={() => setMode("history")}
                        title="Search Timeline"
                    >
                        <AccessTimeIcon style={{ fontSize: 15 }} />
                        <span>Timeline</span>
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={mode === "chat"}
                        className={`${styles.modeBtn} ${mode === "chat" ? styles.modeBtnActive : ""}`}
                        onClick={() => setMode("chat")}
                        title="Chat"
                    >
                        <ChatBubbleOutlineIcon style={{ fontSize: 15 }} />
                        <span>Chat</span>
                    </button>
                </div>
            </div>

            <div className={styles.railBody}>
                {mode === "history" && (
                    <div className={styles.paneFull}>{historyContent}</div>
                )}
                {mode === "chat" && (
                    <div className={styles.paneFull}>{chatContent}</div>
                )}
            </div>
        </div>
    );
}
