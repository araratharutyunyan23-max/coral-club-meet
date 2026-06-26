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
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// handleToken validates a join request and returns a LiveKit access token.
//
// NOTE: authentication is intentionally stubbed for the prototype. Before any
// real launch, this handler must verify the caller's existing Coral Club
// session and derive identity/role from it rather than trusting the request body.
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

	writeJSON(w, http.StatusOK, tokenResponse{Token: token, URL: s.livekitURL, Room: req.Room})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
