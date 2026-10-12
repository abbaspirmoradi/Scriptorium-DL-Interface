import React, { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import RecordRTC from "recordrtc";
import {
    userRegister,
    userLogin,
    reset,
    resetAuthError,
    resetLoginError,
} from "../../features/Auth/AuthSlice";
import { saveVideoIntoFileSystem } from "../../features/RIL/rilSlice";
import { LuBookOpen } from "react-icons/lu";
import styles from "./Login.module.css";

function LoginComponent() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { user, isAuthError, isLoginError, isSuccess, message } = useSelector(
        (state) => state.auth
    );

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loginStatus, setLoginStatus] = useState("login");
    const [inputFieldIsEmpty, setInputFieldIsEmpty] = useState(false);

    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const intervalRef = useRef(null);
    const hasStartedRecording = useRef(false);

    useEffect(() => {
        localStorage.removeItem("query");
        localStorage.removeItem("wpname");
    }, []);

    const loginStatusHandler = (status) => {
        setInputFieldIsEmpty(false);
        setLoginStatus(status);
    };

    const formInputOnChange = (e, type) => {
        setInputFieldIsEmpty(false);
        if (type === "username") setUsername(e.target.value);
        else setPassword(e.target.value);
    };

    const authFormHandler = (e) => {
        e.preventDefault();
        setInputFieldIsEmpty(false);
        const formData = { username, password };

        if (username.trim() && password.trim()) {
            if (loginStatus === "login") dispatch(userLogin(formData));
            else dispatch(userRegister(formData));
        } else {
            setInputFieldIsEmpty(true);
        }
    };

    const generateRandomString = () => {
        const usernameLS = localStorage.getItem("loggedin-user") || "guest";
        const now = new Date().toISOString().replace(/[:.]/g, "-");
        const rand = Math.random().toString(36).substring(2, 10);
        return `${now}_${usernameLS}_${rand}`;
    };

   
    useEffect(() => {
        if ((isSuccess || user) && !hasStartedRecording.current) {
            localStorage.setItem("loggedin-user", username);
            hasStartedRecording.current = true;
        }
    }, [isSuccess, user]);

    useEffect(() => {
        if (isSuccess || user) {
            navigate("/");
            dispatch(reset());
        }
    }, [isSuccess, user]);

    useEffect(() => {
        if (isAuthError) setLoginStatus("register");
    }, [isAuthError]);

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return (
        <div className="flex justify-center items-center h-screen bg-parchment">
            <div className="w-[450px] flex flex-col">
                <div className="flex items-center justify-center gap-2.5 mb-6">
                    <div className="w-9 h-9 rounded-full bg-navy flex items-center justify-center flex-shrink-0">
                        <LuBookOpen size={18} color="#fff" />
                    </div>
                    <span className="font-serif text-[19px] font-medium text-ink">Scriptorium</span>
                </div>
                <form
                    onSubmit={authFormHandler}
                    className="bg-white shadow-md rounded-2xl px-8 py-11 mb-4 border border-archival-border"
                >
                    <h2 className="text-3xl font-serif font-medium text-ink">Welcome</h2>
                    <p className="text-ink-muted text-sm mt-1">Sign in to resume your research.</p>
                    <div className={styles.error_state_mh}>
                        {inputFieldIsEmpty && (
                            <p className="py-2 text-ink-muted font-medium text-sm">
                                Please enter valid username and password.
                            </p>
                        )}
                        {(isAuthError || isLoginError) && (
                            <p className={`py-2 text-red-700 text-sm ${styles.alert_animation}`}>
                                {message}
                            </p>
                        )}
                    </div>
                    <div className="mb-4">
                        <p className={`text-xs font-mono uppercase tracking-widest ${inputFieldIsEmpty ? `${styles.alert_animation} text-red-700` : "text-ink-muted"}`}>
                            Account
                        </p>
                        <input
                            className={`border border-archival-border rounded-md w-full py-3 px-3 text-ink bg-parchment-input focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 mt-2 transition-colors ${inputFieldIsEmpty ? styles.alert_animation : ""}`}
                            type="text"
                            placeholder="username"
                            value={username}
                            onChange={(e) => formInputOnChange(e, "username")}
                        />
                    </div>
                    <div className="mb-7">
                        <p className={`text-xs font-mono uppercase tracking-widest ${inputFieldIsEmpty ? `${styles.alert_animation} text-red-700` : "text-ink-muted"}`}>
                            Password
                        </p>
                        <input
                            className={`border border-archival-border rounded-md w-full py-3 px-3 text-ink bg-parchment-input focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 mt-2 transition-colors ${inputFieldIsEmpty ? styles.alert_animation : ""}`}
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => formInputOnChange(e, "password")}
                        />
                    </div>
                    <button className="bg-navy transition ease-out w-full hover:bg-[#14123a] text-white py-2.5 px-4 rounded-md mb-4 font-medium">
                        {loginStatus === "login" ? "Sign In" : "Register"}
                    </button>
                    <p className="text-ink-muted mt-5 text-sm">
                        {loginStatus === "login" ? "Don't have an account?" : "Already have an account?"} {" "}
                        <span
                            onClick={() => loginStatusHandler(loginStatus === "login" ? "register" : "login")}
                            className="font-medium text-accent cursor-pointer hover:underline transition ease-out"
                        >
              {loginStatus === "login" ? "Register" : "Sign In"}
            </span>
                    </p>
                </form>
            </div>
        </div>
    );
}

export default LoginComponent;
