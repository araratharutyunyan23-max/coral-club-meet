package livekit

import (
	"context"
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

// SetLocked records the room's locked state in its metadata. NOTE: enforcement
// requires the token endpoint to reject joins when locked — wired in a later pass.
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
