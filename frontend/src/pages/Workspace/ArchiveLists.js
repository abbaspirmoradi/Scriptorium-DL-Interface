import React, {useState, useEffect} from "react";
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { FaChevronLeft } from "react-icons/fa6";

import { getArchives, resetWorkspaceData } from '../../features/workspace/workspaceSlice';
import Header from '../../components/Header/Header';
import WorkspaceLists from "../Workspace/WorkspaceLists";

function ArchiveComponent() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const {user} = useSelector((state) => state.auth);
    const {workspaces, singleWorkspace, isLoading, isError, message} = useSelector((state) => state.workspace); 

    const backToHome = () => {        
        navigate('/')
    }

    useEffect(() => {        
        if(!user){
            navigate('/login')
        }else{
            const user_data = {
                userId: user.data._id
            }
            if(!isError){
                dispatch(getArchives(user_data))
            }
        }    

        return() => {
            dispatch(resetWorkspaceData())
        }

    }, [navigate, dispatch, singleWorkspace, user])

    return(
        <>
            <Header />
            <div className="mt_22" style={{ background: '#f4f3ef', minHeight: '100vh' }}>
                <div className={`flex items-center px-6 py-2.5 nav_wrap`}>
                    <div className='flex items-center cursor-pointer text-ink-muted hover:text-navy transition ease-out' onClick={backToHome}>
                        <FaChevronLeft className="text-xs" />
                        <p className='text-xs ml-2'>Dashboard</p>
                    </div>
                    <span className='px-3 text-xs text-ink-muted'>/</span>
                    <p className='text-xs font-medium text-ink'>Archives</p>                 
                </div>
                {workspaces.length > 0 &&
                    <div className='mt-14'>
                        <WorkspaceLists data={workspaces} currentUserId={user?.data?._id}/>
                    </div>
                }
            </div>
        </>
    )
}

export default ArchiveComponent;