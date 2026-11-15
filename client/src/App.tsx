
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import {
  Video,
  CalendarDays,
  CheckSquare,
  LogOut,
  Plus,
  Sparkles,
  Users,
  Clock,
  MessageSquare,
  Mic,
  MicOff,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  Monitor,
  Copy,
  ArrowLeft,
  PhoneOff
} from "lucide-react";

import { io, Socket } from "socket.io-client";
import { api } from "./api";
import VideoRoom from "./VideoRoom";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type Meeting = {
  _id: string;
  title: string;
  description: string;
  roomId: string;
  status: string;
  createdAt: string;
  summary?: string;
  transcript?: string;
};

type Task = {
  _id: string;
  title: string;
  status: "todo" | "in-progress" | "done";
  priority: string;
};

type ChatMessage = {
  sender: string;
  message: string;
  sentAt: string;
};

type Participant = {
  socketId: string;
  name: string;
};

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export default function App() {
  const [token, setToken] = useState(
    localStorage.getItem("intellmeet-token") || ""
  );

  const [user, setUser] = useState<User | null>(null);

  const [authMode, setAuthMode] =
    useState<"login" | "register">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [tab, setTab] = useState<
    "overview" | "meetings" | "tasks"
  >("overview");

  const [activeMeeting, setActiveMeeting] =
    useState<Meeting | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newTask, setNewTask] = useState("");

  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");

  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");

  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomPeers, setRoomPeers] = useState<Participant[]>([]);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Media state
  const [mediaStream, setMediaStream] =
    useState<MediaStream | null>(null);

  const [screenStream, setScreenStream] =
    useState<MediaStream | null>(null);

  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Load meetings and tasks
  async function load() {
    const [meetingResponse, taskResponse] = await Promise.all([
      api.get("/meetings"),
      api.get("/tasks")
    ]);

    setMeetings(meetingResponse.data.meetings || []);
    setTasks(taskResponse.data.tasks || []);
  }

  // Authenticate existing user
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    api.get("/auth/me")
      .then(async response => {
        setUser(response.data.user);
        await load();
      })
      .catch(() => {
        localStorage.removeItem("intellmeet-token");
        setToken("");
        setUser(null);
      });
  }, [token]);

  // Authenticated Socket.IO connection
  useEffect(() => {
    if (!activeMeeting || !token) return;

    setChat([]);
    setRoomPeers([]);
    setError("");

    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"]
    });

    s.on("connect", () => {
      console.log("IntellMeet socket connected:", s.id);

      s.emit(
        "room:join",
        activeMeeting.roomId,
        (result: {
          success: boolean;
          message?: string;
        }) => {
          if (!result?.success) {
            setError(
              result?.message || "Unable to join meeting room."
            );
          } else {
            console.log("Successfully joined meeting room.");
            setNotice("Connected to meeting room.");
          }
        }
      );
    });

    s.on("connect_error", err => {
      console.error("Socket connection failed:", err.message);
      setError("Meeting connection failed: " + err.message);
    });

    s.on("room:peers", (peers: Participant[]) => {
      setRoomPeers(Array.isArray(peers) ? peers : []);
    });

    s.on("participant:joined", (participant: Participant) => {
      if (participant?.socketId) {
        setRoomPeers(previous => {
          const exists = previous.some(
            peer => peer.socketId === participant.socketId
          );

          if (exists) return previous;

          return [...previous, participant];
        });
      }
    });

    s.on("participant:left", (participant: {
      socketId: string;
    }) => {
      if (!participant?.socketId) return;

      setRoomPeers(previous =>
        previous.filter(
          peer => peer.socketId !== participant.socketId
        )
      );
    });

    s.on("chat:message", (message: ChatMessage) => {
      setChat(previous => [...previous, message]);
    });

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
      setRoomPeers([]);
    };
  }, [activeMeeting?._id, token]);

  // Stop all media
  function stopAllMedia() {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });

      screenStreamRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });

      mediaStreamRef.current = null;
    }

    setScreenStream(null);
    setMediaStream(null);
    setMuted(false);
    setCameraOff(false);
    setIsSharing(false);
  }

  // Clean up media when component unmounts
  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach(track => {
        track.stop();
      });

      screenStreamRef.current?.getTracks().forEach(track => {
        track.stop();
      });
    };
  }, []);

  // Start camera and microphone
  async function startCamera() {
    if (mediaLoading) return;

    setError("");
    setMediaLoading(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Camera access is unavailable. Use localhost or HTTPS."
        );
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

      mediaStreamRef.current = stream;
      setMediaStream(stream);

      setMuted(false);
      setCameraOff(false);

      setNotice("Camera and microphone connected.");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to access camera or microphone.";

      setError(message);
    } finally {
      setMediaLoading(false);
    }
  }

  // Toggle microphone
  async function toggleMicrophone() {
    const stream = mediaStreamRef.current;

    if (!stream) {
      await startCamera();
      return;
    }

    const audioTracks = stream.getAudioTracks();

    if (audioTracks.length === 0) {
      setError("No microphone track is available.");
      return;
    }

    const nextMuted = !muted;

    audioTracks.forEach(track => {
      track.enabled = !nextMuted;
    });

    setMuted(nextMuted);
  }

  // Toggle camera
  async function toggleCamera() {
    const stream = mediaStreamRef.current;

    if (!stream) {
      await startCamera();
      return;
    }

    const videoTracks = stream.getVideoTracks();

    if (videoTracks.length === 0) {
      setError("No camera track is available.");
      return;
    }

    const nextCameraOff = !cameraOff;

    videoTracks.forEach(track => {
      track.enabled = !nextCameraOff;
    });

    setCameraOff(nextCameraOff);
  }

  // Share screen
  async function shareScreen() {
    if (screenStreamRef.current) {
      stopScreenSharing();
      return;
    }

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error(
          "Screen sharing is not supported by this browser."
        );
      }

      const stream =
        await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });

      screenStreamRef.current = stream;

      const track = stream.getVideoTracks()[0];

      if (track) {
        track.onended = () => {
          stopScreenSharing();
        };
      }

      setScreenStream(stream);
      setIsSharing(true);
      setNotice("Screen sharing started.");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to share screen.";

      setError(message);
    }
  }

  // Stop screen sharing
  function stopScreenSharing() {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });

      screenStreamRef.current = null;
    }

    setScreenStream(null);
    setIsSharing(false);
    setNotice("Screen sharing stopped.");
  }

  // Authentication
  async function authenticate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");

    try {
      const endpoint =
        authMode === "login"
          ? "/auth/login"
          : "/auth/register";

      const payload =
        authMode === "login"
          ? { email, password }
          : { name, email, password };

      const result = await api.post(endpoint, payload);

      localStorage.setItem(
        "intellmeet-token",
        result.data.token
      );

      setToken(result.data.token);
      setUser(result.data.user);
      setPassword("");
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        "Unable to authenticate."
      );
    }
  }

  // Logout
  function logout() {
    stopAllMedia();

    socket?.disconnect();

    localStorage.removeItem("intellmeet-token");

    setToken("");
    setUser(null);
    setActiveMeeting(null);
    setSocket(null);
    setRoomPeers([]);
    setChat([]);
  }

  // Create meeting
  async function createMeeting(e: FormEvent) {
    e.preventDefault();

    if (!newTitle.trim()) return;

    try {
      await api.post("/meetings", {
        title: newTitle.trim()
      });

      setNewTitle("");
      await load();

      setNotice("Meeting created successfully.");
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        "Could not create meeting."
      );
    }
  }

  // Create task
  async function createTask(e: FormEvent) {
    e.preventDefault();

    if (!newTask.trim()) return;

    try {
      await api.post("/tasks", {
        title: newTask.trim()
      });

      setNewTask("");
      await load();

      setNotice("Task created successfully.");
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        "Could not create task."
      );
    }
  }

  // Update task status
  async function updateTask(
    task: Task,
    status: Task["status"]
  ) {
    try {
      await api.patch(`/tasks/${task._id}`, {
        status
      });

      await load();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        "Could not update task."
      );
    }
  }

  // Join meeting
  async function joinMeeting(meeting: Meeting) {
    setError("");
    setNotice("");

    try {
      await api.post(
        `/meetings/${meeting._id}/join`
      );

      setTranscript(meeting.transcript || "");
      setSummary(meeting.summary || "");

      setActiveMeeting(meeting);
      setTab("meetings");
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        "Could not join meeting."
      );
    }
  }

  // Leave meeting
  function leaveMeeting() {
    stopAllMedia();

    socket?.disconnect();
    setSocket(null);

    setActiveMeeting(null);
    setRoomPeers([]);
    setChat([]);
    setChatText("");
    setSummary("");
  }

  // Save meeting notes
  async function saveNotes() {
    if (!activeMeeting) return;

    try {
      await api.patch(
        `/meetings/${activeMeeting._id}/notes`,
        { transcript }
      );

      setNotice("Meeting notes saved.");
      await load();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        "Could not save meeting notes."
      );
    }
  }

  // Generate AI meeting summary
  async function summarize() {
    if (!activeMeeting) return;

    setError("");
    setNotice("");

    try {
      const response = await api.post(
        "/ai/summarize",
        {
          meetingId: activeMeeting._id,
          transcript
        }
      );

      setSummary(response.data.summary);

      setNotice(
        response.data.notice ||
        "Meeting summary generated."
      );

      await load();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        "Summary could not be generated."
      );
    }
  }

  // Send chat message
  function sendChat(e: FormEvent) {
    e.preventDefault();

    if (!chatText.trim() || !socket || !activeMeeting) {
      return;
    }

    if (!socket.connected) {
      setError("Chat connection is not available.");
      return;
    }

    socket.emit("chat:message", {
      roomId: activeMeeting.roomId,
      message: chatText.trim()
    });

    setChatText("");
  }

  // Copy meeting room ID
  async function copyRoomId() {
    if (!activeMeeting) return;

    try {
      await navigator.clipboard.writeText(
        activeMeeting.roomId
      );

      setNotice("Room ID copied.");
    } catch {
      setError("Unable to copy room ID.");
    }
  }

  // Authentication screen
  if (!token || !user) {
    return (
      <main className="auth-shell">
        <section className="auth-card">

          <div className="brand">
            <span className="brand-icon">
              <Video size={22} />
            </span>
            <span>IntellMeet</span>
          </div>

          <p className="eyebrow">
            WORK BETTER, TOGETHER
          </p>

          <h1>
            {authMode === "login"
              ? "Welcome back"
              : "Create your workspace account"}
          </h1>

          <p className="muted">
            Meetings that turn into meaningful progress.
          </p>

          <form onSubmit={authenticate} className="stack">

            {authMode === "register" && (
              <label>
                Your name
                <input
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Alex Morgan"
                />
              </label>
            )}

            <label>
              Email address
              <input
                required
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </label>

            <label>
              Password
              <input
                required
                type="password"
                minLength={10}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 10 characters"
              />
            </label>

            {error && (
              <p className="error">{error}</p>
            )}

            <button className="primary wide">
              {authMode === "login"
                ? "Sign in"
                : "Create account"}
            </button>

          </form>

          <p className="switch">
            {authMode === "login"
              ? "New to IntellMeet?"
              : "Already have an account?"}

            {" "}

            <button
              className="text-button"
              type="button"
              onClick={() =>
                setAuthMode(
                  authMode === "login"
                    ? "register"
                    : "login"
                )
              }
            >
              {authMode === "login"
                ? "Create an account"
                : "Sign in"}
            </button>
          </p>

        </section>
      </main>
    );
  }

  const completed = tasks.filter(
    task => task.status === "done"
  ).length;

  return (
    <div className="app-shell">

      <aside className="sidebar">

        <div className="brand">
          <span className="brand-icon">
            <Video size={22} />
          </span>
          <span>IntellMeet</span>
        </div>

        <div className="workspace">
          <div className="workspace-avatar">W</div>
          <div>
            <strong>Workspace</strong>
            <small>Personal team</small>
          </div>
          <span className="chevron">⌄</span>
        </div>

        <p className="nav-label">WORKSPACE</p>

        <nav>
          <button
            className={
              tab === "overview"
                ? "nav-item selected"
                : "nav-item"
            }
            onClick={() => {
              if (activeMeeting) leaveMeeting();
              setTab("overview");
            }}
          >
            <CalendarDays size={18} />
            Overview
          </button>

          <button
            className={
              tab === "meetings"
                ? "nav-item selected"
                : "nav-item"
            }
            onClick={() => {
              if (activeMeeting) leaveMeeting();
              setTab("meetings");
            }}
          >
            <Video size={18} />
            Meetings
            <span className="count">
              {meetings.length}
            </span>
          </button>

          <button
            className={
              tab === "tasks"
                ? "nav-item selected"
                : "nav-item"
            }
            onClick={() => {
              if (activeMeeting) leaveMeeting();
              setTab("tasks");
            }}
          >
            <CheckSquare size={18} />
            My tasks
            <span className="count">
              {tasks.length}
            </span>
          </button>
        </nav>

        <div className="sidebar-bottom">

          <div className="profile">
            <div className="avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </div>

            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
          </div>

          <button
            className="logout"
            onClick={logout}
            title="Sign out"
          >
            <LogOut size={17} />
          </button>

        </div>
      </aside>

      <main className="main">

        <header className="topbar">
          <div>
            <span className="muted">
              Workspace /
            </span>

            <strong>
              {activeMeeting
                ? activeMeeting.title
                : tab[0].toUpperCase() + tab.slice(1)}
            </strong>
          </div>

          <div className="top-right">
            <span className="status-dot" />
            All systems operational

            <div className="avatar small">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="content">

          {error && (
            <div className="alert">
              {error}
              <button onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}

          {notice && (
            <div className="notice">
              {notice}
              <button onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          )}

          {/* MEETING ROOM */}

          {activeMeeting ? (

            <section>

              <div className="page-heading">

                <div>
                  <p className="eyebrow">
                    LIVE MEETING ROOM
                  </p>

                  <h1>{activeMeeting.title}</h1>

                  <p className="muted">
                    Room {activeMeeting.roomId.slice(0, 8)}
                    {" · "}
                    Chat and notes sync in real time
                  </p>
                </div>

                <button
                  className="secondary"
                  onClick={leaveMeeting}
                >
                  <ArrowLeft size={16} />
                  Back to meetings
                </button>

              </div>

              <div
                className="meeting-layout"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0, 1.6fr) minmax(300px, 1fr)",
                  gap: "20px",
                  alignItems: "start"
                }}
              >

                {/* VIDEO AREA */}

                <div
                  className="video-panel"
                  style={{
                    background: "#111c30",
                    borderRadius: "18px",
                    padding: "20px",
                    color: "white",
                    minHeight: "480px",
                    display: "flex",
                    flexDirection: "column"
                  }}
                >

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "15px"
                    }}
                  >
                    <strong>
                      <Monitor size={16} />
                      {" "}Meeting video
                    </strong>

                    <span className="pill">
                      {mediaStream
                        ? "Media connected"
                        : "Not connected"}
                    </span>
                  </div>

                  <VideoRoom
                    socket={socket}
                    roomId={activeMeeting.roomId}
                    userName={user.name}
                    mediaStream={mediaStream}
                    screenStream={screenStream}
                    initialPeers={roomPeers}
                    onStartMedia={startCamera}
                    mediaLoading={mediaLoading}
                  />

                  <div
                    className="controls"
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      gap: "10px",
                      flexWrap: "wrap",
                      marginTop: "20px"
                    }}
                  >

                    <button
                      className="control"
                      onClick={toggleMicrophone}
                      disabled={mediaLoading}
                    >
                      {muted ? <MicOff /> : <Mic />}
                      {muted ? "Unmute" : "Mute"}
                    </button>

                    <button
                      className="control"
                      onClick={toggleCamera}
                      disabled={mediaLoading}
                    >
                      {cameraOff ? <VideoOff /> : <Video />}
                      {cameraOff
                        ? "Start video"
                        : "Stop video"}
                    </button>

                    <button
                      className="control"
                      onClick={shareScreen}
                    >
                      {isSharing
                        ? <ScreenShareOff />
                        : <ScreenShare />}

                      {isSharing
                        ? "Stop sharing"
                        : "Share screen"}
                    </button>

                    <button
                      className="control danger"
                      onClick={leaveMeeting}
                    >
                      <PhoneOff />
                      Leave
                    </button>

                  </div>

                  <p
                    className="small-note"
                    style={{
                      textAlign: "center",
                      color: "#9aabc5",
                      marginTop: "15px"
                    }}
                  >
                    Camera, microphone, screen sharing and
                    multi-participant video are available.
                  </p>

                </div>

                {/* RIGHT SIDE */}

                <div className="side-panels">

                  {/* CHAT */}

                  <div className="panel">

                    <div className="panel-heading">
                      <h3>
                        <MessageSquare size={17} />
                        {" "}Meeting chat
                      </h3>

                      <button
                        className="text-button"
                        onClick={copyRoomId}
                        type="button"
                      >
                        <Copy size={14} />
                        Room ID
                      </button>
                    </div>

                    <div className="chat-list">

                      {chat.map((message, index) => (
                        <div
                          className="chat-message"
                          key={`${message.sentAt}-${index}`}
                        >
                          <b>{message.sender}</b>
                          <p>{message.message}</p>
                        </div>
                      ))}

                      {chat.length === 0 && (
                        <p className="muted">
                          Messages from this room will appear here.
                        </p>
                      )}

                    </div>

                    <form
                      className="chat-form"
                      onSubmit={sendChat}
                    >
                      <input
                        value={chatText}
                        onChange={e => setChatText(e.target.value)}
                        placeholder="Write a message..."
                        required
                      />

                      <button
                        className="primary"
                        disabled={!socket?.connected}
                      >
                        Send
                      </button>
                    </form>

                  </div>

                  {/* AI NOTES */}

                  <div className="panel">

                    <h3>
                      <Sparkles size={17} />
                      {" "}AI meeting notes
                    </h3>

                    <textarea
                      rows={5}
                      value={transcript}
                      onChange={e => setTranscript(e.target.value)}
                      placeholder="Paste or type meeting transcript here..."
                    />

                    <div className="row">

                      <button
                        className="secondary"
                        onClick={saveNotes}
                        type="button"
                      >
                        Save notes
                      </button>

                      <button
                        className="primary"
                        onClick={summarize}
                        type="button"
                      >
                        Summarize
                      </button>

                    </div>

                    {summary && (
                      <div className="summary">
                        <b>Summary</b>
                        <p>{summary}</p>
                      </div>
                    )}

                  </div>

                </div>

              </div>

            </section>

          ) : tab === "overview" ? (

            /* OVERVIEW */

            <>

              <div className="page-heading">

                <div>
                  <p className="eyebrow">
                    YOUR WORKSPACE
                  </p>

                  <h1>
                    Good to see you, {user.name.split(" ")[0]}.
                  </h1>

                  <p className="muted">
                    Here's what's happening across your meetings and tasks.
                  </p>
                </div>

                <button
                  className="primary"
                  onClick={() => setTab("meetings")}
                >
                  <Plus size={17} />
                  New meeting
                </button>

              </div>

              <div className="stats-grid">

                <Stat
                  icon={<Video />}
                  label="Total meetings"
                  value={meetings.length}
                  detail="In your workspace"
                />

                <Stat
                  icon={<CheckSquare />}
                  label="Tasks completed"
                  value={completed}
                  detail={`${tasks.length} total tasks`}
                />

                <Stat
                  icon={<Clock />}
                  label="Open tasks"
                  value={tasks.length - completed}
                  detail="Across your projects"
                />

                <Stat
                  icon={<Users />}
                  label="Team members"
                  value="1"
                  detail="Starter workspace"
                />

              </div>

              <div className="section-grid">

                <div className="panel">

                  <div className="panel-heading">
                    <div>
                      <h2>Recent meetings</h2>
                      <p className="muted">
                        Pick up where your team left off.
                      </p>
                    </div>

                    <button
                      className="text-button"
                      onClick={() => setTab("meetings")}
                    >
                      View all
                    </button>
                  </div>

                  {meetings.slice(0, 5).map(meeting => (
                    <div
                      className="list-row"
                      key={meeting._id}
                    >
                      <div className="list-icon">
                        <Video size={18} />
                      </div>

                      <div className="grow">
                        <strong>{meeting.title}</strong>
                        <small>
                          {new Date(meeting.createdAt).toLocaleString()}
                        </small>
                      </div>

                      <span className={`pill ${meeting.status}`}>
                        {meeting.status}
                      </span>

                      <button
                        className="icon-button"
                        onClick={() => joinMeeting(meeting)}
                      >
                        Join →
                      </button>
                    </div>
                  ))}

                  {meetings.length === 0 && (
                    <Empty text="No meetings yet. Create your first meeting to get started." />
                  )}

                </div>

                <div className="panel">

                  <div className="panel-heading">
                    <div>
                      <h2>My tasks</h2>
                      <p className="muted">
                        Stay on top of your next steps.
                      </p>
                    </div>

                    <button
                      className="text-button"
                      onClick={() => setTab("tasks")}
                    >
                      View all
                    </button>
                  </div>

                  {tasks.slice(0, 5).map(task => (
                    <div
                      className="list-row"
                      key={task._id}
                    >
                      <div className={`task-dot ${task.status}`} />

                      <div className="grow">
                        <strong>{task.title}</strong>
                        <small>{task.priority} priority</small>
                      </div>

                      <span className="pill">
                        {task.status}
                      </span>
                    </div>
                  ))}

                  {tasks.length === 0 && (
                    <Empty text="No tasks yet. Add one to keep work moving." />
                  )}

                </div>

              </div>

            </>

          ) : tab === "meetings" ? (

            /* MEETINGS */

            <>

              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    CONNECT & COLLABORATE
                  </p>

                  <h1>Meetings</h1>

                  <p className="muted">
                    Create a room, invite teammates and keep the conversation moving.
                  </p>
                </div>
              </div>

              <form
                className="create-bar"
                onSubmit={createMeeting}
              >
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Give your meeting a name..."
                  required
                />

                <button className="primary">
                  <Plus size={17} />
                  Create meeting
                </button>
              </form>

              <div className="meeting-cards">

                {meetings.map(meeting => (
                  <article
                    className="meeting-card"
                    key={meeting._id}
                  >
                    <div className="card-top">
                      <div className="list-icon">
                        <Video />
                      </div>

                      <span className={`pill ${meeting.status}`}>
                        {meeting.status}
                      </span>
                    </div>

                    <h3>{meeting.title}</h3>

                    <p className="muted">
                      {meeting.description || "No description provided."}
                    </p>

                    <div className="card-footer">

                      <span>
                        <Clock size={15} />
                        {" "}
                        {new Date(meeting.createdAt).toLocaleDateString()}
                      </span>

                      <button
                        className="primary"
                        type="button"
                        onClick={() => joinMeeting(meeting)}
                      >
                        Join room →
                      </button>

                    </div>

                  </article>
                ))}

                {meetings.length === 0 && (
                  <Empty text="Your meeting rooms will appear here." />
                )}

              </div>

            </>

          ) : (

            /* TASKS */

            <>

              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    PERSONAL PRODUCTIVITY
                  </p>

                  <h1>My tasks</h1>

                  <p className="muted">
                    Turn meeting decisions into clear next steps.
                  </p>
                </div>
              </div>

              <form
                className="create-bar"
                onSubmit={createTask}
              >
                <input
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  placeholder="What needs to get done?"
                  required
                />

                <button className="primary">
                  <Plus size={17} />
                  Add task
                </button>
              </form>

              <div className="panel task-board">

                <div className="task-column">
                  <h3>
                    To do
                    <span>
                      {tasks.filter(t => t.status === "todo").length}
                    </span>
                  </h3>

                  {tasks
                    .filter(t => t.status === "todo")
                    .map(task => (
                      <TaskCard
                        key={task._id}
                        task={task}
                        onChange={updateTask}
                      />
                    ))}
                </div>

                <div className="task-column">
                  <h3>
                    In progress
                    <span>
                      {tasks.filter(t => t.status === "in-progress").length}
                    </span>
                  </h3>

                  {tasks
                    .filter(t => t.status === "in-progress")
                    .map(task => (
                      <TaskCard
                        key={task._id}
                        task={task}
                        onChange={updateTask}
                      />
                    ))}
                </div>

                <div className="task-column">
                  <h3>
                    Done
                    <span>
                      {tasks.filter(t => t.status === "done").length}
                    </span>
                  </h3>

                  {tasks
                    .filter(t => t.status === "done")
                    .map(task => (
                      <TaskCard
                        key={task._id}
                        task={task}
                        onChange={updateTask}
                      />
                    ))}
                </div>

              </div>

            </>

          )}

        </div>
      </main>
    </div>
  );
}

// Dashboard statistic card
function Stat({
  icon,
  label,
  value,
  detail
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>

      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

// Empty state
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <CalendarDays />
      </div>
      <p>{text}</p>
    </div>
  );
}

// Task card
function TaskCard({
  task,
  onChange
}: {
  task: Task;
  onChange: (task: Task, status: Task["status"]) => void;
}) {
  const next: Task["status"] =
    task.status === "todo"
      ? "in-progress"
      : task.status === "in-progress"
        ? "done"
        : "todo";

  return (
    <div className="task-card">

      <strong>{task.title}</strong>

      <div className="task-card-bottom">

        <span className={`priority ${task.priority}`}>
          {task.priority}
        </span>

        <button
          className="text-button"
          onClick={() => onChange(task, next)}
          type="button"
        >
          {task.status === "done"
            ? "Reopen"
            : task.status === "todo"
              ? "Start"
              : "Complete"}
          {" →"}
        </button>

      </div>
    </div>
  );
}
