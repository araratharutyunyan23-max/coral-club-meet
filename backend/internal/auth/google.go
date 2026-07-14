// Package auth verifies Google sign-in credentials and manages our own session
// cookie. It uses only the standard library: Google ID tokens are RS256 JWTs
// signed by Google's published keys, which we fetch and cache ourselves.
package auth

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// GoogleClaims are the identity fields we read from a verified ID token.
type GoogleClaims struct {
	Sub           string
	Email         string
	EmailVerified bool
	Name          string
	Picture       string
}

const googleCertsURL = "https://www.googleapis.com/oauth2/v3/certs"

// GoogleVerifier validates Google Identity Services credentials (ID tokens)
// against a fixed OAuth client id, caching Google's signing keys for their
// advertised lifetime.
type GoogleVerifier struct {
	clientID string
	client   *http.Client

	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	expires time.Time

	// refreshMu serializes network refreshes (single-flight); lastRefresh throttles
	// them so unauthenticated requests with unknown key ids can't amplify traffic
	// to Google. Both are only touched while holding refreshMu.
	refreshMu   sync.Mutex
	lastRefresh time.Time
}

// minRefreshInterval caps how often we hit Google's JWKS endpoint. Google rotates
// keys roughly daily with overlap, so a short throttle never breaks real logins.
const minRefreshInterval = 15 * time.Second

// NewGoogleVerifier builds a verifier for the given public OAuth client id.
func NewGoogleVerifier(clientID string) *GoogleVerifier {
	return &GoogleVerifier{
		clientID: clientID,
		client:   &http.Client{Timeout: 10 * time.Second},
		keys:     map[string]*rsa.PublicKey{},
	}
}

// Verify checks the token's signature, issuer, audience and expiry and returns
// the identity claims. Any failure is a hard error — the credential is rejected.
func (v *GoogleVerifier) Verify(ctx context.Context, idToken string) (GoogleClaims, error) {
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return GoogleClaims{}, errors.New("malformed token")
	}

	headerBytes, err := b64urlDecode(parts[0])
	if err != nil {
		return GoogleClaims{}, errors.New("malformed token header")
	}
	var hdr struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	if err := json.Unmarshal(headerBytes, &hdr); err != nil {
		return GoogleClaims{}, errors.New("malformed token header")
	}
	if hdr.Alg != "RS256" {
		return GoogleClaims{}, fmt.Errorf("unexpected signing alg %q", hdr.Alg)
	}

	key, err := v.key(ctx, hdr.Kid)
	if err != nil {
		return GoogleClaims{}, err
	}

	sig, err := b64urlDecode(parts[2])
	if err != nil {
		return GoogleClaims{}, errors.New("malformed signature")
	}
	sum := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(key, crypto.SHA256, sum[:], sig); err != nil {
		return GoogleClaims{}, errors.New("signature verification failed")
	}

	payload, err := b64urlDecode(parts[1])
	if err != nil {
		return GoogleClaims{}, errors.New("malformed token payload")
	}
	var c struct {
		Iss           string `json:"iss"`
		Aud           string `json:"aud"`
		Exp           int64  `json:"exp"`
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}
	if err := json.Unmarshal(payload, &c); err != nil {
		return GoogleClaims{}, errors.New("malformed token payload")
	}

	if c.Iss != "accounts.google.com" && c.Iss != "https://accounts.google.com" {
		return GoogleClaims{}, fmt.Errorf("unexpected issuer %q", c.Iss)
	}
	if c.Aud != v.clientID {
		return GoogleClaims{}, errors.New("audience mismatch")
	}
	if c.Sub == "" {
		return GoogleClaims{}, errors.New("missing subject")
	}
	// 30s leeway for small clock skew.
	if time.Now().After(time.Unix(c.Exp, 0).Add(30 * time.Second)) {
		return GoogleClaims{}, errors.New("token expired")
	}

	return GoogleClaims{
		Sub:           c.Sub,
		Email:         c.Email,
		EmailVerified: c.EmailVerified,
		Name:          c.Name,
		Picture:       c.Picture,
	}, nil
}

// key returns the RSA public key with the given id, refreshing Google's key set
// if the cache is stale or the id is unknown. Refreshes are single-flighted and
// throttled so a flood of unknown-kid tokens cannot amplify requests to Google.
func (v *GoogleVerifier) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	if k, ok := v.cached(kid); ok {
		return k, nil
	}

	v.refreshMu.Lock()
	defer v.refreshMu.Unlock()

	// Another goroutine may have refreshed while we waited on the lock.
	if k, ok := v.cached(kid); ok {
		return k, nil
	}
	if time.Since(v.lastRefresh) < minRefreshInterval {
		return nil, errors.New("signing key not found")
	}
	v.lastRefresh = time.Now()
	if err := v.refresh(ctx); err != nil {
		return nil, err
	}
	if k, ok := v.cached(kid); ok {
		return k, nil
	}
	return nil, errors.New("signing key not found")
}

// cached returns the key for kid if the cache is still fresh and contains it.
func (v *GoogleVerifier) cached(kid string) (*rsa.PublicKey, bool) {
	v.mu.RLock()
	defer v.mu.RUnlock()
	if time.Now().Before(v.expires) {
		if k, ok := v.keys[kid]; ok {
			return k, true
		}
	}
	return nil, false
}

func (v *GoogleVerifier) refresh(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, googleCertsURL, nil)
	if err != nil {
		return err
	}
	resp, err := v.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("google certs: status %d", resp.StatusCode)
	}

	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return err
	}

	keys := make(map[string]*rsa.PublicKey, len(jwks.Keys))
	for _, k := range jwks.Keys {
		if k.Kty != "RSA" {
			continue
		}
		nb, err := b64urlDecode(k.N)
		if err != nil {
			continue
		}
		eb, err := b64urlDecode(k.E)
		if err != nil {
			continue
		}
		e := 0
		for _, b := range eb {
			e = e<<8 | int(b)
		}
		if e == 0 {
			continue
		}
		keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nb), E: e}
	}
	if len(keys) == 0 {
		return errors.New("no RSA keys in google certs response")
	}

	v.mu.Lock()
	v.keys = keys
	v.expires = time.Now().Add(cacheTTL(resp.Header.Get("Cache-Control")))
	v.mu.Unlock()
	return nil
}

// cacheTTL parses max-age from a Cache-Control header, clamped to [5m, 24h] with
// a 1h default so a missing/odd header never disables caching or caches forever.
func cacheTTL(cacheControl string) time.Duration {
	ttl := time.Hour
	for _, part := range strings.Split(cacheControl, ",") {
		part = strings.TrimSpace(part)
		if v, ok := strings.CutPrefix(part, "max-age="); ok {
			if secs, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && secs > 0 {
				ttl = time.Duration(secs) * time.Second
			}
		}
	}
	if ttl < 5*time.Minute {
		ttl = 5 * time.Minute
	}
	if ttl > 24*time.Hour {
		ttl = 24 * time.Hour
	}
	return ttl
}

// b64urlDecode decodes base64url with or without padding.
func b64urlDecode(s string) ([]byte, error) {
	if m := len(s) % 4; m != 0 {
		s += strings.Repeat("=", 4-m)
	}
	return base64.URLEncoding.DecodeString(s)
}
