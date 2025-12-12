import { AttachAddon } from "@xterm/addon-attach";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useXTerm } from "react-xtermjs";

import { useTerminal } from "../../contexts/TerminalContext";
import { useAuth } from "../auth/AuthContext";

const TerminalPage = () => {
  const { user, logout } = useAuth();
  const { session, createSession, restartSession } = useTerminal();
  const navigate = useNavigate();
  const { instance, ref } = useXTerm();
  const addonsRef = useRef(null);
  const attachAddonRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize addons only once
  if (!addonsRef.current) {
    addonsRef.current = {
      fitAddon: new FitAddon(),
      webLinksAddon: new WebLinksAddon(),
    };
  }

  // Create session on mount
  useEffect(() => {
    if (!session) {
      createSession();
    }
  }, [session, createSession]);

  // Open terminal in DOM
  useEffect(() => {
    if (instance && ref?.current) {
      try {
        instance.open(ref.current);
      } catch (error) {
        console.error("Failed to attach terminal to DOM:", error);
      }
    }
  }, [instance, ref]);

  // Load basic addons and set up resize handler
  useEffect(() => {
    if (instance) {
      try {
        instance.loadAddon(addonsRef.current.fitAddon);
        instance.loadAddon(addonsRef.current.webLinksAddon);
        addonsRef.current.fitAddon.fit();

        // Set up resize handler - will fire when fit() is called
        instance.onResize(({ cols, rows }) => {
          // Send to backend if websocket is ready
          if (session?.websocket?.readyState === WebSocket.OPEN) {
            session.websocket.send(
              JSON.stringify({ type: "resize", cols, rows })
            );
            console.log("Sent resize to backend:", { cols, rows });
          }
        });
      } catch (error) {
        console.error("Terminal addon loading failed:", error);
      }
    }
  }, [instance, session?.websocket]);

  // Attach WebSocket when it's OPEN (critical!)
  useEffect(() => {
    if (!instance || !session?.websocket) {
      setIsReady(false);
      return;
    }

    const { websocket } = session;

    const attachWhenReady = () => {
      if (websocket.readyState === WebSocket.OPEN) {
        try {
          const attachAddon = new AttachAddon(websocket);
          attachAddonRef.current = attachAddon;
          instance.loadAddon(attachAddon);
          setIsReady(true);
          console.log("Terminal attached to WebSocket");

          // Fit terminal and send initial resize AFTER attach
          setTimeout(() => {
            if (addonsRef.current?.fitAddon) {
              addonsRef.current.fitAddon.fit();

              // Explicitly send resize after fit() completes
              const { cols, rows } = instance;
              websocket.send(JSON.stringify({ type: "resize", cols, rows }));
              console.log("Sent initial resize to backend:", { cols, rows });
            }
          }, 100);
        } catch (error) {
          console.error("Failed to attach WebSocket:", error);
        }
      }
    };

    // Attach immediately if already open
    attachWhenReady();

    // Listen for websocket events
    const onOpen = () => {
      attachWhenReady();
    };

    const onClose = () => {
      setIsReady(false);
    };

    websocket.addEventListener("open", onOpen);
    websocket.addEventListener("close", onClose);

    return function cleanup() {
      if (attachAddonRef.current) {
        attachAddonRef.current.dispose();
        attachAddonRef.current = null;
      }
      setIsReady(false);
      websocket.removeEventListener("open", onOpen);
      websocket.removeEventListener("close", onClose);
    };
  }, [instance, session]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (addonsRef.current?.fitAddon && instance) {
        setTimeout(() => addonsRef.current.fitAddon.fit(), 50);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [instance]);

  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#000000",
      }}
    >
      {/* Top bar with logout/reconnect */}
      <div
        style={{
          backgroundColor: "#1a1a1a",
          padding: "0.5rem 1rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #333",
        }}
      >
        <span style={{ color: "#fff", fontSize: "0.9rem" }}>
          Web Terminal - {user.email || user.username}
          {!isReady ? " (connecting...)" : ""}
        </span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={restartSession}
            style={{
              padding: "0.25rem 0.75rem",
              backgroundColor: "#444",
              color: "#fff",
              border: "1px solid #666",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Reconnect
          </button>
          <button
            onClick={logout}
            style={{
              padding: "0.25rem 0.75rem",
              backgroundColor: "#d9534f",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div style={{ flex: 1, padding: 0, width: "100%", height: "100%" }}>
        {!instance ? (
          <div
            style={{
              color: "#fff",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            Loading terminal...
          </div>
        ) : (
          <div ref={ref} style={{ height: "100%", width: "100%" }} />
        )}
      </div>
    </div>
  );
};

export default TerminalPage;
