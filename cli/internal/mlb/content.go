package mlb

import (
	"fmt"
	"strings"
)

// Playback is one video rendition of a highlight clip.
type Playback struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

// Highlight is a single video clip from a game's content feed.
type Highlight struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Duration    string     `json:"duration"` // "HH:MM:SS"
	Playbacks   []Playback `json:"playbacks"`
}

// VideoURL returns the browser-playable mp4 URL for the clip, or "" if none.
func (h Highlight) VideoURL() string {
	for _, p := range h.Playbacks {
		if p.Name == "mp4Avc" && p.URL != "" {
			return p.URL
		}
	}
	for _, p := range h.Playbacks {
		if strings.HasSuffix(p.URL, ".mp4") {
			return p.URL
		}
	}
	return ""
}

// DurationSeconds parses the "HH:MM:SS" duration into whole seconds.
func (h Highlight) DurationSeconds() int {
	var hh, mm, ss int
	if _, err := fmt.Sscanf(h.Duration, "%d:%d:%d", &hh, &mm, &ss); err != nil {
		return 0
	}
	return hh*3600 + mm*60 + ss
}

// Recap is the written game recap.
type Recap struct {
	Headline string `json:"headline"`
	Body     string `json:"body"`
}

// GameContent is the normalized view of /game/{pk}/content.
type GameContent struct {
	Highlights []Highlight
	Recap      *Recap
}
