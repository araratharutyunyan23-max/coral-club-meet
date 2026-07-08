package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/coralclub/meet-backend/internal/livekit"
)

const maxBodyBytes = 4 << 10 // 4 KiB is plenty for a join request.

type tokenRequest struct {
	Room     string `json:"room"`
	Identity string `json:"identity"`
	Name     string `json:"name"`
	Role     string `json:"role"`
}

type tokenResponse struct {
	Token string `json:"token"`
	URL   string `json:"url"`
	Room  string `json:"room"`
	Role  string `json:"role"`
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type presenceResponse struct {
	Count int      `json:"count"`
	Names []string `json:"names"` // up to 4 display names, for initials only
}

// handlePresence returns how many people are currently in a room (plus a few
// display names for initials), so the pre-join lobby can show it before someone
// joins. Public (guests need it). A missing/not-yet-created room reports 0.
func (s *Server) handlePresence(w http.ResponseWriter, r *http.Request) {
	room := strings.TrimSpace(r.URL.Query().Get("room"))
	if room == "" || len(room) > 256 {
		writeError(w, http.StatusBadRequest, "room is required")
		return
	}
	names, count, err := s.moderator.ParticipantNames(room, 4)
	if err != nil {
		names, count = nil, 0 // room not created yet → nobody in it
	}
	if names == nil {
		names = []string{}
	}
	writeJSON(w, http.StatusOK, presenceResponse{Count: count, Names: names})
}

// handleToken validates a join request and returns a LiveKit access token.
//
// Role is authoritative from the server when Google sign-in is enabled: host is
// granted only to the verified owner of the room; everyone else (guests joining
// by link, signed-in non-owners) is a participant. The client-supplied role is
// ignored in that mode, so no one can self-grant RoomAdmin. When sign-in is not
// configured the legacy behavior (client-asserted role) is preserved.
func (s *Server) handleToken(w http.ResponseWriter, r *http.Request) {
	var req tokenRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	req.Room = strings.TrimSpace(req.Room)
	req.Identity = strings.TrimSpace(req.Identity)
	req.Name = strings.TrimSpace(req.Name)
	if req.Room == "" || req.Identity == "" {
		writeError(w, http.StatusBadRequest, "room and identity are required")
		return
	}
	if len(req.Room) > 256 || len(req.Identity) > 256 || len(req.Name) > 256 {
		writeError(w, http.StatusBadRequest, "room, identity, and name must each be 256 characters or fewer")
		return
	}

	role := livekit.Role(req.Role)
	switch role {
	case livekit.RoleHost, livekit.RoleViewer:
		// explicit role kept
	default:
		role = livekit.RoleParticipant
	}

	// With sign-in enabled the server decides the role, ignoring the body: host
	// only for the room's verified owner (in-memory map or durable grant).
	if s.authEnabled() {
		role = livekit.RoleParticipant
		if sess, ok := s.sessionFromRequest(r); ok && s.isRoomHost(r, req.Room, sess) {
			role = livekit.RoleHost
		}
	}

	// A locked room admits only its host; everyone else is turned away. Fail open
	// if the lock state can't be read (never block joins on a transient error).
	if role != livekit.RoleHost {
		if locked, err := s.moderator.IsLocked(req.Room); err == nil && locked {
			writeError(w, http.StatusForbidden, "room is locked")
			return
		}
	}

	token, err := s.issuer.Issue(livekit.TokenRequest{
		Room:     req.Room,
		Identity: req.Identity,
		Name:     req.Name,
		Role:     role,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to issue token")
		return
	}

	writeJSON(w, http.StatusOK, tokenResponse{Token: token, URL: s.livekitURL, Room: req.Room, Role: string(role)})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
