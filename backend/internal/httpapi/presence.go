package httpapi

import (
	"net/http"
	"strings"
	"unicode"
)

// presenceMember is the privacy-preserving shape sent to the pre-join lobby: just
// two-letter initials + a stable hue. Full display names never leave the backend.
type presenceMember struct {
	Initials string `json:"initials"`
	Hue      int    `json:"hue"`
}

type presenceResponse struct {
	Count   int              `json:"count"`
	Members []presenceMember `json:"members"`
}

// handlePresence returns how many people are already in a room (plus initials +
// hues for up to a few of them), so the pre-join lobby can show it before someone
// joins. Public (guests need it) — it reveals only a count and initials, never the
// participants' names or identities. A missing/not-yet-created room reports 0.
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
	members := make([]presenceMember, 0, len(names))
	for _, n := range names {
		members = append(members, presenceMember{Initials: initialsFor(n), Hue: hueFor(n)})
	}
	writeJSON(w, http.StatusOK, presenceResponse{Count: count, Members: members})
}

// avatarHues mirrors the frontend's curated hue set so pre-join circles read the
// same as the in-call avatars.
var avatarHues = []int{4, 16, 28, 42, 140, 162, 178, 194, 210, 228, 250, 274, 300, 330}

// hueFor is the Go twin of the frontend hueFor: a deterministic pleasant hue for a
// key (participant name), so the same person keeps a stable colour.
func hueFor(key string) int {
	if key == "" {
		key = "?"
	}
	var h uint32
	for _, c := range key {
		h = h*31 + uint32(c)
	}
	return avatarHues[int(h)%len(avatarHues)]
}

// initialsFor is the Go twin of the frontend initialsFor: up to two letters from a
// display name (first + last word, or the first two letters of a single word).
func initialsFor(name string) string {
	parts := strings.FieldsFunc(name, func(r rune) bool { return unicode.IsSpace(r) || r == '-' })
	if len(parts) == 0 {
		return "?"
	}
	if len(parts) == 1 {
		return strings.ToUpper(firstRunes(parts[0], 2))
	}
	return strings.ToUpper(firstRunes(parts[0], 1) + firstRunes(parts[len(parts)-1], 1))
}

func firstRunes(s string, n int) string {
	i := 0
	for idx := range s {
		if i == n {
			return s[:idx]
		}
		i++
	}
	return s
}
