import React, {useState, useEffect, useMemo, useRef} from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { FaChevronLeft, FaRegFileLines, FaMagnifyingGlass, FaXmark, FaLayerGroup } from "react-icons/fa6";

import { getWorkspaceDetails, createQuery, setSelectedWorkspace, resetWorkspaceData } from '../../features/workspace/workspaceSlice';
import {  setDocumentRemovedSuccess } from '../../features/Document/documentSlice';
import RenderDocumentThumbnail from '../../components/Document/DocumentThumbnail';
import DocumentComponent from '../../components/Document/DocumentComponent';
import UserTimeline from "../../components/History/enhancedTimeline";
import RightRail from "../../components/RightRail/RightRail";
import ChatComponent from "../../components/Chat/ChatComponent";
import SearchComponent from "../../components/Search/Search";


import default_thumbnail from '../../assets/default_thmbnail.png'
import Loading from '../../components/Loading/Loading';
import Header from '../../components/Header/Header';
import styles from "./Workspace.module.css";
import { isbn_url } from "../../config/env";


function WorkspaceDetails() {
    const dispatch = useDispatch(); 
    const navigate = useNavigate();
    const { id } = useParams();
    const {user} = useSelector((state) => state.auth);
    const {singleWorkspace, isWorkpsaceDetailSuccess, isQueryCreateSuccess, singleQuery, isDetailLoading, isError, message} = useSelector((state) => state.workspace);        
    const {isRemoveDocumentSuccess} = useSelector((state) => state.document);

    const [currentWorkspace, setCurrentWorkspace] = useState({})

    const [pageLoading, setPageLoading] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [details, setDetails] = useState(null);

    const timelineQueries = singleWorkspace.queries || [];
    const isQueryDetailSuccess = timelineQueries.length > 0;

    // New queries
    const [refetchQueries, setRefetchQueries] = useState(false);
    const [highlightedTopic, setHighlightedTopic] = useState(null);
    const [selectedTopicQueries, setSelectedTopicQueries] = useState(null);
    // "All Topics" view — shows the whole workspace's Timeline + Chat instead
    // of scoping to whichever single topic is selected in the sidebar.
    const [viewingWholeWorkspace, setViewingWholeWorkspace] = useState(false);

    // Keep the right-hand Timeline/Chat panel exactly as tall as the left
    // topics column (which is itself capped by .topicsSidebar's own scroll),
    // instead of always filling the remaining viewport height.
    const leftColumnRef = useRef(null);
    const [leftColumnHeight, setLeftColumnHeight] = useState(null);

    useEffect(() => {
        const el = leftColumnRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) setLeftColumnHeight(entry.contentRect.height);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Formatting Date Time Function
    const formatDateTime = (date) => 
    {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', 
    { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    };

    // Grouping queries based on search topic
    const topicsGrouped = useMemo(() => 
    {                                                                                         
        const grouped = {};
        timelineQueries.forEach(query => 
        {
            const topic = query.searchTopic || query.query || 'Untitled';
            const normalizedTopic = topic.trim().toLowerCase();
            
            if (!grouped[normalizedTopic]) 
            {
                grouped[normalizedTopic] = {
                    display: topic.trim(),
                    queries: []
                };
            }
            grouped[normalizedTopic].queries.push(query);
        });
        return grouped;
    }, [timelineQueries]);

    // Convert to array of objects
    const topicLinks = useMemo(() => 
    {
        return Object.entries(topicsGrouped).map(([key, value]) => ({ key, display: value.display, queries: value.queries }));
    }, [topicsGrouped]);


    const formatTitle = (text) => {
        return text
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    // New Effects
    // Initialize the selected topic queries
    // useEffect(() => 
    // {
    //     if (topicLinks.length > 0 && selectedTopicQueries === null) 
    //     {
    //         // Set to highlighted topic or first topic
    //         const targetTopic = highlightedTopic || Object.keys(topicsGrouped)[0];
    //         if (topicsGrouped[targetTopic]) 
    //         {
    //             setSelectedTopicQueries(topicsGrouped[targetTopic]);
    //             if (!highlightedTopic) 
    //             {
    //                 setHighlightedTopic(targetTopic);
    //             }
    //         } 
    //         else if (Object.keys(topicsGrouped).length > 0) 
    //         {
    //             const firstTopic = Object.keys(topicsGrouped)[0];
    //             setSelectedTopicQueries(topicsGrouped[firstTopic]);
    //             setHighlightedTopic(firstTopic);
    //         }
    //     }
    // }, [topicLinks, topicsGrouped, highlightedTopic, selectedTopicQueries]);
    useEffect(() =>
    {
        if (!topicsGrouped || Object.keys(topicsGrouped).length === 0) return;

        // Always default to the most recent query's topic on load
        // (timelineQueries is newest-first, so topics[0] is the most recent).
        const topics = Object.keys(topicsGrouped);
        const topicToOpen = topics[0];

        setHighlightedTopic(topicToOpen);
        setSelectedTopicQueries(topicsGrouped[topicToOpen]);
    }, [topicsGrouped]);

    // Ensures no previous workspace states is carried between workspaces
    useEffect(() => 
    {
        setHighlightedTopic(null);
        setSelectedTopicQueries(null);
    }, [id]);

    // // Update selected queries when highlighted topic change
    // useEffect(() => 
    // {
    //     if (highlightedTopic && topicsGrouped[highlightedTopic]) 
    //     {
    //         setSelectedTopicQueries(topicsGrouped[highlightedTopic]);
    //     }
    // }, [highlightedTopic, topicsGrouped]);

    useEffect(()=>
    {
        dispatch(getWorkspaceDetails(id))
        // console.log(singleWorkspace)
        return() => 
        {
            dispatch(resetWorkspaceData())
        }
    }, [dispatch, id])

    useEffect(() => 
    {
        if (refetchQueries) 
        {
            dispatch(getWorkspaceDetails(id));
            setRefetchQueries(false);
        }
    }, [refetchQueries, dispatch, id])

    useEffect(()=>{
       // dispatch(setSelectedWorkspace(singleWorkspace.workspace))
        if(isWorkpsaceDetailSuccess){
            console.log('_', singleWorkspace)
            
            setCurrentWorkspace(singleWorkspace.workspace)
        }
        
    }, [isWorkpsaceDetailSuccess])

    useEffect(()=>{        
        if(isRemoveDocumentSuccess){
            console.log('hi')
            dispatch(setDocumentRemovedSuccess(false))
            dispatch(getWorkspaceDetails(id))
        }
         
     }, [isRemoveDocumentSuccess])
    
    const documentCountHandler = (queryId) => {        
        console.log(queryId)
        console.log(singleWorkspace.queries)        
        const index = singleWorkspace.queries.findIndex(item => item._id === queryId);
    }

    const redirectToContentLists = (details) => {
        console.log('details_', details)
        const normalizedTopic = (details.query || '').trim();
        localStorage.setItem('query', normalizedTopic)
        localStorage.setItem('wpname', normalizedTopic)
        localStorage.setItem('searchTopic', normalizedTopic);
        setTimeout(() => {
            // navigate('/testing/' + details.workspaceId + '/' + details._id, {state: details.query})        
            navigate('/task/' + details.workspaceId + '/' + details._id)        
        }, 100);
    }

    // Navigate to the new query's SRP page once it's created — fired by
    // either SearchComponent (top search box) or runSuggestedQuery (chat).
    useEffect(()=>{
        if(isQueryCreateSuccess){
            navigate('/task/' + id + '/' + singleQuery._id)
        }
    }, [isQueryCreateSuccess])

    // Run a HERMES-suggested query from chat: same action as submitFormHandler
    // above — spawn a new Query under this workspace, the isQueryCreateSuccess
    // effect navigates to its SRP page once it's created.
    const runSuggestedQuery = (suggestedQueryText) => {
        const normalizedTopic = String(suggestedQueryText || '').trim();
        if (!normalizedTopic) return;

        localStorage.setItem('query', normalizedTopic);
        localStorage.setItem('wpname', normalizedTopic);
        localStorage.setItem('searchTopic', normalizedTopic);

        const queryData = {
            'query': normalizedTopic,
            'userId': user.data._id,
            'username': user.data.username,
            'workspaceId': id,
            'workspaceName': normalizedTopic,
            'documents': []
        }
        dispatch(createQuery(queryData))
    }

    // AI/chat context for this workspace — mirrors the shape Contentlists.js builds
    const workspaceHistory = useMemo(() => ({
        workspaceName: singleWorkspace?.workspace?.name || '',
        queries: singleWorkspace?.queries || [],
        timeline: { queryId: null, documents: [] }
    }), [singleWorkspace]);

    // Representative query for the currently highlighted topic — used to tag
    // chat messages; chat itself is fetched by workspaceId, not by this.
    const highlightedTopicLatestQuery = Array.isArray(selectedTopicQueries) && selectedTopicQueries.length > 0
        ? selectedTopicQueries[0]
        : null;

    const backToHome = () => {
        dispatch(resetWorkspaceData())
        setCurrentWorkspace({})
        navigate('/')
    }

    // New Handles
    const handleResumeCallback = (topic) =>
    {
        setHighlightedTopic(topic);
        setViewingWholeWorkspace(false);
        const normalizedTopic = (topic || '').trim();
        localStorage.setItem('searchTopic', normalizedTopic);
        localStorage.setItem('query', normalizedTopic);
    }

    const handleTopicClick = (topicKey, topicGroup) =>
    {
        // setSelectedTopicQueries(queries);
        // setHighlightedTopic(topic);

        setHighlightedTopic(topicKey);
        setSelectedTopicQueries(topicGroup);
        setViewingWholeWorkspace(false);

        const normalizedTopic = (topicKey || '').trim();
        localStorage.setItem('searchTopic', normalizedTopic);
        localStorage.setItem('query', normalizedTopic);
    };

    // "All Topics" — view the whole workspace's Timeline + Chat at once.
    const handleViewWholeWorkspace = () =>
    {
        setViewingWholeWorkspace(true);
        setHighlightedTopic(null);
    };

    return (
        <>
            <Header />
            <div className="mt_22">
                <div className={`flex items-center px-6 py-2.5 nav_wrap`}>
                    <div className='flex items-center cursor-pointer text-ink-muted hover:text-navy transition ease-out' onClick={backToHome}>
                        <FaChevronLeft className="text-xs" />
                        <p className='text-xs ml-2'>Dashboard</p>
                    </div>
                    <span className='px-3 text-xs text-ink-muted'>/</span>
                    {singleWorkspace !== undefined && <>
                        <p className='text-xs font-medium text-ink'>Workspace: {singleWorkspace.workspace?.name}</p>
                    </>}
                </div>
                
                {isDetailLoading &&
                    <div><Loading /></div>
                }
                <div className='main_element_container'>
                    
                    <div className="w-full flex justify-center">
                        <div className="w-full max-w-3xl">
                            <SearchComponent workspaceId={id} />
                        </div>
                    </div>
                    
                    <div className='mt-14'>
                        <div className={styles.workspaceContentTimelineContainer}>
                        {/* Left Workspace */}
                        <div className={styles.workspaceLeft} ref={leftColumnRef}>
                        <h3 className="text-lg font-serif text-ink mb-6 mt-6 font-medium">Workspace: {singleWorkspace.workspace?.name}</h3>
                            {
                                isWorkpsaceDetailSuccess && <>
                                    <div className='flex flex-col gap-2 mb-4'>
                                        <div className='flex items-center'>
                                            <FaMagnifyingGlass className="query_icon_color mr-2"/>
                                            <span className='text-sm font-mono font-medium text-ink-muted whitespace-nowrap'>Total Queries: {singleWorkspace.querySize} </span>
                                        </div>
                                        <div className='flex items-center'>
                                            <FaRegFileLines className={`text-xl mr-2 ${styles.doc_default_color}`} />
                                            <span className='text-sm font-mono font-medium text-ink-muted whitespace-nowrap'>Total Documents: {singleWorkspace.docSize} </span>
                                        </div>
                                    </div>
                                    {/* {
                                        singleWorkspace.queries.map((data, index) => (
                                            <div key={data._id} className='w-full mb-4 p-4 border rounded-lg'style={{ width: '70%', maxWidth: '100%' }}>
                                                <div className='border-b border-solid border-slate-200 mb-3'>
                                                    <div className='mb-3 flex items-center'>
                                                        <div onClick={() => redirectToContentLists(data)} className='flex items-center'>
                                                            <FaMagnifyingGlass className="query_icon_color mr-2"/>
                                                            <span className='mr-3 cursor-pointer hover:text-indigo-800 transition ease-out-500 text-sm text-slate-500 pt-0.5'>{data.query}</span>
                                                        </div>
                                                        <span className='block_element'></span>
                                                        <span className='mx-3 text-sm text-slate-500'>{data.createdAt.split('T')[0]}</span>
                                                        <span className='block_element'></span>
                                                        <div className={`px-3 flex items-center ${styles.doc_default_color}`}>
                                                            <FaRegFileLines className={`text-xl`} />
                                                            <p className='font-medium text-sm mt-1 ml-2'>{data.documents.length}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className='my-5 mx-10'>
                                                    {data.documents.length !== 0 ? (
                                                        <>
                                                            {data.documents.map((list, index) => (                                                                    
                                                                <DocumentComponent key={list._id} listings={list} queryDetail={data} onDocRemove={documentCountHandler}/>
                                                            ))}
                                                        </>
                                                    ) : (
                                                        <>-</>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                         */

                                        <div className={styles.topicsSidebar}>
                                            <div>
                                                <div className={styles.topicItem}>
                                                    <div
                                                        className={`${styles.topicButton} ${viewingWholeWorkspace ? styles.topicButtonHighlighted : ''}`}
                                                        onClick={handleViewWholeWorkspace}
                                                    >
                                                        <FaLayerGroup className={styles.topicIcon} />
                                                        <div className={styles.topicContent}>
                                                            <span className={styles.topicName}>All Topics</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {topicLinks.map((link) => {
                                                    // const entries = Object.entries(link);
                                                    // const [key, value] = entries[0];
                                                    const { key, display, queries: value } = link;
                                                    const latestQuery = value.length > 0 ? value[0] : undefined;
                                                    const latestQueryRepresentation = latestQuery ? formatDateTime(latestQuery.updatedAt) : '';
                                                    const isHighlighted = highlightedTopic?.toLowerCase() === key;
                                                    // const isOngoing = localStorage.getItem('searchTopic') === key;
                                                    
                                                    return (
                                                        <div key={key} className={styles.topicItem}>
                                                            <div
                                                                className={`${styles.topicButton} ${isHighlighted ? styles.topicButtonHighlighted : ''}`}
                                                                onClick={() => handleTopicClick(key, value)}
                                                            >
                                                                <FaMagnifyingGlass className={styles.topicIcon} />
                                                                <div className={styles.topicContent}>
                                                                    <span className={styles.topicName}>{formatTitle(display)}</span>
                                                                    {/* Ongoing symbol */}
                                                                    {/* {isOngoing && (                                                 
                                                                        <span className={styles.ongoingChip}>
                                                                            Ongoing Topic
                                                                        </span>
                                                                    )} */}
                                                                </div>
                                                            </div>
                                                            <div className={styles.topicTimestamp}>
                                                                <span className={styles.topicTimestampText}>
                                                                    {latestQueryRepresentation}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                         }
                                </>
                            }    
                        </div>

                        {/* Right: Timeline + Chat, tab-switchable — same RightRail used on the SRP page.
                            "All Topics" (viewingWholeWorkspace) shows every topic's activity/chat
                            combined instead of scoping to whichever topic is selected in the sidebar. */}
                            {(viewingWholeWorkspace ? timelineQueries.length > 0 : (selectedTopicQueries && selectedTopicQueries.length > 0)) && (
                                <div className={styles.workspaceRight}>
                                    <RightRail
                                        simplified
                                        matchHeight={leftColumnHeight}
                                        historyContent={
                                            <UserTimeline
                                                userobj={user?.data || {}}
                                                queries={viewingWholeWorkspace ? timelineQueries : selectedTopicQueries}
                                                setRefetchQueries={setRefetchQueries}
                                                onResumeCallback={handleResumeCallback}
                                                refetchQueries={refetchQueries}
                                                setHighlightedTopic={setHighlightedTopic}
                                                setPageLoading={setPageLoading}
                                                setShowDetails={setShowDetails}
                                                setDetails={setDetails}
                                                currentUsername={user?.data?.username || ''}
                                                currentUserId={user?.data?._id || null}
                                            />
                                        }
                                        chatContent={
                                            <ChatComponent
                                                currentUsername={user?.data?.username || ''}
                                                currentUserIndex={0}
                                                documents={[]}
                                                workspaceHistory={workspaceHistory}
                                                workspaceId={id}
                                                queryId={viewingWholeWorkspace ? null : (highlightedTopicLatestQuery?._id || null)}
                                                queryText={viewingWholeWorkspace ? (singleWorkspace?.workspace?.name || '') : (highlightedTopic || singleWorkspace?.workspace?.name || '')}
                                                currentUserId={user?.data?._id || null}
                                                onRunSuggestedQuery={runSuggestedQuery}
                                                scopeChatToTopic={!viewingWholeWorkspace}
                                                hideAgentsPanel
                                            />
                                        }
                                    />
                                </div>
                            )}
                    </div>
                    </div>
                    
                    </div>
             </div>
        </>
    )
}

export default WorkspaceDetails;