import axios from "axios";
import {
  createContext,
  useContext,
  useCallback,
  useRef,
  useState,
  useEffect,
} from "react";

const TerminalContext = createContext();

export const useTerminal = () => useContext(TerminalContext);

const STORAGE_KEY = "web_terminal_cookie";

export const TerminalProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const sessionRef = useRef(null);
  const wsRef = useRef(null);
  const creatingRef = useRef(false);

  const createSession = useCallback(async () => {
    if (sessionRef.current || creatingRef.current) {
      return sessionRef.current;
    }

    creatingRef.current = true;

    try {
      // Try to reuse existing cookie from localStorage
      let terminalCookie = localStorage.getItem(STORAGE_KEY);

      // If no stored cookie, generate new one
      if (!terminalCookie) {
        terminalCookie = `terminal_${crypto.randomUUID()}_${Date.now()}`;
        localStorage.setItem(STORAGE_KEY, terminalCookie);
      }

      const res = await axios.post("/api/terminal/start", {
        terminal_cookie: terminalCookie,
      });

      const sessionData = res.data.data;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(
        `${protocol}//${window.location.host}${sessionData.websocket_url}`
      );

      ws.onopen = () => {
        console.log("Terminal WebSocket connected");
      };

      ws.onclose = () => {
        console.log("Terminal WebSocket closed");
        wsRef.current = null;
      };

      ws.onerror = (error) => {
        console.error("Terminal WebSocket error:", error);
      };

      const sessionWithWs = {
        ...sessionData,
        websocket: ws,
        terminalCookie,
      };

      sessionRef.current = sessionWithWs;
      wsRef.current = ws;
      setSession(sessionWithWs);

      return sessionWithWs;
    } catch (error) {
      console.error("Failed to create terminal session:", error);
      // Clear invalid cookie on error
      localStorage.removeItem(STORAGE_KEY);
      return null;
    } finally {
      creatingRef.current = false;
    }
  }, []);

  const closeSession = useCallback(async () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (sessionRef.current) {
      try {
        await axios.delete(
          `/api/terminal/sessions/${sessionRef.current.id}/stop`
        );
      } catch (error) {
        console.error("Failed to stop session:", error);
      }
      sessionRef.current = null;
      setSession(null);
    }
  }, []);

  const restartSession = useCallback(async () => {
    await closeSession();
    return await createSession();
  }, [closeSession, createSession]);

  const value = {
    session,
    createSession,
    closeSession,
    restartSession,
  };

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
};
