import axios from "axios";
import { createContext, useContext, useCallback, useRef, useState } from "react";

const TerminalContext = createContext();

export const useTerminal = () => useContext(TerminalContext);

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
      const terminalCookie = `terminal_${crypto.randomUUID()}_${Date.now()}`;
      const res = await axios.post("/api/terminal/start", {
        terminal_cookie: terminalCookie,
      });

      const sessionData = res.data.data;

      const ws = new WebSocket(
        `wss://${window.location.host}${sessionData.websocket_url}`
      );

      ws.onopen = () => {
        console.log("Terminal WebSocket connected");
        ws.send("\n");
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
      };

      sessionRef.current = sessionWithWs;
      wsRef.current = ws;
      setSession(sessionWithWs);

      return sessionWithWs;
    } catch (error) {
      console.error("Failed to create terminal session:", error);
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
