import React, { useState, useEffect, useRef } from "react";
import styles from "./Header.module.css";
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import SearchComponent from '../Search/Search';
import { FaArrowRightFromBracket, FaRegFileLines } from "react-icons/fa6";
import { LuBookOpen, LuLayers } from 'react-icons/lu';
import { logOut, reset } from '../../features/Auth/AuthSlice';
import { getRilDocumentCount, resetRilData } from "../../features/RIL/rilSlice";

function HeaderComponent() {
    const navigate = useNavigate();
    const location = useLocation(); 
    const dispatch = useDispatch();   
    const dropdownRef = useRef(null);

    const {user, isError, message} = useSelector((state) => state.auth)
    const { count } = useSelector((state) => state.ril);
    const selectedWorkspace = useSelector((state) => state.workspace.selectedWorkspace);
    const [isDropdown, setIsDropdown] = useState(false);
    const [isMenuDropdown, setIsMenuDropdown] = useState(false);

    const isRIL = location.pathname;

    const redirectToHome = (event) => {
        console.log('logo is clicked to redirect home')
        console.log('====', location.state , '====')

        navigate('/', {state: null})
        // navigate('/', { state: null });
    }

    const logoutHandler = (event) => {        
        dispatch(logOut());
        navigate('/')
    };

    const redirectToRil = () => {
        navigate('/ril')
    }

    useEffect(() => {
        if(isError) {
            console.log(message)
        }

        if(!user || !user.data){
            navigate('/login')
        }else{
            const user_data = {
                userId: user.data._id
            }
            if(!isError){
                dispatch(getRilDocumentCount(user_data))
            }
        }

        console.log('initailization from dh... ')        

        return() => {
            dispatch(resetRilData())
        }
    }, [navigate, isError, message, dispatch, user])

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

    return (
        <>
        {user !== null && user.data &&
            <div className={`flex justify-between w-full z-20 items-center px-6 ${styles.header_container}`}>
                <div onClick={redirectToHome} className={`cursor-pointer ${styles.brand}`}>
                    <div className={styles.brandIcon}>
                        <LuBookOpen size={22} color="#fff" />
                    </div>
                    <div className={styles.brandTitle}>Scriptorium</div>
                </div>

                <div className='flex items-center'>       
                    <div className='flex items-center'>
                        <div className='mr-8'>
                            {/*<div className={`*/}
                            {/*    border-2 border-gray-950 py-1.5 px-4 rounded-full*/}
                            {/*    ${isRIL === '/ril' ? styles.ril_bg : ''} */}
                            {/*    `}>*/}
                            {/*    <div className="cursor-pointer flex items-center hover:text-indigo-800 transition ease-in-out-800" onClick={redirectToRil}>*/}
                            {/*        <div className={`flex items-center doc_default_color`}>*/}
                            {/*            <FaRegFileLines className={`text-xl`} />*/}
                            {/*            <span className="ml-2">RIL - </span>*/}
                            {/*            <div>*/}
                            {/*                <p className='ml-2 font-bold'>{count}</p>*/}
                            {/*            </div>*/}
                            {/*        </div>*/}
                            {/*    </div>*/}
                            {/*</div>*/}
                        </div>
                        {/* Gere dropdown   */}
                        {(selectedWorkspace?.name || user.data?.workspace) && (
                            <div className={styles.workspaceBadge + ' ' + 'mr-4'}>
                                <LuLayers size={16} color="rgba(255,255,255,0.9)" className="inline mr-2" />
                                Workspace: {selectedWorkspace?.name || user.data?.workspace}
                            </div>
                        )}

                        <div className="relative" ref={dropdownRef}>
                            <div onClick={() => setIsDropdown(!isDropdown)} className='flex items-center cursor-pointer'>
                                <div className={styles.avatar + ' ml-1'} title={user.data?.username || 'User'}>
                                    {(user.data?.username || 'U').charAt(0).toUpperCase()}
                                </div>
                            </div>
                            {isDropdown && (
                                <div className="absolute right-0 bg-white border border-archival-border shadow-xl rounded-xl w-[190px] p-3 mt-1">
                                    <button onClick={logoutHandler}
                                        className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg bg-parchment-secondary text-ink-muted hover:bg-navy hover:text-white transition-colors duration-200">
                                        <FaArrowRightFromBracket className="text-base" />
                                        <span className="font-medium">Logout</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        }
        </>
    )
}

export default HeaderComponent;
