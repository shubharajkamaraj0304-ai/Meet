
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Socket } from "socket.io-client";

type Participant = {
  socketId: string;
  name: string;
};

type VideoRoomProps = {
  socket: Socket | null;
  roomId: string;
  userName: string;
  mediaStream: MediaStream | null;
  screenStream: MediaStream | null;
  initialPeers: Participant[];
  onStartMedia: () => void;
  mediaLoading: boolean;
};

type PeerRecord = {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingRemoteAnswerPending: boolean;
  name: string;
  stream: MediaStream;
  pendingCandidates: RTCIceCandidateInit[];
};

type RemoteParticipant = {
  socketId: string;
  name: string;
  stream: MediaStream;
  connectionState: RTCPeerConnectionState;
};

const tileStyle: CSSProperties = {
  position: "relative",
  minHeight: "190px",
  aspectRatio: "16 / 9",
  overflow: "hidden",
  borderRadius: "12px",
  background: "#0b1220",
  border: "1px solid #334155"
};

const videoStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  background: "#0b1220"
};

const labelStyle: CSSProperties = {
  position: "absolute",
  left: "10px",
  bottom: "9px",
  padding: "5px 9px",
  borderRadius: "7px",
  color: "white",
  background: "rgba(0,0,0,.62)",
  fontSize: "12px"
};

