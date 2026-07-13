// Package httpapi exposes the backend's HTTP surface: a health check and the
// token endpoint the frontend calls to join a call.
package httpapi

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/coralclub/meet-backend/internal/livekit"
)

// Server wires the token issuer, moderator and recorder into HTTP handlers.
type Server struct {
	issuer        *livekit.Issuer
	moderator     *livekit.Moderator
	recorder      *livekit.Recorder
	livekitURL    string
	recordingsDir string

	// Create-meeting gate (empty createCode ⇒ gate disabled, app stays open).
	createCode    string
	sessionSecret string
	rooms         *roomOwners
	codeLimiter   *rateLimiter // throttles access-code guesses per IP
}

// NewServer constructs a Server. An empty createCode leaves the create-meeting
// gate disabled and the app in its original open behavior.
func NewServer(issuer *livekit.Issuer, moderator *livekit.Moderator, recorder *livekit.Recorder, createCode, sessionSecret, livekitURL, recordingsDir string) *Server {
	return &Server{
		issuer:        issuer,
		moderator:     moderator,
		recorder:      recorder,
		livekitURL:    livekitURL,
		recordingsDir: recordingsDir,
		createCode:    createCode,
		sessionSecret: sessionSecret,
		rooms:         newRoomOwners(),
		codeLimiter:   newRateLimiter(10, time.Minute),
	}
}

// Router builds the HTTP handler with middleware and routes.
func (s *Server) Router(allowedOrigins []string) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(15 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: allowedOrigins,
		AllowedMethods: []string{http.MethodGet, http.MethodPost, http.MethodOptions},
		AllowedHeaders: []string{"Content-Type", "Authorization"},
		MaxAge:         300,
	}))

	r.Get("/healthz", s.handleHealth)
	r.Route("/api", func(r chi.Router) {
		// Public runtime config (Google client id, whether sign-in is required).
		r.Get("/config", s.handleConfig)

		// Open to guests: role is derived server-side (host only for the owner).
		r.Post("/token", s.handleToken)

		// Open to guests: how many people are already in a room (pre-join count).
		r.Get("/presence", s.handlePresence)

		// Access-code sign-in: verify the shared code → session cookie; who-am-i; logout.
		r.Route("/auth", func(r chi.Router) {
			r.With(s.codeLimiter.middleware).Post("/code", s.handleCodeLogin)
			r.Get("/me", s.handleMe)
			r.Post("/logout", s.handleLogout)
		})

		// Create a meeting — requires a signed-in user when sign-in is enabled.
		r.Group(func(r chi.Router) {
			r.Use(s.requireSession)
			r.Post("/rooms", s.handleCreateRoom)
		})

		// Host moderation + recording (auth stubbed — see admin.go).
		r.Route("/admin", func(r chi.Router) {
			r.Post("/mute", s.handleMute)
			r.Post("/mute-all", s.handleMuteAll)
			r.Post("/remove", s.handleRemove)
			r.Post("/promote", s.handlePromote)
			r.Post("/lock", s.handleLock)
			r.Post("/record/start", s.handleRecordStart)
			r.Post("/record/stop", s.handleRecordStop)
		})
	})

	// Finished recordings (browsable + downloadable).
	r.Handle("/recordings/*", http.StripPrefix("/recordings/", http.FileServer(http.Dir(s.recordingsDir))))

	return r
}
