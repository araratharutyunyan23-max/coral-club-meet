package httpapi

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/coralclub/meet-backend/internal/breakout"
)

// Breakout endpoints. Host-authorship is STUBBED like the rest of /api/admin —
// before launch each must verify the caller hosts the target room.

func (s *Server) handleBreakoutState(w http.ResponseWriter, r *http.Request) {
	room := strings.TrimSpace(r.URL.Query().Get("room"))
	if room == "" {
		writeError(w, http.StatusBadRequest, "room is required")
		return
	}
	if state := s.breakout.State(room); state != nil {
		writeJSON(w, http.StatusOK, state)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"open": false})
}

func (s *Server) handleBreakoutOpen(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Room        string     `json:"room"`
		Groups      [][]string `json:"groups"`
		DurationSec int        `json:"durationSec"`
		Message     string     `json:"message"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Room = strings.TrimSpace(req.Room)
	if req.Room == "" || len(req.Groups) == 0 {
		writeError(w, http.StatusBadRequest, "room and groups are required")
		return
	}
	if err := s.breakout.Open(req.Room, req.Groups, req.DurationSec, req.Message); err != nil {
		// Best-effort: a participant may have already left. Log and still succeed
		// so the host UI reflects the opened session.
		log.Printf("breakout open %q: partial move errors: %v", req.Room, err)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleBreakoutClose(w http.ResponseWriter, r *http.Request) {
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
	if err := s.breakout.Close(req.Room); err != nil {
		if errors.Is(err, breakout.ErrNoSession) {
			writeError(w, http.StatusConflict, "no active breakout")
			return
		}
		log.Printf("breakout close %q: partial move errors: %v", req.Room, err)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleBreakoutBroadcast(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Room    string `json:"room"`
		Message string `json:"message"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Room = strings.TrimSpace(req.Room)
	if req.Room == "" {
		writeError(w, http.StatusBadRequest, "room is required")
		return
	}
	if err := s.breakout.Broadcast(req.Room, req.Message); err != nil {
		writeError(w, http.StatusConflict, "no active breakout")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleBreakoutHelp(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeTarget(w, r) // {room, identity}
	if !ok {
		return
	}
	if err := s.breakout.Help(req.Room, req.Identity); err != nil {
		writeError(w, http.StatusConflict, "no active breakout")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleBreakoutVisit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Room     string `json:"room"`
		From     string `json:"from"`
		Identity string `json:"identity"`
		Group    int    `json:"group"` // >=0 visit that group, <0 back to main
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Room = strings.TrimSpace(req.Room)
	if req.Room == "" {
		writeError(w, http.StatusBadRequest, "room is required")
		return
	}
	if err := s.breakout.Visit(req.Room, req.Group); err != nil {
		if errors.Is(err, breakout.ErrNoSession) {
			writeError(w, http.StatusConflict, "no active breakout")
			return
		}
		writeError(w, http.StatusBadGateway, "failed to update breakout")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
