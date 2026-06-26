package livekit

import (
	"errors"
	"sync"

	"github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
)

// ErrNoActiveRecording is returned when stopping a room that isn't recording.
var ErrNoActiveRecording = errors.New("no active recording for room")

// Recorder starts/stops room-composite recordings via LiveKit Egress. Files are
// written by the Egress service to outDir (its mount), e.g. /out.
type Recorder struct {
	client *lksdk.EgressClient
	outDir string
	mu     sync.Mutex
	active map[string]string // room -> egressID
}

func NewRecorder(hostURL, apiKey, apiSecret, outDir string) *Recorder {
	return &Recorder{
		client: lksdk.NewEgressClient(hostURL, apiKey, apiSecret),
		outDir: outDir,
		active: make(map[string]string),
	}
}

func (r *Recorder) IsRecording(room string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	_, ok := r.active[room]
	return ok
}

func (r *Recorder) Start(room string) (string, error) {
	r.mu.Lock()
	_, exists := r.active[room]
	r.mu.Unlock()
	if exists {
		return "", errors.New("already recording")
	}

	ctx, cancel := timeoutCtx()
	defer cancel()
	info, err := r.client.StartRoomCompositeEgress(ctx, &livekit.RoomCompositeEgressRequest{
		RoomName: room,
		Layout:   "grid",
		FileOutputs: []*livekit.EncodedFileOutput{{
			FileType: livekit.EncodedFileType_MP4,
			Filepath: r.outDir + "/" + room + "-{time}.mp4",
		}},
	})
	if err != nil {
		return "", err
	}

	r.mu.Lock()
	r.active[room] = info.EgressId
	r.mu.Unlock()
	return info.EgressId, nil
}

func (r *Recorder) Stop(room string) error {
	r.mu.Lock()
	id := r.active[room]
	delete(r.active, room)
	r.mu.Unlock()
	if id == "" {
		return ErrNoActiveRecording
	}

	ctx, cancel := timeoutCtx()
	defer cancel()
	_, err := r.client.StopEgress(ctx, &livekit.StopEgressRequest{EgressId: id})
	return err
}
