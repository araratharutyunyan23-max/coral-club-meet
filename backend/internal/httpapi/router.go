// Package httpapi exposes the backend's HTTP surface: a health check and the
// token endpoint the frontend calls to join a call.
package httpapi

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/coralclub/meet-backend/internal/breakout"
	"github.com/coralclub/meet-backend/internal/livekit"
)

// Server wires the token issuer, moderator, recorder and breakout coordinator
// into HTTP handlers.
type Server struct {
	issuer        *livekit.Issuer
	moderator     *livekit.Moderator
	recorder      *livekit.Recorder
	breakout      *breakout.Coordinator
	livekitURL    string
	recordingsDir string
}

// NewServer constructs a Server.
func NewServer(issuer *livekit.Issuer, moderator *livekit.Moderator, recorder *livekit.Recorder, breakoutCoord *breakout.Coordinator, livekitURL, recordingsDir string) *Server {
	return &Server{issuer: issuer, moderator: moderator, recorder: recorder, breakout: breakoutCoord, livekitURL: livekitURL, recordingsDir: recordingsDir}
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
		r.Post("/token", s.handleToken)

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

		// Breakout groups (host-triggered; auth stubbed — see breakout.go).
		r.Route("/breakout", func(r chi.Router) {
			r.Get("/", s.handleBreakoutState) // ?room=<main>
			r.Post("/open", s.handleBreakoutOpen)
			r.Post("/close", s.handleBreakoutClose)
			r.Post("/broadcast", s.handleBreakoutBroadcast)
			r.Post("/help", s.handleBreakoutHelp)
			r.Post("/visit", s.handleBreakoutVisit)
		})
	})

	// Finished recordings (browsable + downloadable).
	r.Handle("/recordings/*", http.StripPrefix("/recordings/", http.FileServer(http.Dir(s.recordingsDir))))

	return r
}
