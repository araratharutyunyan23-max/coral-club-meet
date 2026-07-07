package httpapi

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/coralclub/meet-backend/internal/livekit"
)

// Host moderation endpoints.
//
// When Google sign-in is enabled, every handler verifies the caller owns the
// target room (via s.ownsRoom) before acting through the backend's LiveKit admin
// credentials, so only a room's host can moderate it. When sign-in is disabled
// the app keeps its original open behavior.

type adminTarget struct {
	Room     string `json:"room"`
	Identity string `json:"identity"`
}

func (s *Server) handleMute(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeTarget(w, r)
	if !ok {
		return
	}
	if !s.ownsRoom(r, req.Room) {
		writeError(w, http.StatusForbidden, "host only")
		return
	}
	if err := s.moderator.MuteParticipant(req.Room, req.Identity); err != nil {
		if errors.Is(err, livekit.ErrParticipantNotFound) {
			writeError(w, http.StatusNotFound, "participant not found")
			return
		}
		log.Printf("admin mute %q/%q failed: %v", req.Room, req.Identity, err)
		writeError(w, http.StatusBadGateway, "failed to mute participant")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleRemove(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeTarget(w, r)
	if !ok {
		return
	}
	if !s.ownsRoom(r, req.Room) {
		writeError(w, http.StatusForbidden, "host only")
		return
	}
	if err := s.moderator.RemoveParticipant(req.Room, req.Identity); err != nil {
		writeError(w, http.StatusBadGateway, "failed to remove participant")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handlePromote(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeTarget(w, r)
	if !ok {
		return
	}
	if !s.ownsRoom(r, req.Room) {
		writeError(w, http.StatusForbidden, "host only")
		return
	}
	if err := s.moderator.PromoteToStage(req.Room, req.Identity); err != nil {
		writeError(w, http.StatusBadGateway, "failed to promote participant")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleMuteAll(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Room   string `json:"room"`
		Except string `json:"except"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Room = strings.TrimSpace(req.Room)
	if req.Room == "" {
		writeError(w, http.StatusBadRequest, "room is required")
		return
	}
	if !s.ownsRoom(r, req.Room) {
		writeError(w, http.StatusForbidden, "host only")
		return
	}
	muted, err := s.moderator.MuteAll(req.Room, strings.TrimSpace(req.Except))
	if err != nil {
		log.Printf("admin mute-all %q failed: %v", req.Room, err)
		writeError(w, http.StatusBadGateway, "failed to mute participants")
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"muted": muted})
}

func (s *Server) handleLock(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Room   string `json:"room"`
		Locked bool   `json:"locked"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Room = strings.TrimSpace(req.Room)
	if req.Room == "" {
		writeError(w, http.StatusBadRequest, "room is required")
		return
	}
	if !s.ownsRoom(r, req.Room) {
		writeError(w, http.StatusForbidden, "host only")
		return
	}
	if err := s.moderator.SetLocked(req.Room, req.Locked); err != nil {
		writeError(w, http.StatusBadGateway, "failed to update room")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleRecordStart(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Room string `json:"room"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Room = strings.TrimSpace(req.Room)
	if req.Room == "" {
		writeError(w, http.StatusBadRequest, "room is required")
		return
	}
	if !s.ownsRoom(r, req.Room) {
		writeError(w, http.StatusForbidden, "host only")
		return
	}
	id, err := s.recorder.Start(req.Room)
	if err != nil {
		writeError(w, http.StatusBadGateway, "failed to start recording")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"egressId": id})
}

func (s *Server) handleRecordStop(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Room string `json:"room"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Room = strings.TrimSpace(req.Room)
	if req.Room == "" {
		writeError(w, http.StatusBadRequest, "room is required")
		return
	}
	if !s.ownsRoom(r, req.Room) {
		writeError(w, http.StatusForbidden, "host only")
		return
	}
	if err := s.recorder.Stop(req.Room); err != nil {
		if errors.Is(err, livekit.ErrNoActiveRecording) {
			writeError(w, http.StatusConflict, "not recording")
			return
		}
		writeError(w, http.StatusBadGateway, "failed to stop recording")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func decodeTarget(w http.ResponseWriter, r *http.Request) (adminTarget, bool) {
	var req adminTarget
	if !decodeJSON(w, r, &req) {
		return req, false
	}
	req.Room = strings.TrimSpace(req.Room)
	req.Identity = strings.TrimSpace(req.Identity)
	if req.Room == "" || req.Identity == "" {
		writeError(w, http.StatusBadRequest, "room and identity are required")
		return req, false
	}
	return req, true
}

func decodeJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(v); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}
