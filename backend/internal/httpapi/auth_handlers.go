package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/coralclub/meet-backend/internal/auth"
)

const (
	sessionCookie = "cc_session"
	sessionTTL    = 30 * 24 * time.Hour // ~1 month; fixed expiry (no sliding renewal)
	roomGrantTTL  = 30 * 24 * time.Hour // durable host proof, survives restarts
)

// authEnabled reports whether Google sign-in is configured. When false, the app
// keeps its original open behavior (no gate, client-asserted role).
func (s *Server) authEnabled() bool {
	return s.googleClientID != "" && s.verifier != nil && s.sessionSecret != ""
}

// handleConfig exposes the public client config the SPA needs at runtime,
// mirroring how the LiveKit url is delivered in the token response.
func (s *Server) handleConfig(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"googleClientId": s.googleClientID,
		"authRequired":   s.authEnabled(),
	})
}

type googleLoginRequest struct {
	Credential string `json:"credential"`
}

type authUser struct {
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

// handleGoogleLogin verifies the Google credential, mints a session cookie and
// returns the signed-in user's public profile.
func (s *Server) handleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	if !s.authEnabled() {
		writeError(w, http.StatusNotImplemented, "google sign-in is not configured")
		return
	}
	// Require a JSON content-type so this state-changing endpoint cannot be driven
	// by a cross-site form POST (text/plain is a CORS "simple" request); JSON forces
	// a preflight that our same-origin CORS policy blocks.
	if ct := r.Header.Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		writeError(w, http.StatusUnsupportedMediaType, "content-type must be application/json")
		return
	}
	var req googleLoginRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.Credential = strings.TrimSpace(req.Credential)
	if req.Credential == "" {
		writeError(w, http.StatusBadRequest, "credential is required")
		return
	}

	claims, err := s.verifier.Verify(r.Context(), req.Credential)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid Google credential")
		return
	}
	if !claims.EmailVerified {
		writeError(w, http.StatusForbidden, "email is not verified")
		return
	}

	token, err := auth.SignSession(auth.Session{
		Sub:     claims.Sub,
		Email:   claims.Email,
		Name:    claims.Name,
		Picture: claims.Picture,
	}, s.sessionSecret, sessionTTL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create session")
		return
	}
	s.setSessionCookie(w, token, int(sessionTTL.Seconds()))
	writeJSON(w, http.StatusOK, authUser{Email: claims.Email, Name: claims.Name, Picture: claims.Picture})
}

// handleMe returns the current user, or 401 if there is no valid session.
func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	sess, ok := s.sessionFromRequest(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "not signed in")
		return
	}
	writeJSON(w, http.StatusOK, authUser{Email: sess.Email, Name: sess.Name, Picture: sess.Picture})
}

// handleLogout clears the session cookie.
func (s *Server) handleLogout(w http.ResponseWriter, _ *http.Request) {
	s.setSessionCookie(w, "", -1)
	w.WriteHeader(http.StatusNoContent)
}

type createRoomRequest struct {
	Room string `json:"room"`
}

type createRoomResponse struct {
	Room  string `json:"room"`
	Grant string `json:"grant"` // durable host proof for X-Room-Grant
}

// handleCreateRoom registers a room owned by the signed-in caller (guarded by
// requireSession). An optional room id may be supplied — used for host-owned
// side rooms — otherwise a fresh id is generated. A room already owned by a
// different user cannot be claimed.
func (s *Server) handleCreateRoom(w http.ResponseWriter, r *http.Request) {
	sess, ok := s.sessionFromRequest(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "sign in required")
		return
	}

	var req createRoomRequest
	// Body is optional; ignore decode errors on an empty/absent body.
	_ = json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&req)
	room := strings.TrimSpace(req.Room)
	if room == "" {
		room = newRoomID()
	} else if len(room) > 256 {
		writeError(w, http.StatusBadRequest, "room id too long")
		return
	} else if owner, exists := s.rooms.owner(room); exists && owner != sess.Sub {
		writeError(w, http.StatusForbidden, "room already exists")
		return
	}

	s.rooms.set(room, sess.Sub)
	grant, err := auth.SignRoomGrant(room, sess.Sub, s.sessionSecret, roomGrantTTL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create room grant")
		return
	}
	writeJSON(w, http.StatusOK, createRoomResponse{Room: room, Grant: grant})
}

func (s *Server) setSessionCookie(w http.ResponseWriter, value string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   true, // browsers reach us over HTTPS (via Caddy); safe to require
		SameSite: http.SameSiteLaxMode,
	})
}

// sessionFromRequest returns the verified session for a request, if any.
func (s *Server) sessionFromRequest(r *http.Request) (auth.Session, bool) {
	if !s.authEnabled() {
		return auth.Session{}, false
	}
	c, err := r.Cookie(sessionCookie)
	if err != nil {
		return auth.Session{}, false
	}
	sess, err := auth.VerifySession(c.Value, s.sessionSecret)
	if err != nil {
		return auth.Session{}, false
	}
	return sess, true
}

// ownsRoom reports whether the caller may perform host/moderation actions on a
// room. With sign-in disabled the app keeps its legacy open behavior; with it
// enabled, the caller must have a valid session and be the room's host.
func (s *Server) ownsRoom(r *http.Request, room string) bool {
	if !s.authEnabled() {
		return true
	}
	sess, ok := s.sessionFromRequest(r)
	if !ok {
		return false
	}
	return s.isRoomHost(r, room, sess)
}

// isRoomHost reports whether the session hosts `room`, via the in-memory owner
// map or a valid durable room grant (X-Room-Grant header). A valid grant
// re-populates the map, so host powers survive backend restarts without any
// persisted server state.
func (s *Server) isRoomHost(r *http.Request, room string, sess auth.Session) bool {
	if owner, ok := s.rooms.owner(room); ok {
		return owner == sess.Sub
	}
	if g := r.Header.Get("X-Room-Grant"); g != "" {
		if grant, err := auth.VerifyRoomGrant(g, s.sessionSecret); err == nil && grant.Room == room && grant.Sub == sess.Sub {
			s.rooms.set(room, sess.Sub)
			return true
		}
	}
	return false
}

// requireSession guards routes that need a signed-in user (create-room).
func (s *Server) requireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.sessionFromRequest(r); !ok {
			writeError(w, http.StatusUnauthorized, "sign in required")
			return
		}
		next.ServeHTTP(w, r)
	})
}
