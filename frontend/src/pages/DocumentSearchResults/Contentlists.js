import React, { useState, useEffect } from "react";
import { useRef } from "react";
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { FaBookmark, FaChevronLeft, FaAngleRight, FaAngleLeft } from "react-icons/fa6";

import Loading from "../../components/Loading/Loading";
import Header from '../../components/Header/Header';
import RenderDocumentThumbnail from "../../components/Document/DocumentThumbnail";
import SERPDocumentComponent from "./SerpDocumentComponent";
import ChatComponent from "../../components/Chat/ChatComponent";
import UserTimeline from "../../components/History/timeline";
import RightRail from "../../components/RightRail/RightRail";
import documentService from "../../features/Document/documentService";

import { getSearchResultLists, resetSearchResults, getDocumentThumbnailUrl } from '../../features/contents/contentResultsSlice';
import { createQuery, getQueryDetails, resetWorkspaceData, getWorkspaceDetails } from "../../features/workspace/workspaceSlice";
import {
    saveDocumentToWorkspace, 
    removeDocumentFromWorkspace, 
    getDocumentListsByQueryId, 
    setDocumentArraySuccess, 
    setDocumentAddedSuccess, 
    setDocumentRemovedSuccess,
    setToggleDocumentSuccess,
    resetDocument,
    toggleDocumentSave
    } from '../../features/Document/documentSlice';
import { getRilDocumentLists, resetRilData, getRilDocumentCount, saveDocumentToRil, removeDocumentFromRil } from "../../features/RIL/rilSlice";

import styles from "./ContentListings.module.css";
import SearchComponent from "../../components/Search/Search";
import { isbn_url } from "../../config/env";

