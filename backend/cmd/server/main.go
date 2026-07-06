// Command server runs the Coral Club Meet backend: a small control-plane HTTP
// service that issues LiveKit access tokens. It never handles media.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/coralclub/meet-backend/internal/config"
	"github.com/coralclub/meet-backend/internal/httpapi"
	"github.com/coralclub/meet-backend/internal/livekit"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg, err := config.Load()
	if err != nil {
		logger.Error("invalid configuration", "err", err)
		os.Exit(1)
	}

	issuer := livekit.NewIssuer(cfg.LiveKitAPIKey, cfg.LiveKitSecret, cfg.TokenTTL)
	moderator := livekit.NewModerator(cfg.LiveKitHostURL, cfg.LiveKitAPIKey, cfg.LiveKitSecret)
	recorder := livekit.NewRecorder(cfg.LiveKitHostURL, cfg.LiveKitAPIKey, cfg.LiveKitSecret, cfg.EgressOutDir)
	api := httpapi.NewServer(issuer, moderator, recorder, cfg.LiveKitURL, cfg.RecordingsDir)

	httpServer := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           api.Router(cfg.AllowedOrigins),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		logger.Info("backend listening", "addr", httpServer.Addr, "livekit_url", cfg.LiveKitURL)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("http server error", "err", err)
			os.Exit(1)
		}
	}()

	// Graceful shutdown on SIGINT/SIGTERM.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	logger.Info("shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(ctx); err != nil {
		logger.Error("graceful shutdown failed", "err", err)
	}
}
