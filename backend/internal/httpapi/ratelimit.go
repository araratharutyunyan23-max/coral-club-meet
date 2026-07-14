package httpapi

import (
	"net/http"
	"sync"
	"time"
)

// rateLimiter is a minimal fixed-window, per-key limiter (single-node, in-memory).
// It fronts the shared access-code endpoint so the one shared secret can't be
// brute-forced at line rate; constant-time compare stops timing, this stops volume.
type rateLimiter struct {
	mu        sync.Mutex
	hits      map[string]*rlWindow
	limit     int
	window    time.Duration
	nextSweep time.Time
}

type rlWindow struct {
	count   int
	resetAt time.Time
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{hits: map[string]*rlWindow{}, limit: limit, window: window}
}

// allow records a hit for key and reports whether it is within the window's limit.
// Expired entries are swept once per window so the map stays bounded to active keys.
func (rl *rateLimiter) allow(key string, now time.Time) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	if now.After(rl.nextSweep) {
		for k, w := range rl.hits {
			if now.After(w.resetAt) {
				delete(rl.hits, k)
			}
		}
		rl.nextSweep = now.Add(rl.window)
	}

	w := rl.hits[key]
	if w == nil || now.After(w.resetAt) {
		rl.hits[key] = &rlWindow{count: 1, resetAt: now.Add(rl.window)}
		return true
	}
	if w.count >= rl.limit {
		return false
	}
	w.count++
	return true
}

// middleware limits requests by client IP. RealIP (installed earlier in the chain)
// has already resolved r.RemoteAddr to the forwarded client address.
func (rl *rateLimiter) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !rl.allow(r.RemoteAddr, time.Now()) {
			writeError(w, http.StatusTooManyRequests, "too many attempts — wait a minute and try again")
			return
		}
		next.ServeHTTP(w, r)
	})
}