function ContentListsComponent() 
{
    const dispatch = useDispatch();     
    const navigate = useNavigate(); 
    const scrollToTopRef = useRef();

    const {contents, isSERPLoading,  isNewSearchKeyword, isError, message} = useSelector((state) => state.content)
    const { isQueryDetailSuccess, queryDetailObject, singleQuery, quries, isQueryCreateSuccess, singleWorkspace, isWorkpsaceDetailSuccess} = useSelector((state) => state.workspace);
    const {documents, isDocumentArraySuccess, isAddDocumentSuccess, isRemoveDocumentSuccess, isToggleDocumentSuccess} = useSelector((state) => state.document);
    const { ril_documents, isRilArraySuccess, isAddToRilSuccess, isRemoveFromRilSuccess } = useSelector((state) => state.ril);
    
    const {workspaceId} = useParams();
    const {queryId} = useParams();  
    const {user} = useSelector((state) => state.auth);      
       
    const [currentWorkspace, setCurrentWorkspace] = useState("");
    const [capturedDocs, setCapturedDocs] = useState([])
    const [capturedRilDocs, setCapturedRilDocs] = useState([])
    const [workspaceHistory, setWorkspaceHistory] = useState(null)
    const [timelineDocumentsForQuery, setTimelineDocumentsForQuery] = useState([])
    const [viewLogs, setViewLogs] = useState([])

    // Re-fetch workspace details on demand — triggers the effect below that
    // rebuilds `workspaceHistory`, so the Research Timeline reflects a new
    // search/save/unsave immediately instead of waiting for a page reload.
    const refreshWorkspaceHistory = () => {
        if (workspaceId) dispatch(getWorkspaceDetails({ workspaceId }));
    };

    // View events — shared between the SRP results list (title click) and the
    // Research Timeline ("Open" action), so either source updates both places
    // at once instead of the timeline having to poll for someone else's click.
    const fetchViewLogs = () => {
        if (!workspaceId) return;
        documentService.getViewsByWorkspace(workspaceId)
            .then((views) => setViewLogs(Array.isArray(views) ? views : []))
            .catch((error) => console.error("Failed to fetch view events:", error));
    };

    useEffect(() => {
        fetchViewLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId]);

    // Live updates for the Search Timeline: poll view logs + workspace/query
    // activity on the same cadence as chat, so another user's search/save/
    // delete/view shows up here without a page reload.
    useEffect(() => {
        if (!workspaceId) return;

        const interval = setInterval(() => {
            fetchViewLogs();
            dispatch(getWorkspaceDetails({ workspaceId }));
        }, 3000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId]);

    const logDocumentView = (recordId, title, sourceQueryId) => {
        if (!workspaceId || !recordId || !user?.data?.username) return;

        const payload = {
            workspaceId,
            queryId: sourceQueryId || queryId || null,
            queryText: QUERY_STRING || queryDetailObject?.query || '',
            documentId: recordId,
            title: title || 'Untitled',
            userId: user?.data?._id || null,
            username: user.data.username,
        };

        documentService.logDocumentView(payload)
            .then((created) => {
                if (created) setViewLogs((prev) => [created, ...prev]);
            })
            .catch((error) => console.error("Failed to log view event:", error));
    };
    
    // const [isDocSaved, setIsDocSaved] = useState(false)
    // const [tempDocs, setTempDoc] = useState([])
    const [, setTempRils] = useState([])
    const [, setPageLoading] = useState(false)
    const [, setShowDetails] = useState(false)
    const [, setDetails] = useState(null)
    const [currentPageIndex, setCurrentPageIndex] = useState(0)

    const limitperpage = 10;
    const initialPagination = {"offset": 0, "limit": limitperpage}

    const QUERY_STRING = localStorage.getItem('query')
    const CURRENT_WORKSPACENAME = localStorage.getItem('wpname')
    
    const redirectToWorkspace = () => { 
        console.log('redirect to workspace')
        // resetDocumentSuccessStatus()
        redirectResetValues()
        navigate('/workspace/' + workspaceId)
    }

    const redirectToDashboard = () => {
        redirectResetValues()
        navigate('/')
    }

    const redirectResetValues = () => {
        dispatch(resetSearchResults())
        dispatch(resetWorkspaceData())
        localStorage.removeItem('query')
        // Keep the last breadcrumb value so reopening a saved task/query restores
        // `Dashboard / Workspace: ...` correctly.
    }

    const resetDocumentSuccessStatus = () => {
        dispatch(setDocumentArraySuccess(false))
        dispatch(setDocumentAddedSuccess(false))
        dispatch(setDocumentRemovedSuccess(false))
        dispatch(setToggleDocumentSuccess(false))
    }

    // const isDocumentSaved = (recordId) => {
    //     const doc = isDocumentSaved(recordId);
    //     return doc && !doc.isRemoved;
    // };

    const getSavedDoc = (recordId) => {
        return capturedDocs.find(d => d.documentId === recordId);
    };

    // const isSaved = (recordId) => {
    //     return !!getSavedDoc(recordId);
    // };

    const isActiveSaved = (recordId) => {
        const doc = getSavedDoc(recordId);
        return doc && !doc.isRemoved;
    };



    /**
     * initialization
     */        
    useEffect(() => {
        if(isError) 
        {
            console.log(message)
        }
        
        console.log(QUERY_STRING)
        const QUERY_STRING1 = localStorage.getItem('query')
        // const CURRENT_WORKSPACENAME = localStorage.getItem('wpname')
        if(QUERY_STRING1 !== null)
        {
            const SERP_REQUEST = {
                "query": QUERY_STRING1,
                "offset": initialPagination.offset,
                "limit": initialPagination.limit
            }
                      
            dispatch(getSearchResultLists(SERP_REQUEST))        
             
            const query_temp = {
                "workspaceId": workspaceId,
                "queryId": queryId
            }
            
            dispatch(getQueryDetails(query_temp))
            
            // Fetch workspace details for history
            if (workspaceId) 
            {
                dispatch(getWorkspaceDetails({ workspaceId }))
            }
        }                       
        
        setCurrentPageIndex(0)

        return () => {
            dispatch(resetSearchResults());
            dispatch(resetDocument());
            dispatch(resetRilData());
            resetDocumentSuccessStatus();
        };
    }, [message, dispatch, QUERY_STRING, workspaceId])
    

    /**
     * current search query is detected, ready to call the search 
     */
    useEffect(() => {
        console.log('isQueryDetailSuccess_', isQueryDetailSuccess)
        if(isQueryDetailSuccess){
            console.log('TT~TT ' , queryDetailObject)
            setCapturedDocs(queryDetailObject.documents)
            const savedTopic = (queryDetailObject.query || queryDetailObject.workspaceName || '').trim()
            setCurrentWorkspace(savedTopic)

            // Restore breadcrumb from the saved search topic
            localStorage.setItem('wpname', savedTopic)
            localStorage.setItem('searchTopic', savedTopic)
            const user_data = {
                'userId': user.data._id
            }
            dispatch(getRilDocumentLists(user_data))       
        }        
    }, [isQueryDetailSuccess]) 

    useEffect(() => {
        console.log('isRilArraySuccess_', isRilArraySuccess)
        if(isRilArraySuccess)
        {
            console.log('RIL list _' , ril_documents)
            setCapturedRilDocs(ril_documents)

            if(ril_documents.length !== 0)
            {
                const documentIds = ril_documents.map(doc => doc._id);
                setTempRils(documentIds);
            }
        }        
    }, [isRilArraySuccess])

    // Fetch "timeline" documents (all users, includes removed) for the current query
    // used both for the History panel and for AI context (so AI can answer info about saved/deleted docs)
    useEffect(() => {
        if (!queryId) 
        {
            setTimelineDocumentsForQuery([]);
            return;
        }

        let cancelled = false;

        async function fetchTimelineDocs() {
            try 
            {
                const res = await documentService.getDocumentsByQueryId(queryId);
                const docs = Array.isArray(res) ? res : [];
                if (!cancelled) setTimelineDocumentsForQuery(docs);
            } 
            catch (e) 
            {
                console.error("Failed to fetch timeline documents for AI context:", e);
                if (!cancelled) setTimelineDocumentsForQuery([]);
            }
        }

        fetchTimelineDocs();
        const interval = setInterval(fetchTimelineDocs, 60000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [queryId])

    // Keep AI/chat context fed even before workspace details finish loading: timeline is authoritative
    // for "who saved what" on this search topic (see GET /document/query/:queryId)
    useEffect(() => {
        if (!queryId) 
        {
            return;
        }
        setWorkspaceHistory((prev) => {
            const timeline = {
                queryId,
                documents: timelineDocumentsForQuery || []
            };
            const name =
                singleWorkspace?.workspace?.name ||
                currentWorkspace ||
                CURRENT_WORKSPACENAME ||
                "";
            if (prev) 
            {
                return { ...prev, timeline };
            }
            return {
                workspaceName: name,
                queries: [],
                timeline
            };
        });
    }, [timelineDocumentsForQuery, queryId, currentWorkspace, CURRENT_WORKSPACENAME, singleWorkspace?.workspace?.name])
    
    // Fetch and set workspace history when workspace details are loaded
    useEffect(() => {
        if (isWorkpsaceDetailSuccess && singleWorkspace) 
        {
            console.log('Workspace details loaded:', singleWorkspace);
            // singleWorkspace contains: workspace, queries (with documents), querySize, docSize
            if (singleWorkspace.queries && Array.isArray(singleWorkspace.queries)) 
            {
                // Filter queries to only include those from the current workspace
                const currentWorkspaceQueries = singleWorkspace.queries.filter(query => {
                    const queryWorkspaceId = query.workspaceId?.toString ? query.workspaceId.toString() : query.workspaceId;
                    const currentWorkspaceIdStr = workspaceId?.toString ? workspaceId.toString() : workspaceId;
                    return queryWorkspaceId === currentWorkspaceIdStr;
                });
                
                setWorkspaceHistory({
                    workspaceName: singleWorkspace.workspace?.name || currentWorkspace || CURRENT_WORKSPACENAME,
                    queries: currentWorkspaceQueries.map(query => ({
                        ...query,
                        documents: query.documents || []
                    })),
                    // Timeline of all users for the currently viewed query, includes removed docs
                    // Keep the docs so the AI can build a compact representation
                    timeline: {
                        queryId,
                        documents: timelineDocumentsForQuery || []
                    }
                });
            }
        }
    }, [isWorkpsaceDetailSuccess, singleWorkspace, currentWorkspace, CURRENT_WORKSPACENAME, workspaceId, queryId, timelineDocumentsForQuery]) 
    

    /**
     * new keyword detected and create query with new keyword
     * start of keyword and query create function
     */
    useEffect(() => {
        console.log('isNewSearchKeyeword detected', isNewSearchKeyword)
        console.log(currentWorkspace)
        if(isNewSearchKeyword !== null)
        {
            const newTopic = (isNewSearchKeyword.keyword || '').trim()
            
            // Keep the breadcrumb aligned with the latest search topic
            setCurrentWorkspace(newTopic)
            localStorage.setItem('wpname', newTopic)
            localStorage.setItem('searchTopic', newTopic)
            const newQueryData = {
                'query': newTopic,
                'userId': user.data._id,
                'username': user.data.username,
                'workspaceId': workspaceId,
                // Save the search topic for breadcrumb restoration
                'workspaceName': newTopic,
                'documents': []
            }
            
            console.log(newQueryData)
            dispatch(createQuery(newQueryData))
        }           
    }, [isNewSearchKeyword])

    useEffect(() => {
        console.log('isQueryCreateSuccess_', isQueryCreateSuccess)
        console.log('singleQuery_ updates_' , singleQuery)
        setCapturedRilDocs([])
        if(isQueryCreateSuccess)
        {
            console.log('* isQueryCreateSuccess_', isQueryCreateSuccess)
            console.log('qureis', quries)
            // setQueryOfCurrentTask(singleQuery)
            // setCapturedDocs(singleQuery.documents)
            navigate('/task/' + workspaceId + '/' + singleQuery._id)
        }

    }, [isQueryCreateSuccess, singleQuery]) 

    /**
     * new keyword detected and create query with new keyword
     * end of keyword and query create function
     */
 

    /**
     * Add or remove documents into workspace & RIL
     * start of function
     */
    const handleDocDragStart = (event, doc) => {
        try 
        {
            const recordId = doc?.pnx?.control?.recordid?.[0];
            if (!recordId) return;

            event.dataTransfer.effectAllowed = 'copy';
            event.dataTransfer.setData('application/x-search-doc-recordid', recordId);

            // Provide a minimal JSON payload as a fallback
            const title = doc?.pnx?.display?.title?.[0] || doc?.pnx?.display?.title || 'Untitled';
            const authors = doc?.pnx?.addata?.au 
                ? (Array.isArray(doc.pnx.addata.au) ? doc.pnx.addata.au.join(', ') : doc.pnx.addata.au)
                : (doc?.pnx?.addata?.addau 
                    ? (Array.isArray(doc.pnx.addata.addau) ? doc.pnx.addata.addau.join(', ') : doc.pnx.addata.addau)
                    : 'Unknown authors');
            const abstract = doc?.pnx?.addata?.abstract?.[0] || doc?.pnx?.addata?.abstract || '';

            const payload = {
                type: 'search-doc',
                payload: {
                    recordId,
                    title,
                    authors,
                    abstract
                }
            };

            event.dataTransfer.setData('application/json', JSON.stringify(payload));
        } 
        catch (error) 
        {
            console.error("Error preparing document for drag:", error);
        }
    };

    /**
     * Add or remove documents into workspace & RIL
     * start of function
     */
    const highlightBookmark = (doc, type) => {                
        // if(type !== 'ril'){
        //     if(capturedDocs.length !== 0){
        //         const recordId = doc.pnx.control.recordid[0]
        //         const selectedDocObject = capturedDocs.find(item => item.documentId === recordId);
        //         const ids = capturedDocs.map(doc => doc.documentId);        
        //         const index = ids.indexOf(recordId); 
                
        //         console.log(ids)
        //         console.log(index)

        //         // if(index === -1){
        //         //     console.log('add ~')
        //         //     setIsDocSaved(true)
        //         //     setTempDoc(prev => [...prev, doc.pnx.control.recordid[0]])
        //         //     addOrRemoveDocuments(doc, undefined)
        //         // }else{
        //         //     console.log('remove ~')
        //         //     setIsDocSaved(false)
        //         //     setTempDoc(prev => prev.filter(id => id !== recordId));
        //         //     // const updatedDocs = [...capturedDocs];                    
        //         //     // updatedDocs.splice(index, 1);                    
        //         //     // setCapturedDocs(updatedDocs);
        //         //     const updatedDocs = capturedDocs.map((d) =>
        //         //     d.documentId === recordId
        //         //         ? { ...d, isRemoved: true }
        //         //         : d
        //         //     );

        //         //     setCapturedDocs(updatedDocs);


        //             setCapturedDocs(updatedDocs);
                    
                    
        //             console.log(capturedDocs)
        //             console.log(tempDocs)
        //             // addOrRemoveDocuments(doc, selectedDocObject)
        //         }
        //     }else{
        //         setIsDocSaved(true)
        //         setTempDoc(prev => [...prev, doc.pnx.control.recordid[0]])
        //         addOrRemoveDocuments(doc, undefined)
        //         console.log(tempDocs)
        //     } 
        // }else{
        //     if(capturedRilDocs.length !== 0){
        //         const recordId = doc.pnx.control.recordid[0]
        //         const selectedDocObject = capturedRilDocs.find(item => item.documentId === recordId);
        //         const ids = capturedRilDocs.map(doc => doc.documentId);        
        //         const index = ids.indexOf(recordId); 
    
        //         if(index === -1){
        //             console.log('add ril ~')   
        //             setTempRils(prev => [...prev, doc.pnx.control.recordid[0]])    
        //             console.log(tempRils, doc.pnx.control.recordid[0])                                 
        //             addOrRemoveRils(doc, undefined)
        //         }else{
        //             console.log('remove ril ~', selectedDocObject)
        //             console.log(tempRils)
        //             setTempRils(prev => prev.filter(id => id !== recordId));
        //             const updatedRils = [...capturedRilDocs];                    
        //             updatedRils.splice(index, 1);                    
        //             setCapturedRilDocs(updatedRils);

        //             addOrRemoveRils(doc, selectedDocObject)
        //         }
        //     }else{
        //         addOrRemoveRils(doc, undefined)
        //     }
        // }    
        
        if (type !== 'ril') 
        {
            const recordId = doc.pnx.control.recordid[0];
            const selectedDocObject = capturedDocs.find(item => item.documentId === recordId);

            if (!selectedDocObject) 
            {
                // FIRST TIME SAVE
                addOrRemoveDocuments(doc, undefined);
            } 
            else 
            {
                // TOGGLE SAVE (soft delete)
                dispatch(toggleDocumentSave(selectedDocObject._id))
                .unwrap()
                .then((updatedDoc) => {
                    // Normalize the updated document
                    const normalizedDoc = {
                        ...updatedDoc.data,
                        isRemoved: updatedDoc.data.doc_isRemoved ?? updatedDoc.data.isRemoved ?? false
                    };
                    // update capturedDocs only for the current query
                    setCapturedDocs(prev => prev.map(d => 
                        d._id === normalizedDoc._id && d.queryId === queryId ? normalizedDoc : d
                    ));
                    
                    // Refetch documents to ensure timeline gets updated
                    const query_temp = {
                        "workspaceId": workspaceId,
                        "queryId": queryId
                    };
                    dispatch(getDocumentListsByQueryId(query_temp));
                    // Refresh workspace-wide history immediately so the Research
                    // Timeline reflects this save/unsave right away, not on next poll
                    refreshWorkspaceHistory();
                })
                .catch((error) => {
                    console.error("Failed to toggle document save:", error);
                });
            }
            return;
        }
    };

    const buildFullDisplayUrl = (doc1) => {
        const baseUrl =
            "https://casls-regina.primo.exlibrisgroup.com/discovery/fulldisplay?";
        const docid = doc1.pnx.control.recordid[0];
        const context = doc1.context; // e.g., "L"
        const vid = "01CASLS_REGINA:01CASLS_REGINA";
        const lang = "en";
        const search_scope = "MyInst_and_CI";
        const adaptor = doc1.adaptor; // e.g., "Local Search Engine"
        const tab = "Everything";
        const query = "any,contains,data";
        const mode = "Basic";
        return `${baseUrl}docid=${docid}&context=${context}&vid=${vid}&lang=${lang}&search_scope=${search_scope}&adaptor=${encodeURIComponent(
            adaptor
        )}&tab=${tab}&query=${query}&mode=${mode}`;
    };

    const addOrRemoveDocuments = (doc, selectedDoc) => { 
        console.log('add or remove doc')
        console.log(doc)
        console.log(selectedDoc)
        // console.log('temp_', tempDocs)

        if(selectedDoc !== undefined)
        {            
            const DOC_TEMP_REMOVE ={
                "documentId": selectedDoc._id,                                
                "workspaceId": workspaceId,
                "queryId": queryId
            }
    
            console.log('DOC_TEMP_REMOVE ', DOC_TEMP_REMOVE)
            dispatch(removeDocumentFromWorkspace(DOC_TEMP_REMOVE))            
        }
        else
        {
            console.log("**", doc.delivery)
            const DOC_TEMP ={
                "documentId": doc.pnx.control.recordid[0],
                "userId": user.data._id,
                "username": user.data.username,
                "workspaceId": workspaceId,
                "queryId": queryId,
                "title": doc.pnx.display.title[0],
                "doc_type": doc.pnx.display.type[0],
                "doc_authors": doc.pnx.addata.au,
                "doc_abstract": (doc.pnx.addata.abstract !== undefined) ? doc.pnx.addata?.abstract[0] : '',
                "doc_date": (doc.pnx.display.creationdate !== undefined) ? doc.pnx.display.creationdate : doc.pnx.facets.creationdate,                
                "doc_thumbnail" : (doc.pnx.addata.isbn !== undefined) ? doc.pnx.addata.isbn[0] : (doc.pnx.addata.doi !== undefined) ? doc.pnx.addata.doi[0] : undefined,
                "thumbnail_type": (doc.pnx.addata.isbn !== undefined) ? 'isbn' : (doc.pnx.addata.doi !== undefined) ? 'doi' : undefined,
                "doc_partof": (doc.pnx.display.ispartof !== undefined) ? doc.pnx.display.ispartof[0] : '', 
                "doc_peerreview" : (doc.pnx.display.lds50 !== undefined) ? true : false,
                "doc_openaccess": (doc.pnx.addata.oa !== undefined) ? true : false,
                "doc_fulltext": (doc.delivery !== undefined) ? doc.delivery.availability[0] : undefined,
                "doc_onlineaccess": '',
                "doc_getPdf": '',
                "doc_downloadPdf": '',
                "doc_url":buildFullDisplayUrl(doc)
            }
    
            console.log('DOC_TEMP_ ', DOC_TEMP)
            
            dispatch(saveDocumentToWorkspace(DOC_TEMP))
                .unwrap()
                .then(() => refreshWorkspaceHistory())
                .catch((error) => console.error("Failed to save document:", error));
        }
    }

    /* (UI paths commented out above)
    const addOrRemoveRils = (doc, selectedDoc) => {
        console.log('add or remove ril')

        if(selectedDoc !== undefined){
            const DOC_TEMP_REMOVE ={
                "id": selectedDoc._id
            }

            console.log('DOC_TEMP_REMOVE ', DOC_TEMP_REMOVE)
            dispatch(removeDocumentFromRil(DOC_TEMP_REMOVE))
        }else{
            const DOC_TEMP ={
                "documentId": doc.pnx.control.recordid[0],
                "userId": user.data._id,
                "queryName": QUERY_STRING,
                "queryId": queryDetailObject._id,
                "title": doc.pnx.display.title[0],
                "doc_type": doc.pnx.display.type[0],
                "doc_authors": doc.pnx.addata.au,
                "doc_abstract": (doc.pnx.addata.abstract !== undefined) ? doc.pnx.addata.abstract[0] : '',
                "doc_date": (doc.pnx.display.creationdate !== undefined) ? doc.pnx.display.creationdate : doc.pnx.facets.creationdate,
                "doc_thumbnail" : (doc.pnx.addata.isbn !== undefined) ? doc.pnx.addata.isbn[0] : (doc.pnx.addata.doi !== undefined) ? doc.pnx.addata.doi[0] : undefined,
                "thumbnail_type": (doc.pnx.addata.isbn !== undefined) ? 'isbn' : (doc.pnx.addata.doi !== undefined) ? 'doi' : undefined,
                "doc_partof": (doc.pnx.display.ispartof !== undefined) ? doc.pnx.display.ispartof[0] : '',
                "doc_peerreview" : (doc.pnx.display.lds50 !== undefined) ? true : false,
                "doc_openaccess": (doc.pnx.addata.oa !== undefined) ? true : false,
                "doc_fulltext": (doc.delivery !== undefined) ? doc.delivery.availability[0] : undefined,
                "doc_onlineaccess": '',
                "doc_getPdf": '',
                "doc_downloadPdf": '',
                "doc_url":buildFullDisplayUrl(doc)
            }

            console.log('DOC_TEMP_ ', DOC_TEMP)

            dispatch(saveDocumentToRil(DOC_TEMP))
        }
    }
    */

    useEffect(() => { 
        console.log('add ril_', isAddToRilSuccess)       
        if(isAddToRilSuccess || isRemoveFromRilSuccess)
        {
            console.log('ril is added_')
            const user_data = {
                'userId': user.data._id
            }
            dispatch(getRilDocumentLists(user_data))
            dispatch(getRilDocumentCount(user_data))
        }
    }, [ isAddToRilSuccess, isRemoveFromRilSuccess ])  
    
    useEffect(() => {        
        console.log('isDocumentArraySuccess_', isDocumentArraySuccess)
        console.log('documents updates_', documents)
        console.log('ril docs are_ ', capturedRilDocs)
        if(isAddDocumentSuccess || isRemoveDocumentSuccess || isToggleDocumentSuccess)
        {
            console.log('add/remove/toggle doc is true')
            const query_temp = {
                "workspaceId": workspaceId,
                "queryId": queryId
            }
            
            dispatch(getDocumentListsByQueryId(query_temp))
            
        }
        
        if(isDocumentArraySuccess)
        {
            // console.log('doc has updated_', documents)            
            // setCapturedDocs(documents)
            // // setCurrentWorkspace(queryDetailObject.workspaceName)  
        
            setCapturedDocs(documents.filter(doc => doc.queryId === queryId));
        }
    }, [ isAddDocumentSuccess, isRemoveDocumentSuccess, isToggleDocumentSuccess, isDocumentArraySuccess])

    
    /**
     * Add or remove documents into workspace & RIL
     * end of function
     */        

    // Block-style pagination window: page numbers 1-9 are shown first; once
    // the visible pages are exhausted, the window jumps forward in blocks of
    // 10 (10-19, 20-29, ...) instead of listing every page up front.
    const PAGE_WINDOW_SIZE = 10;
    const getPageWindow = (currentPage1Indexed, totalPages) => {
        if (currentPage1Indexed <= 9)
        {
            return { start: 1, end: Math.min(9, totalPages) };
        }
        const blockIndex = Math.floor((currentPage1Indexed - 10) / PAGE_WINDOW_SIZE);
        const start = 10 + blockIndex * PAGE_WINDOW_SIZE;
        return { start, end: Math.min(start + PAGE_WINDOW_SIZE - 1, totalPages) };
    }

    const goToPage = (pageIndexZeroBased, pageCount) => {
        if (pageIndexZeroBased < 0 || pageIndexZeroBased > pageCount - 1) return;

        const skip = limitperpage * pageIndexZeroBased;

        const SERP_REQUEST = {
            "query": queryDetailObject.query,
            "offset": skip,
            "limit": limitperpage
        }

        if(skip < 2000)
        {
            setCurrentPageIndex(pageIndexZeroBased)
            dispatch(getSearchResultLists(SERP_REQUEST))

            if (scrollToTopRef.current)
            {
                scrollToTopRef.current.scrollTo({ top: 0, behavior: 'smooth' });  // Scroll to top of the container
            }
        }
        else
        {
            alert('offset is over the limit the Primo API can handle. The recomended maximim offset is 2000.')
        }
    }

    // Run a HERMES-suggested query: same action the search box's submit button
    // performs — spawn a new Query under this workspace and let the
    // isQueryCreateSuccess effect above navigate to it once it's created.
    const runSuggestedQuery = (suggestedQueryText) => {
        const normalizedKeyword = String(suggestedQueryText || '').trim();
        if (!normalizedKeyword) return;

        localStorage.setItem('query', normalizedKeyword);
        localStorage.setItem('wpname', normalizedKeyword);
        localStorage.setItem('searchTopic', normalizedKeyword);

        const newQueryData = {
            'query': normalizedKeyword,
            'userId': user.data._id,
            'username': user.data.username,
            'workspaceId': workspaceId,
            'workspaceName': normalizedKeyword,
            'documents': []
        }
        dispatch(createQuery(newQueryData))
    }

    // Prepare queries data for timeline
    const timelineQueries = queryDetailObject?._id
        ? [{
            ...queryDetailObject,
            documents: capturedDocs || queryDetailObject.documents || [],
            searchTopic: localStorage.getItem("searchTopic") || queryDetailObject.query
          }]
        : [];

    return (
        <div>      
            <Header />      
            
            {/* search results */}            
            <div className="mt_22 layoutWrapper">
                <div className="mainPanel">  
                    <div className={`flex items-center px-6 py-2.5 nav_wrap`} >
                        <div className='flex items-center cursor-pointer text-ink-muted hover:text-navy transition ease-out' onClick={redirectToDashboard}>
                            <FaChevronLeft className="text-xs" />
                            <p className='text-xs ml-2'>Dashboard</p>
                        </div>
                        <span className='px-3 text-xs text-ink-muted'>/</span>
                        <div className='flex items-center cursor-pointer text-ink-muted hover:text-navy transition ease-out' onClick={redirectToWorkspace}>                        
                            <p className='text-xs ml-2'> Workspace: {CURRENT_WORKSPACENAME}</p>  
                        </div>
                        <span className='px-3 text-xs text-ink-muted'>/</span>
                        <p className='text-xs font-medium text-ink'>Search results</p>                 
                    </div>              
                    
                    {isSERPLoading && <div><Loading /></div> }
                    <> 
                        <div className="my-6 mx-8">
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-mono uppercase tracking-widest text-ink-muted font-medium">
                                        Search Results:
                                        {contents.docs?.length > 0 ? (
                                            <span className="pl-2 text-ink">
                                                {Number(contents.info?.total).toLocaleString()}
                                            </span>
                                        ) : (
                                            <span className="pl-2 text-ink">0</span>
                                        )}
                                    </h3>
                                </div>
                                {QUERY_STRING !== null && (
                                    <div className="w-full flex justify-center">
                                        <div className="w-full max-w-3xl">
                                            <SearchComponent />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        {contents.docs?.length > 0 &&
                            <> 
                                <div ref={scrollToTopRef} className={`${styles.listing_container}`}>     
                                    
                                    {contents.docs.map((data) => (                                    
                                        <div key={data.pnx.control.recordid[0]} className={`flex group ${styles.cmb_4}`}>
                                        
                                        <div>
                                            <div 
                                                className={`border border-archival-border flex ${styles.book_cover}`}
                                                draggable
                                                onDragStart={(event) => handleDocDragStart(event, data)}
                                            >  
                                                {data.pnx.addata.isbn !== undefined ?
                                                    <>       
                                                        {/* X_X                                                          */}
                                                        <img
                                                            className={`object-contain w-full h-full`}
                                                            src={isbn_url + data.pnx.addata.isbn[0] + '/sc.jpg'}
                                                            alt="Document Thumbnail"
                                                        />
                                                    </> :
                                                    <>
                                                        {data.pnx.addata.doi !== undefined &&
                                                            <>
                                                                {/* @_@ */}
                                                                <RenderDocumentThumbnail doi={data.pnx.addata.doi[0]} docType="others" />
                                                            </> 
                                                        }
                                                    </>
                                                }
                                            </div>
                                            <div>
                                                <div className='mt-2 justify-between'>
                                                    <div className={`
                                                        relative mb-2 
                                                        ${styles.has_tooltip}
                                                        ${capturedRilDocs.find(doc => doc.documentId === data.pnx.control.recordid[0]) ? 'pointer-events-none opacity-60' : ''}
                                                        `}>
                                                        <div onClick={() => highlightBookmark(data, 'workspace')}
                                                            className={`cursor-pointer flex items-center justify-center gap-1 h-6 px-2.5 rounded relative border transition-colors
                                                            ${isActiveSaved(data.pnx.control.recordid[0]) ? styles.highlighted_bookmark_icon : styles.bookmark_bg}`}>

                                                            <FaBookmark
                                                                className={`text-[10px] ${isActiveSaved(data.pnx.control.recordid[0]) ? 'text-white' : 'text-ink-muted'}`}
                                                            />
                                                            <p className={`text-[11px] font-medium
                                                                ${isActiveSaved(data.pnx.control.recordid[0]) ? 'text-white' : 'text-ink-muted'}`}>
                                                                    {isActiveSaved(data.pnx.control.recordid[0]) ? 'Saved' : 'Save'}
                                                            </p>
                                                        </div>
                                                        
                                                        <span className={`rounded text-xs text-center absolute z-10 shadow-lg p-1 bg-white border border-archival-border text-ink-muted -mt-8 ${styles.tooltip_bookmark}`}>
                                                            Save Document
                                                        </span>
                                                    </div>
                                                    {/*<div onClick={() => highlightBookmark(data, 'ril')} */}
                                                    {/*    className={`*/}
                                                    {/*        relative */}
                                                    {/*        ${styles.has_tooltip}*/}
                                                    {/*        ${capturedDocs.find(doc => doc.documentId === data.pnx.control.recordid[0]) ? 'pointer-events-none opacity-60' : ''} */}
                                                    {/*        ${tempDocs.includes(data.pnx.control.recordid[0]) ? 'pointer-events-none opacity-60' : ''}*/}
                                                    {/*    `}>*/}
                                                    {/*    <div className={`*/}
                                                    {/*        cursor-pointer items-center border border-2 rounded-md relative */}
                                                    {/*        ${capturedRilDocs.find(doc => doc.documentId === data.pnx.control.recordid[0]) ? styles.ril_wrap + ' ' + styles.highlighted_bookmark_icon : styles.ril_wrap}*/}
                                                    {/*        ${tempRils.includes(data.pnx.control.recordid[0]) ? styles.ril_wrap + ' ' + styles.highlighted_bookmark_icon : styles.ril_wrap}*/}
                                                    {/*        `}>*/}
                                                    {/*        <FaBookmark className={`absolute top-0 right-0 ${styles.ril_icon} */}
                                                    {/*            ${capturedRilDocs.find(doc => doc.documentId === data.pnx.control.recordid[0]) ? styles.highlighted_bookmark_icon : ''}*/}
                                                    {/*            ${tempRils.includes(data.pnx.control.recordid[0]) ? styles.highlighted_bookmark_icon : '' }*/}
                                                    {/*        `} />*/}
                                                    {/*        <p className={`uppercase text-sm text-center font-semibold */}
                                                    {/*            ${capturedRilDocs.find(doc => doc.documentId === data.pnx.control.recordid[0]) ? 'text-white' : 'text-slate-500'}*/}
                                                    {/*            ${tempRils.includes(data.pnx.control.recordid[0]) ? 'text-white' : 'text-slate-500' }*/}
                                                    {/*        `}>ril</p>*/}
                                                    {/*    </div>*/}
                                                    {/*    <span className={`rounded absolute text-xs text-center shadow-lg p-1 bg-gray-100 text-slate-500 -mt-8 ${styles.tooltip_ril}`}>Read It Later</span>*/}
                                                    {/*</div>*/}
                                                    
                                                </div>
                                            </div>
                                        </div>
                                        <SERPDocumentComponent
                                            doc={data}
                                            onDocDragStart={handleDocDragStart}
                                            onViewDocument={(doc) => logDocumentView(doc.pnx.control.recordid[0], doc.pnx.display.title[0], queryId)}
                                        />
                                    </div>
                                ))}

                                <div>
                                {contents.info?.total !== undefined &&
                                    <>
                                        {contents.info?.total > 10 &&
                                            (() => {
                                                const pageCount = Math.ceil(contents.info.total / limitperpage);
                                                const { start: windowStart, end: windowEnd } = getPageWindow(currentPageIndex + 1, pageCount);
                                                const pageNumbers = [];
                                                for (let i = windowStart; i <= windowEnd; i++) pageNumbers.push(i);

                                                return (
                                                    <div className='flex items-center justify-center mt-8 mb-4 font-mono text-sm'>
                                                        <button
                                                            type="button"
                                                            onClick={() => goToPage(currentPageIndex - 1, pageCount)}
                                                            disabled={currentPageIndex === 0}
                                                            className='w-10 h-10 flex items-center justify-center bg-parchment-secondary text-ink-muted rounded-md mr-3 disabled:opacity-40 disabled:cursor-not-allowed'
                                                        >
                                                            <FaAngleLeft />
                                                        </button>

                                                        {windowStart > 1 &&
                                                            <button
                                                                type="button"
                                                                onClick={() => goToPage(windowStart - 2, pageCount)}
                                                                className='mr-4 ml-3 text-ink-muted hover:text-navy transition-colors'
                                                            >
                                                                ...
                                                            </button>
                                                        }

                                                        {pageNumbers.map((pageNum) => (
                                                            <button
                                                                type="button"
                                                                key={pageNum}
                                                                onClick={() => goToPage(pageNum - 1, pageCount)}
                                                                className={`block border border-archival-border pagination_element m-1 w-10 h-10 flex items-center justify-center rounded-md transition-colors ${currentPageIndex + 1 === pageNum ? '!bg-navy !text-white !border-navy' : 'text-ink-muted hover:text-white hover:bg-navy'}`}
                                                            >
                                                                {pageNum}
                                                            </button>
                                                        ))}

                                                        {windowEnd < pageCount &&
                                                            <button
                                                                type="button"
                                                                onClick={() => goToPage(windowEnd, pageCount)}
                                                                className='mr-4 ml-3 text-ink-muted hover:text-navy transition-colors'
                                                            >
                                                                ...
                                                            </button>
                                                        }

                                                        <button
                                                            type="button"
                                                            onClick={() => goToPage(currentPageIndex + 1, pageCount)}
                                                            disabled={currentPageIndex + 1 >= pageCount}
                                                            className='w-10 h-10 flex items-center justify-center bg-parchment-secondary text-ink-muted rounded-md ml-3 disabled:opacity-40 disabled:cursor-not-allowed'
                                                        >
                                                            <FaAngleRight />
                                                        </button>
                                                    </div>
                                                );
                                            })()
                                        }
                                    </>
                                }
                                </div>
                            </div>
                        </>
                    }
                    {contents.info?.total === 0 && 
                        <div className={`${styles.listing_container} text-ink-muted text-sm`}>     
                            No documents found.
                        </div>
                    }
                </>
                </div>
                <RightRail
                    historyContent={
                        isQueryDetailSuccess && timelineQueries.length > 0 ? (
                            <UserTimeline
                                queries={timelineQueries}
                                allWorkspaceQueries={workspaceHistory?.queries || []}
                                setPageLoading={setPageLoading}
                                setShowDetails={setShowDetails}
                                setDetails={setDetails}
                                queryId={queryId}
                                workspaceId={workspaceId}
                                queryText={QUERY_STRING || queryDetailObject?.query || ''}
                                currentUsername={user?.data?.username || ''}
                                currentUserId={user?.data?._id || null}
                                viewLogs={viewLogs}
                                onLogView={logDocumentView}
                            />
                        ) : null
                    }
                    chatContent={
                        <ChatComponent
                            currentUsername={user?.data?.username || ''}
                            currentUserIndex={0}
                            documents={contents.docs || []}
                            workspaceHistory={workspaceHistory}
                            workspaceId={workspaceId}
                            queryId={queryId}
                            queryText={QUERY_STRING || queryDetailObject?.query || ''}
                            currentUserId={user?.data?._id || null}
                            onRunSuggestedQuery={runSuggestedQuery}
                        />
                    }
                />
            </div>

        


        </div>
    )
}

export default ContentListsComponent;