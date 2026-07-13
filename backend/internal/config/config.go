// Package config loads runtime configuration from environment variables.
package config

import (
	"fmt"
	"os"
	"strings"
	"time"
)

// Config holds runtime configuration for the backend service.
type Config struct {
	Port           string
	LiveKitURL     string // ws(s):// — used by the browser
	LiveKitHostURL string // http(s):// — used by the backend's server API client
	LiveKitAPIKey  string
	LiveKitSecret  string
	AllowedOrigins []string
	TokenTTL       time.Duration
	RecordingsDir  string // where the backend serves finished recordings from
	EgressOutDir   string // path the Egress service writes files to (its mount)

	// Create-meeting gate. When CreateCode is set, creating a meeting requires the
	// shared access code (staff know it; guests join by link freely) and host role
	// is derived server-side; empty keeps the current open behavior. SessionSecret
	// signs our own session cookie and is required whenever CreateCode is set.
	CreateCode    string
	SessionSecret string
}

// Load reads configuration from the environment, applying local-development
// defaults. It returns an error only for values that have no safe default.
func Load() (Config, error) {
	apiKey := os.Getenv("LIVEKIT_API_KEY")
	apiSecret := os.Getenv("LIVEKIT_API_SECRET")

	// In explicit dev mode, fall back to LiveKit's well-known dev credentials.
	// Outside dev mode there is no implicit default — credentials are required,
	// so production can never silently run on the dev key.
	if isTrue(os.Getenv("LIVEKIT_DEV")) {
		if apiKey == "" {
			apiKey = "devkey"
		}
		if apiSecret == "" {
			apiSecret = "secret"
		}
	}

	cfg := Config{
		Port:           env("PORT", "8080"),
		LiveKitURL:     env("LIVEKIT_URL", "ws://localhost:7880"),
		LiveKitAPIKey:  apiKey,
		LiveKitSecret:  apiSecret,
		AllowedOrigins: splitCSV(env("ALLOWED_ORIGINS", "http://localhost:5173")),
		TokenTTL:       time.Hour,
		RecordingsDir:  env("RECORDINGS_DIR", "./recordings"),
		EgressOutDir:   env("EGRESS_OUT_DIR", "/out"),
	}

	cfg.LiveKitHostURL = env("LIVEKIT_HOST_URL", httpFromWS(cfg.LiveKitURL))

	cfg.CreateCode = env("CREATE_CODE", "")
	cfg.SessionSecret = os.Getenv("SESSION_SECRET")

	if cfg.LiveKitAPIKey == "" || cfg.LiveKitSecret == "" {
		return Config{}, fmt.Errorf("LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set (or set LIVEKIT_DEV=true for local dev credentials)")
	}
	// A session signing key is mandatory once the create-code gate is enabled, so
	// prod can never issue unsigned/forgeable sessions.
	if cfg.CreateCode != "" && cfg.SessionSecret == "" {
		return Config{}, fmt.Errorf("SESSION_SECRET must be set when CREATE_CODE is set (generate with: openssl rand -base64 48)")
	}
	// Fail closed in production: without the gate, anyone could create rooms and
	// claim host/moderation. Only explicit dev mode is allowed to run open.
	if cfg.CreateCode == "" && !isTrue(os.Getenv("LIVEKIT_DEV")) {
		return Config{}, fmt.Errorf("CREATE_CODE must be set in production (or set LIVEKIT_DEV=true for open local dev)")
	}
	return cfg, nil
}

// httpFromWS converts a ws(s):// URL to its http(s):// equivalent for the
// server API client.
func httpFromWS(u string) string {
	switch {
	case strings.HasPrefix(u, "wss://"):
		return "https://" + strings.TrimPrefix(u, "wss://")
	case strings.HasPrefix(u, "ws://"):
		return "http://" + strings.TrimPrefix(u, "ws://")
	default:
		return u
	}
}

func isTrue(s string) bool {
	return strings.EqualFold(s, "true") || s == "1"
}

func env(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
