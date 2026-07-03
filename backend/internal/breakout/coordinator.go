// Package breakout coordinates breakout groups for a meeting. It holds the
// assignment + timer + broadcast + help state in memory (keyed by the main
// room) and serves it to every client by polling. The actual media move is done
// CLIENT-SIDE (each client reconnects to its group room) — self-hosted
// open-source LiveKit does not implement server-side MoveParticipant.
package breakout

import (
	"errors"
	"strconv"
	"sync"
	"time"
)

// ErrNoSession is returned when an action targets a meeting with no open breakout.
var ErrNoSession = errors.New("no active breakout")

// GroupRoom is the LiveKit room name for group idx (0-based) of a meeting. The
// client uses the same convention to reconnect itself.
func GroupRoom(main string, idx int) string {
	return main + "__g" + strconv.Itoa(idx+1)
}

// Session is a meeting's live breakout state (also the shape polled by clients).
type Session struct {
	Open    bool       `json:"open"`
	Groups  [][]string `json:"groups"`  // group idx -> participant identities
	Message string     `json:"message"` // host broadcast to all groups
	EndsAt  int64      `json:"endsAt"`  // epoch ms, 0 = no timer
	Help    []string   `json:"help"`    // identities who asked the host for help
}

// Coordinator owns breakout sessions (pure state; clients do the moving).
type Coordinator struct {
	mu       sync.Mutex
	sessions map[string]*Session
}

// NewCoordinator builds an empty Coordinator.
func NewCoordinator() *Coordinator {
	return &Coordinator{sessions: make(map[string]*Session)}
}

// Open records the group assignment + timer. Clients see it on their next poll
// and each reconnects to its group room.
func (c *Coordinator) Open(main string, groups [][]string, durationSec int, message string) error {
	sess := &Session{Open: true, Groups: groups, Message: message, Help: []string{}}
	if durationSec > 0 {
		sess.EndsAt = time.Now().Add(time.Duration(durationSec) * time.Second).UnixMilli()
	}
	c.mu.Lock()
	c.sessions[main] = sess
	c.mu.Unlock()
	return nil
}

// Close ends the session; clients see open:false and reconnect back to main.
func (c *Coordinator) Close(main string) error {
	c.mu.Lock()
	_, ok := c.sessions[main]
	delete(c.sessions, main)
	c.mu.Unlock()
	if !ok {
		return ErrNoSession
	}
	return nil
}

// Broadcast updates the message shown in every group.
func (c *Coordinator) Broadcast(main, message string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	sess := c.sessions[main]
	if sess == nil {
		return ErrNoSession
	}
	sess.Message = message
	return nil
}

// Help records that a participant asked the host to visit their group.
func (c *Coordinator) Help(main, identity string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	sess := c.sessions[main]
	if sess == nil {
		return ErrNoSession
	}
	for _, h := range sess.Help {
		if h == identity {
			return nil // already pending
		}
	}
	sess.Help = append(sess.Help, identity)
	return nil
}

// Visit clears a group's pending help when the host drops in (groupIdx >= 0).
// For groupIdx < 0 (host returning to control) it's a no-op. The host's actual
// move between rooms is client-side.
func (c *Coordinator) Visit(main string, groupIdx int) error {
	if groupIdx < 0 {
		return nil
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	sess := c.sessions[main]
	if sess == nil || groupIdx >= len(sess.Groups) {
		return ErrNoSession
	}
	members := make(map[string]bool, len(sess.Groups[groupIdx]))
	for _, m := range sess.Groups[groupIdx] {
		members[m] = true
	}
	out := sess.Help[:0]
	for _, h := range sess.Help {
		if !members[h] {
			out = append(out, h)
		}
	}
	sess.Help = out
	return nil
}

// State returns a snapshot for polling, or nil when no breakout is open.
func (c *Coordinator) State(main string) *Session {
	c.mu.Lock()
	defer c.mu.Unlock()
	sess := c.sessions[main]
	if sess == nil {
		return nil
	}
	cp := *sess
	cp.Groups = make([][]string, len(sess.Groups))
	for i, g := range sess.Groups {
		cp.Groups[i] = append([]string(nil), g...)
	}
	cp.Help = append([]string(nil), sess.Help...)
	return &cp
}
