package mlb

import "testing"

func TestHighlightVideoURL(t *testing.T) {
	h := Highlight{Playbacks: []Playback{
		{Name: "hlsCloud", URL: "x.m3u8"},
		{Name: "mp4Avc", URL: "good.mp4"},
	}}
	if got := h.VideoURL(); got != "good.mp4" {
		t.Fatalf("VideoURL = %q, want good.mp4", got)
	}

	h2 := Highlight{Playbacks: []Playback{{Name: "highBit", URL: "fallback.mp4"}}}
	if got := h2.VideoURL(); got != "fallback.mp4" {
		t.Fatalf("fallback VideoURL = %q, want fallback.mp4", got)
	}

	h3 := Highlight{Playbacks: []Playback{{Name: "hlsCloud", URL: "x.m3u8"}}}
	if got := h3.VideoURL(); got != "" {
		t.Fatalf("no-mp4 VideoURL = %q, want empty", got)
	}
}

func TestHighlightDurationSeconds(t *testing.T) {
	if got := (Highlight{Duration: "00:07:34"}).DurationSeconds(); got != 454 {
		t.Fatalf("DurationSeconds = %d, want 454", got)
	}
	if got := (Highlight{Duration: "bad"}).DurationSeconds(); got != 0 {
		t.Fatalf("bad duration = %d, want 0", got)
	}
}
