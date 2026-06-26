// Package livekit issues LiveKit access tokens for joining rooms.
//
// Tokens are signed JWTs that grant a participant permission to join a specific
// room with a specific role. The browser receives a token from this service and
// presents it directly to the LiveKit SFU — this service never sits on the media
// path.
package livekit

import (
	"errors"

	"github.com/livekit/protocol/auth"
	"time"
)

// Role determines the permissions baked into a token.
type Role string

const (
	// RoleHost can publish media and administer the room (mute others, etc.).
	RoleHost Role = "host"
	// RoleParticipant can publish and subscribe to media (default).
	RoleParticipant Role = "participant"
	// RoleViewer can only subscribe — used for webinar-style audiences.
	RoleViewer Role = "viewer"
)

// TokenRequest describes a participant joining a room.
type TokenRequest struct {
	Room     string
	Identity string
	Name     string
	Role     Role
}

// Issuer mints LiveKit access tokens using a fixed API key/secret pair.
type Issuer struct {
	apiKey string
	secret string
	ttl    time.Duration
}

// NewIssuer creates an Issuer. The key/secret must match the LiveKit server.
func NewIssuer(apiKey, secret string, ttl time.Duration) *Issuer {
	return &Issuer{apiKey: apiKey, secret: secret, ttl: ttl}
}

// Issue returns a signed JWT for the given request.
func (i *Issuer) Issue(req TokenRequest) (string, error) {
	if req.Room == "" || req.Identity == "" {
		return "", errors.New("room and identity are required")
	}

	canPublish := req.Role != RoleViewer
	grant := &auth.VideoGrant{
		RoomJoin:       true,
		Room:           req.Room,
		CanPublish:     &canPublish,
		CanSubscribe:   ptr(true),
		CanPublishData: ptr(true),
		// Lets participants update their own attributes (e.g. raise-hand state).
		CanUpdateOwnMetadata: ptr(true),
	}
	if req.Role == RoleHost {
		grant.RoomAdmin = true
	}

	at := auth.NewAccessToken(i.apiKey, i.secret)
	at.SetVideoGrant(grant).
		SetIdentity(req.Identity).
		SetName(req.Name).
		SetValidFor(i.ttl)

	return at.ToJWT()
}

func ptr[T any](v T) *T { return &v }