export default function VideoRoom({
  socket,
  roomId,
  userName,
  mediaStream,
  screenStream,
  initialPeers,
  onStartMedia,
  mediaLoading
}: VideoRoomProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Map<string, PeerRecord>>(new Map());
  const mediaRef = useRef<MediaStream | null>(mediaStream);
  const screenRef = useRef<MediaStream | null>(screenStream);

  const [remoteParticipants, setRemoteParticipants] =
    useState<RemoteParticipant[]>([]);

  mediaRef.current = mediaStream;
  screenRef.current = screenStream;

  function publishParticipants() {
    const next: RemoteParticipant[] = [];

    peersRef.current.forEach((peer, socketId) => {
      next.push({
        socketId,
        name: peer.name || "Participant",
        stream: peer.stream,
        connectionState: peer.pc.connectionState
      });
    });

    setRemoteParticipants(next);
  }

  useEffect(() => {
    const preview = localVideoRef.current;

    if (preview) {
      preview.srcObject = screenStream || mediaStream;
    }
  }, [mediaStream, screenStream]);

  useEffect(() => {
    const audioTrack = mediaStream?.getAudioTracks()[0] || null;
    const videoTrack =
      (screenStream || mediaStream)?.getVideoTracks()[0] || null;

    peersRef.current.forEach(peer => {
      const audioTransceiver = peer.pc
        .getTransceivers()
        .find(t => t.receiver.track.kind === "audio");

      const videoTransceiver = peer.pc
        .getTransceivers()
        .find(t => t.receiver.track.kind === "video");

      if (audioTransceiver) {
        void audioTransceiver.sender.replaceTrack(audioTrack);
        audioTransceiver.direction = audioTrack ? "sendrecv" : "recvonly";
      }

      if (videoTransceiver) {
        void videoTransceiver.sender.replaceTrack(videoTrack);
        videoTransceiver.direction = videoTrack ? "sendrecv" : "recvonly";
      }
    });
  }, [mediaStream, screenStream]);

  useEffect(() => {
    if (!socket) return;

    let disposed = false;

    const sendSignal = (
      to: string,
      signal: Record<string, unknown>
    ) => {
      if (!disposed && socket.connected) {
        socket.emit("webrtc:signal", {
          roomId,
          to,
          signal
        });
      }
    };

    const createPeer = (
      peerId: string,
      peerName = "Participant"
    ) => {
      const existing = peersRef.current.get(peerId);

      if (existing) {
        if (peerName && peerName !== "Participant") {
          existing.name = peerName;
        }

        publishParticipants();
        return existing;
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" }
        ]
      });

      const record: PeerRecord = {
        pc,
        polite: Boolean(
          socket.id && socket.id.localeCompare(peerId) > 0
        ),
        makingOffer: false,
        ignoreOffer: false,
        settingRemoteAnswerPending: false,
        name: peerName,
        stream: new MediaStream(),
        pendingCandidates: []
      };

      peersRef.current.set(peerId, record);

      pc.addTransceiver("audio", { direction: "recvonly" });
      pc.addTransceiver("video", { direction: "recvonly" });

      const audioTrack =
        mediaRef.current?.getAudioTracks()[0] || null;

      const videoTrack =
        (screenRef.current || mediaRef.current)
          ?.getVideoTracks()[0] || null;

      const audioTransceiver = pc
        .getTransceivers()
        .find(t => t.receiver.track.kind === "audio");

      const videoTransceiver = pc
        .getTransceivers()
        .find(t => t.receiver.track.kind === "video");

      if (audioTransceiver && audioTrack) {
        void audioTransceiver.sender.replaceTrack(audioTrack);
        audioTransceiver.direction = "sendrecv";
      }

      if (videoTransceiver && videoTrack) {
        void videoTransceiver.sender.replaceTrack(videoTrack);
        videoTransceiver.direction = "sendrecv";
      }

      pc.onicecandidate = event => {
        if (event.candidate) {
          sendSignal(peerId, {
            candidate: event.candidate.toJSON()
          });
        }
      };

      pc.ontrack = event => {
        const incoming = event.streams[0];

        if (incoming) {
          record.stream = incoming;
        } else if (
          !record.stream
            .getTracks()
            .some(track => track.id === event.track.id)
        ) {
          record.stream.addTrack(event.track);
        }

        publishParticipants();
      };

      pc.onnegotiationneeded = async () => {
        try {
          record.makingOffer = true;

          await pc.setLocalDescription();

          if (pc.localDescription) {
            sendSignal(peerId, {
              description: pc.localDescription.toJSON()
            });
          }
        } catch (error) {
          console.error("WebRTC negotiation failed:", error);
        } finally {
          record.makingOffer = false;
        }
      };

      pc.onconnectionstatechange = () => {
        publishParticipants();

        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          pc.close();
          peersRef.current.delete(peerId);
          publishParticipants();
        }
      };

      publishParticipants();
      return record;
    };

    const handleSignal = async (payload: {
      from: string;
      signal: {
        description?: RTCSessionDescriptionInit;
        candidate?: RTCIceCandidateInit;
      };
    }) => {
      if (!payload?.from || !payload.signal) return;

      const record = createPeer(payload.from);
      const { pc } = record;

      try {
        if (payload.signal.candidate) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(payload.signal.candidate);
          } else {
            record.pendingCandidates.push(payload.signal.candidate);
          }

          return;
        }

        const description = payload.signal.description;
        if (!description) return;

        const readyForOffer =
          !record.makingOffer &&
          (
            pc.signalingState === "stable" ||
            record.settingRemoteAnswerPending
          );

        const offerCollision =
          description.type === "offer" && !readyForOffer;

        record.ignoreOffer =
          !record.polite && offerCollision;

        if (record.ignoreOffer) return;

        record.settingRemoteAnswerPending =
          description.type === "answer";

        if (offerCollision && record.polite) {
          await pc.setLocalDescription({
            type: "rollback"
          });
        }

        await pc.setRemoteDescription(description);

        record.settingRemoteAnswerPending = false;

        for (
          const candidate of record.pendingCandidates.splice(0)
        ) {
          await pc.addIceCandidate(candidate);
        }

        if (description.type === "offer") {
          await pc.setLocalDescription();

          if (pc.localDescription) {
            sendSignal(payload.from, {
              description: pc.localDescription.toJSON()
            });
          }
        }
      } catch (error) {
        if (!record.ignoreOffer) {
          console.error(
            "Unable to process WebRTC signal:",
            error
          );
        }
      }
    };

    const handleJoined = (participant: Participant) => {
      if (
        participant?.socketId &&
        participant.socketId !== socket.id
      ) {
        createPeer(
          participant.socketId,
          participant.name || "Participant"
        );
      }
    };

    const handleLeft = ({
      socketId
    }: {
      socketId: string;
    }) => {
      const peer = peersRef.current.get(socketId);

      if (peer) {
        peer.pc.close();
      }

      peersRef.current.delete(socketId);
      publishParticipants();
    };

    socket.on("webrtc:signal", handleSignal);
    socket.on("participant:joined", handleJoined);
    socket.on("participant:left", handleLeft);

    initialPeers.forEach(peer => {
      if (
        peer.socketId &&
        peer.socketId !== socket.id
      ) {
        createPeer(
          peer.socketId,
          peer.name || "Participant"
        );
      }
    });

    return () => {
      disposed = true;

      socket.off("webrtc:signal", handleSignal);
      socket.off("participant:joined", handleJoined);
      socket.off("participant:left", handleLeft);

      peersRef.current.forEach(peer => {
        peer.pc.close();
      });

      peersRef.current.clear();
      setRemoteParticipants([]);
    };
  }, [socket, roomId, initialPeers]);

  return (
    <div
      style={{
        width: "100%",
        display: "grid",
        gap: "12px"
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px"
        }}
      >
        <div style={tileStyle}>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={videoStyle}
          />

          {!mediaStream && !screenStream && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeContent: "center",
                textAlign: "center",
                padding: "16px"
              }}
            >
              <div
                style={{
                  fontSize: "38px",
                  marginBottom: "8px"
                }}
              >
                🎥
              </div>

              <strong>Camera is off</strong>

              <button
                className="primary"
                onClick={onStartMedia}
                disabled={mediaLoading}
                style={{ marginTop: "12px" }}
              >
                {mediaLoading
                  ? "Connecting..."
                  : "Start camera and microphone"}
              </button>
            </div>
          )}

          <span style={labelStyle}>
            {userName} (You)
          </span>
        </div>

        {remoteParticipants.map(participant => (
          <RemoteVideoTile
            key={participant.socketId}
            participant={participant}
          />
        ))}
      </div>

      <div
        style={{
          color: "#cbd5e1",
          fontSize: "12px"
        }}
      >
        {remoteParticipants.length === 0
          ? "Waiting for other participants to join..."
          : `${remoteParticipants.length + 1} participants in this meeting`}
      </div>
    </div>
  );
}

function RemoteVideoTile({
  participant
}: {
  participant: RemoteParticipant;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <div style={tileStyle}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={videoStyle}
      />

      {participant.stream.getVideoTracks().length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeContent: "center",
            color: "#e2e8f0",
            fontSize: "28px"
          }}
        >
          {participant.name.slice(0, 1).toUpperCase()}
        </div>
      )}

      <span style={labelStyle}>
        {participant.name}
        {participant.connectionState !== "connected"
          ? ` · ${participant.connectionState}`
          : ""}
      </span>
    </div>
  );
}
