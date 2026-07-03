// Package breakout coordinates breakout groups for a meeting: it assigns
// participants to per-group LiveKit rooms and moves them there (and back) via
// the server-side MoveParticipant API. State is kept in memory, keyed by the
// main room — a single backend instance owns a meeting's breakout session.
package breakout

import (
	"errors"
	"strconv"
	"sync"
	"time"

	"github.com/coralclub/meet-backend/internal/livekit"
)

// ErrNoSession is returned when an action targets a meeting with no open breakout.
var ErrNoSession = errors.New("no active breakout")

// GroupRoom is the LiveKit room name for group idx (0-based) of a meeting.
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

// Coordinator owns breakout sessions and performs the server-side moves.
type Coordinator struct {
	mu       sync.Mutex
	sessions map[string]*Session
	mover    *livekit.Moderator
}

// NewCoordinator builds a Coordinator that moves participants via mover.
func NewCoordinator(mover *livekit.Moderator) *Coordinator {
	return &Coordinator{sessions: make(map[string]*Session), mover: mover}
}

// Open assigns groups and moves each participant into their breakout room.
// Best-effort: individual move failures (e.g. someone already left) are joined
// and returned, but the session is still opened.
func (c *Coordinator) Open(main string, groups [][]string, durationSec int, message string) error {
	sess := &Session{Open: true, Groups: groups, Message: message, Help: []string{}}
	if durationSec > 0 {
		sess.EndsAt = time.Now().Add(time.Duration(durationSec) * time.Second).UnixMilli()
	}
	c.mu.Lock()
	c.sessions[main] = sess
	c.mu.Unlock()

	var errs error
	for i, g := range groups {
		dest := GroupRoom(main, i)
		for _, id := range g {
			if err := c.mover.MoveParticipant(main, id, dest); err != nil {
				errs = errors.Join(errs, err)
			}
		}
	}
	return errs
}

// Close moves everyone back to the main room and ends the session.
func (c *Coordinator) Close(main string) error {
	c.mu.Lock()
	sess := c.sessions[main]
	if sess == nil {
		c.mu.Unlock()
		return ErrNoSession
	}
	groups := sess.Groups
	delete(c.sessions, main)
	c.mu.Unlock()

	var errs error
	for i, g := range groups {
		src := GroupRoom(main, i)
		for _, id := range g {
			if err := c.mover.MoveParticipant(src, id, main); err != nil {
				errs = errors.Join(errs, err)
			}
		}
	}
	return errs
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

// Visit moves a participant (the host) into group groupIdx, or back to the main
// room when groupIdx < 0. from is the mover's current room. Visiting a group also
// clears any pending help from that group's members.
func (c *Coordinator) Visit(main, from, identity string, groupIdx int) error {
	dest := main
	c.mu.Lock()
	sess := c.sessions[main]
	if groupIdx >= 0 {
		if sess == nil || groupIdx >= len(sess.Groups) {
			c.mu.Unlock()
			return ErrNoSession
		}
		dest = GroupRoom(main, groupIdx)
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
	}
	c.mu.Unlock()
	return c.mover.MoveParticipant(from, identity, dest)
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
