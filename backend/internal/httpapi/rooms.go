package httpapi

import (
	"crypto/rand"
	"sync"
)

// roomOwners maps a room id to the Google subject (stable user id) that created
// it, so the token endpoint can grant the host role only to the owner.
//
// In-memory by design: ownership is reset when the backend restarts. For this
// app that is acceptable — a restarted host simply re-creates the meeting (or
// rejoins as a participant). Persisting ownership is a possible follow-up.
// maxRooms bounds the ownership map so a signed-in user looping create-room can't
// exhaust memory. When exceeded, the oldest entry is evicted (its meeting simply
// falls back to no server-side host, same as after a restart).
const maxRooms = 50000

type roomOwners struct {
	mu    sync.RWMutex
	m     map[string]string
	order []string // insertion order, for FIFO eviction
}

func newRoomOwners() *roomOwners { return &roomOwners{m: make(map[string]string)} }

func (r *roomOwners) set(room, sub string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.m[room]; !exists {
		if len(r.order) >= maxRooms {
			oldest := r.order[0]
			r.order = r.order[1:]
			delete(r.m, oldest)
		}
		r.order = append(r.order, room)
	}
	r.m[room] = sub
}

func (r *roomOwners) owner(room string) (string, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	s, ok := r.m[room]
	return s, ok
}

// roomAlphabet excludes visually ambiguous characters (0/o/1/l).
const roomAlphabet = "abcdefghijkmnpqrstuvwxyz23456789"

// newRoomID returns a short, url-safe id like "a3f9-7k2p-x8qd".
func newRoomID() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	out := make([]byte, 0, 14)
	for i, x := range b {
		if i == 4 || i == 8 {
			out = append(out, '-')
		}
		out = append(out, roomAlphabet[int(x)%len(roomAlphabet)])
	}
	return string(out)
}
