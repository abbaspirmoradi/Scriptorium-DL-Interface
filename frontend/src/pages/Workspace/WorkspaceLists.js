import React, {useState, useRef, useEffect} from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Workspace.module.css';
import { setSelectedWorkspace, updateWorkspace } from '../../features/workspace/workspaceSlice';
import { useDispatch, useSelector } from 'react-redux';
import { FaRegFileLines, FaMagnifyingGlass, FaEllipsisVertical, FaTrashCan, FaPenToSquare, FaArrowRotateLeft } from "react-icons/fa6";
import {motion} from "framer-motion";
import ModalComponent from '../../components/Modal/Modal';

function WorkspaceLists({data, rilData, currentUserId}) {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const dropdownRef = useRef(null);
    const [isDropdown, setIsDropdown] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [currentWorkspace, setCurrentWorkspace] = useState('')
    const {ril_documents, isRilLoading} = useSelector((state) => state.ril)    
    const [inputFormData, setInputFormData] = useState("")

    const listsVariants = {
        hidden: {
            opacity: 0,
            y: 100
        },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: 'spring',
                stiffness: 350,
                damping: 50,
                duration: 0.5
            }
        }
    }

    const dropdownVariants = {
        hidden: {
            opacity: 0,
            y: 10
        },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: 'spring',
                stiffness: 350,
                damping: 50,
                duration: 0.5
            }
        }
    }

    const fetchWorkspaceDetails = (wsp) =>{
        if(wsp.archive === true){
            navigate('/workspace/' + wsp._id)
        }
    }

    // Jump straight into the SRP page for this workspace's most recent query —
    // "resume" means continue exactly where the task was left, not re-pick a topic.
    const taskResumeHandler = (workspace) => {
        if (workspace.archive !== true || !workspace.latestQueryId) return;

        const latestQueryText = workspace.latestQueryText || workspace.name;
        localStorage.setItem('query', latestQueryText);
        localStorage.setItem('wpname', workspace.name);
        localStorage.setItem('searchTopic', latestQueryText);

        dispatch(setSelectedWorkspace(workspace));
        navigate('/task/' + workspace._id + '/' + workspace.latestQueryId);
    }

    const dropDownHandler = (wId) => {
        setIsDropdown(!isDropdown);
        setCurrentWorkspace(wId)
    }

    useEffect(() => {
        const handleOutsideClick = (event) => {
          if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {            
            setIsDropdown(false);
          }
        };
    
        document.addEventListener('mousedown', handleOutsideClick);
    
        return () => {
          document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, []);

    const editWorkspace = (wpData) => {
        // console.log(id)
        setIsEdit(true)
        setInputFormData(wpData)
        setIsDropdown(false);
    }

    const archiveOrRestoreWrokspace = (data) => {
        console.log('archive the workspace')
        // 
        const temp = {
            'id': data._id,
            'name': data.name,
            'archive': !data.archive,
            'userId': data.userId
        }
        dispatch(updateWorkspace(temp))
    }    


    return (
        <>
            {data.length > 0 &&
                <motion.div variants={listsVariants} initial="hidden" animate="visible">
                    <div className={`pt-2 pb-10 ${styles.list_container}`}>
                        <div className={`relative ${styles.mx_44}`}>
                            {/* Column header — mirrors the row layout below so counts/actions line up */}
                            <div className="flex items-center gap-6 px-5 pb-2 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                                <div className="min-w-0 flex-1">Workspace</div>
                                <div className="w-12 text-center flex-shrink-0">Searches</div>
                                <div className="w-12 text-center flex-shrink-0">Docs</div>
                                <div className="w-[188px] flex-shrink-0"></div>
                                <div className="w-6 flex-shrink-0"></div>
                            </div>

                            <div className="flex flex-col rounded-lg border border-archival-border bg-white shadow-sm overflow-hidden">
                                {data.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((workspace, index, sorted) => {
                                    const isOwnWorkspace = currentUserId && workspace.userId && workspace.userId.toString() === currentUserId.toString();
                                    const isLastRow = index === sorted.length - 1;
                                    return (
                                        <div
                                            key={`${workspace._id}-${index}`}
                                            className={`
                                                flex items-center gap-6 px-5 py-3 transition-colors
                                                ${!isLastRow ? 'border-b border-archival-border' : ''}
                                            `}
                                        >
                                            {/* Workspace name + creator — primary identity, gets the most room */}
                                            <div
                                                className={`min-w-0 flex-1 ${workspace.archive === true ? 'cursor-pointer' : ''}`}
                                                onClick={() => fetchWorkspaceDetails(workspace)}
                                            >
                                                <p className={`font-serif text-[15px] font-medium text-ink capitalize truncate transition-colors ${workspace.archive === true ? 'hover:text-navy' : ''}`}>
                                                    {workspace.name.length > 160 ?
                                                        `${workspace.name.substring(0, 160)}...` :
                                                        workspace.name
                                                    }
                                                </p>
                                                <p className='text-xs font-mono text-ink-muted mt-0.5'>
                                                    by {isOwnWorkspace ? 'you' : (workspace.ownerUsername || 'unknown')}
                                                </p>
                                            </div>

                                            {/* Search count */}
                                            <div
                                                className={`flex items-center justify-center gap-1.5 w-12 flex-shrink-0 transition-colors ${styles.link_default_color} ${workspace.archive === true ? 'cursor-pointer hover:text-navy' : ''}`}
                                                onClick={() => fetchWorkspaceDetails(workspace)}
                                                title={`${workspace.querySize || 0} searches`}
                                            >
                                                <FaMagnifyingGlass className='text-base' />
                                                <span className='font-mono font-medium text-xs'>{workspace.querySize}</span>
                                            </div>

                                            {/* Saved document count */}
                                            <div
                                                className={`flex items-center justify-center gap-1.5 w-12 flex-shrink-0 transition-colors ${styles.doc_default_color} ${workspace.archive === true ? 'cursor-pointer hover:text-accent' : ''}`}
                                                onClick={() => fetchWorkspaceDetails(workspace)}
                                                title={`${workspace.docSize || 0} saved documents`}
                                            >
                                                <FaRegFileLines className='text-base' />
                                                <span className='font-mono font-medium text-xs'>{workspace.docSize}</span>
                                            </div>

                                            {/* Actions: View (workspace overview) is the lighter, secondary action;
                                                Resume task (jump into the latest query's SRP) is the primary one. */}
                                            <div className="flex items-center gap-2 w-[188px] flex-shrink-0">
                                                <button
                                                    type='button'
                                                    onClick={() => fetchWorkspaceDetails(workspace)}
                                                    disabled={workspace.archive !== true}
                                                    className={`
                                                        w-16 flex-shrink-0 text-xs font-mono px-2 py-1.5 rounded-md border transition-colors text-center
                                                        ${workspace.archive === true
                                                            ? 'cursor-pointer border-archival-border text-ink-muted hover:text-navy hover:border-navy'
                                                            : 'cursor-not-allowed opacity-40 border-archival-border text-ink-muted'}
                                                    `}
                                                >
                                                    View
                                                </button>
                                                <button
                                                    type='button'
                                                    onClick={() => taskResumeHandler(workspace)}
                                                    disabled={workspace.archive !== true || !workspace.latestQueryId}
                                                    title={!workspace.latestQueryId ? 'No searches in this workspace yet' : undefined}
                                                    className={`
                                                        flex-1 text-xs font-mono px-3 py-1.5 rounded-md border transition-colors text-center
                                                        ${(workspace.archive === true && workspace.latestQueryId)
                                                            ? 'cursor-pointer border-archival-border text-ink-muted hover:text-navy hover:border-navy'
                                                            : 'cursor-not-allowed opacity-40 border-archival-border text-ink-muted'}
                                                    `}
                                                >
                                                    Resume task
                                                </button>
                                            </div>

                                            {/* Owner-only actions */}
                                            <div className="relative w-6 flex-shrink-0">
                                                {isOwnWorkspace &&
                                                    <div onClick={() => dropDownHandler(workspace._id)} className={`p-1 rounded ${styles.dropdown_wrap}`}>
                                                        <FaEllipsisVertical className={styles.dropdown_icon} />
                                                    </div>
                                                }
                                                {(isOwnWorkspace && isDropdown && currentWorkspace === workspace._id) && (
                                                    <div ref={dropdownRef}>
                                                        <motion.div variants={dropdownVariants} initial="hidden" animate="visible">
                                                            <div className="absolute right-0 top-7 z-10 bg-white border border-archival-border shadow-lg rounded-lg w-[200px] p-4">
                                                                {workspace.archive === true &&
                                                                    <div onClick={() => editWorkspace(workspace)} className='flex items-center mb-2 cursor-pointer'>
                                                                        <FaPenToSquare className='text-agent-clio' />
                                                                        <span className='ml-2 text-ink-muted text-sm'>Edit</span>
                                                                    </div>
                                                                }
                                                                <div onClick={() => archiveOrRestoreWrokspace(workspace)} className='flex items-center cursor-pointer'>
                                                                    {workspace.archive !== true ? <>
                                                                        <FaArrowRotateLeft className='text-ink-muted' />
                                                                        <span className='ml-2 text-ink-muted text-sm'>Restore</span>
                                                                    </> : <>
                                                                        <FaTrashCan className='text-red-600' />
                                                                        <span className='ml-2 text-ink-muted text-sm'>Archive</span>
                                                                    </>}
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <ModalComponent isVisible={isEdit} onModalClose={() => setIsEdit(false)} inputValue={inputFormData}/>
                </motion.div>
            }
        </>
    )
}

export default WorkspaceLists;