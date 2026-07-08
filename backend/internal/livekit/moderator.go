package livekit

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
)

// ErrParticipantNotFound is returned when the target participant is not in the room.
var ErrParticipantNotFound = errors.New("participant not found")

// Moderator performs host actions against a room via the LiveKit server API.
// These are privileged server-side operations — the API key/secret never leave
// the backend.
type Moderator struct {
	client *lksdk.RoomServiceClient
}

// NewModerator builds a Moderator. hostURL is the LiveKit HTTP(S) API URL.
func NewModerator(hostURL, apiKey, apiSecret string) *Moderator {
	return &Moderator{client: lksdk.NewRoomServiceClient(hostURL, apiKey, apiSecret)}
}

func timeoutCtx() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 10*time.Second)
}

// MuteParticipant mutes every published audio track of one participant.
func (m *Moderator) MuteParticipant(room, identity string) error {
	ctx, cancel := timeoutCtx()
	defer cancel()

	list, err := m.client.ListParticipants(ctx, &livekit.ListParticipantsRequest{Room: room})
	if err != nil {
		return err
	}
	for _, p := range list.Participants {
		if p.Identity != identity {
			continue
		}
		for _, t := range p.Tracks {
			if t.Type == livekit.TrackType_AUDIO && !t.Muted {
				if _, err := m.client.MutePublishedTrack(ctx, &livekit.MuteRoomTrackRequest{
					Room: room, Identity: identity, TrackSid: t.Sid, Muted: true,
				}); err != nil {
					return err
				}
			}
		}
		return nil
	}
	return ErrParticipantNotFound
}

// MuteAll mutes everyone's audio except the given identity (the host). Returns
// the number of tracks muted.
func (m *Moderator) MuteAll(room, exceptIdentity string) (int, error) {
	listCtx, cancel := timeoutCtx()
	defer cancel()

	list, err := m.client.ListParticipants(listCtx, &livekit.ListParticipantsRequest{Room: room})
	if err != nil {
		return 0, err
	}

	// Best-effort: keep going past individual failures so one bad track does not
	// abort the whole mute-all. Each mute gets its own timeout budget.
	muted := 0
	var errs error
	for _, p := range list.Participants {
		if p.Identity == exceptIdentity {
			continue
		}
		for _, t := range p.Tracks {
			if t.Type != livekit.TrackType_AUDIO || t.Muted {
				continue
			}
			mctx, mcancel := timeoutCtx()
			_, err := m.client.MutePublishedTrack(mctx, &livekit.MuteRoomTrackRequest{
				Room: room, Identity: p.Identity, TrackSid: t.Sid, Muted: true,
			})
			mcancel()
			if err != nil {
				errs = errors.Join(errs, err)
				continue
			}
			muted++
		}
	}
	return muted, errs
}

// RemoveParticipant disconnects a participant from the room.
func (m *Moderator) RemoveParticipant(room, identity string) error {
	ctx, cancel := timeoutCtx()
	defer cancel()
	_, err := m.client.RemoveParticipant(ctx, &livekit.RoomParticipantIdentity{Room: room, Identity: identity})
	return err
}

// PromoteToStage grants publish permission to an audience member (webinar mode).
func (m *Moderator) PromoteToStage(room, identity string) error {
	ctx, cancel := timeoutCtx()
	defer cancel()
	_, err := m.client.UpdateParticipant(ctx, &livekit.UpdateParticipantRequest{
		Room:     room,
		Identity: identity,
		Permission: &livekit.ParticipantPermission{
			CanSubscribe:   true,
			CanPublish:     true,
			CanPublishData: true,
		},
	})
	return err
}

// SetLocked records the room's locked state in its metadata. Enforcement is in
// the token endpoint (see IsLocked), which turns away non-host joiners.
func (m *Moderator) SetLocked(room string, locked bool) error {
	ctx, cancel := timeoutCtx()
	defer cancel()
	metadata := `{"locked":false}`
	if locked {
		metadata = `{"locked":true}`
	}
	_, err := m.client.UpdateRoomMetadata(ctx, &livekit.UpdateRoomMetadataRequest{Room: room, Metadata: metadata})
	return err
}

// ParticipantNames returns up to `limit` display names of the people currently in
// the room, plus the total count. Used by the pre-join presence indicator, which
// renders only initials + a per-person hue client-side. A room that does not exist
// yet (nobody has joined) is empty.
func (m *Moderator) ParticipantNames(room string, limit int) (names []string, total int, err error) {
	ctx, cancel := timeoutCtx()
	defer cancel()
	list, err := m.client.ListParticipants(ctx, &livekit.ListParticipantsRequest{Room: room})
	if err != nil {
		return nil, 0, err
	}
	names = make([]string, 0, limit)
	for _, p := range list.Participants {
		if len(names) >= limit {
			break
		}
		n := p.Name
		if n == "" {
			n = p.Identity
		}
		names = append(names, n)
	}
	return names, len(list.Participants), nil
}

// IsLocked reports whether the room is currently locked (per its metadata). A
// room that does not exist yet is not locked.
func (m *Moderator) IsLocked(room string) (bool, error) {
	ctx, cancel := timeoutCtx()
	defer cancel()
	list, err := m.client.ListRooms(ctx, &livekit.ListRoomsRequest{Names: []string{room}})
	if err != nil {
		return false, err
	}
	for _, r := range list.Rooms {
		if r.Name != room || r.Metadata == "" {
			continue
		}
		var meta struct {
			Locked bool `json:"locked"`
		}
		if err := json.Unmarshal([]byte(r.Metadata), &meta); err != nil {
			return false, nil
		}
		return meta.Locked, nil
	}
	return false, nil
}
