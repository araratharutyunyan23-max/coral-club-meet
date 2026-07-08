package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// Session is the claim set stored in our own cookie after a successful Google
// sign-in. Google's ID token is discarded once verified; this is the app's own
// short-lived session, signed with the server's SESSION_SECRET (HS256).
type Session struct {
	Sub     string `json:"sub"` // stable Google subject id
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
	Exp     int64  `json:"exp"`
}

const sessionHeader = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" // base64url of {"alg":"HS256","typ":"JWT"}

// SignSession returns a compact HS256 token (header.payload.sig) for the session,
// expiring after ttl.
func SignSession(s Session, secret string, ttl time.Duration) (string, error) {
	s.Exp = time.Now().Add(ttl).Unix()
	payload, err := json.Marshal(s)
	if err != nil {
		return "", err
	}
	body := base64.RawURLEncoding.EncodeToString(payload)
	signingInput := sessionHeader + "." + body
	return signingInput + "." + sign(signingInput, secret), nil
}

// VerifySession validates the signature and expiry and returns the session.
func VerifySession(token, secret string) (Session, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return Session{}, errors.New("malformed session")
	}
	expected := sign(parts[0]+"."+parts[1], secret)
	if !hmac.Equal([]byte(expected), []byte(parts[2])) {
		return Session{}, errors.New("bad session signature")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return Session{}, errors.New("malformed session payload")
	}
	var s Session
	if err := json.Unmarshal(payload, &s); err != nil {
		return Session{}, errors.New("malformed session payload")
	}
	if s.Exp == 0 || time.Now().Unix() > s.Exp {
		return Session{}, errors.New("session expired")
	}
	return s, nil
}

func sign(input, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(input))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// RoomGrant is a durable, signed proof that a user owns (hosts) a specific room.
// It is issued when the room is created and presented via the X-Room-Grant header
// so host powers survive backend restarts without persisting any server state.
type RoomGrant struct {
	Room string `json:"room"`
	Sub  string `json:"sub"`
	Exp  int64  `json:"exp"`
}

// SignRoomGrant returns a compact HS256 grant token, expiring after ttl.
func SignRoomGrant(room, sub, secret string, ttl time.Duration) (string, error) {
	g := RoomGrant{Room: room, Sub: sub, Exp: time.Now().Add(ttl).Unix()}
	payload, err := json.Marshal(g)
	if err != nil {
		return "", err
	}
	body := base64.RawURLEncoding.EncodeToString(payload)
	signingInput := sessionHeader + "." + body
	return signingInput + "." + sign(signingInput, secret), nil
}

// VerifyRoomGrant validates the signature and expiry and returns the grant.
func VerifyRoomGrant(token, secret string) (RoomGrant, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return RoomGrant{}, errors.New("malformed grant")
	}
	if !hmac.Equal([]byte(sign(parts[0]+"."+parts[1], secret)), []byte(parts[2])) {
		return RoomGrant{}, errors.New("bad grant signature")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return RoomGrant{}, errors.New("malformed grant payload")
	}
	var g RoomGrant
	if err := json.Unmarshal(payload, &g); err != nil {
		return RoomGrant{}, errors.New("malformed grant payload")
	}
	if g.Exp == 0 || time.Now().Unix() > g.Exp {
		return RoomGrant{}, errors.New("grant expired")
	}
	return g, nil
}
