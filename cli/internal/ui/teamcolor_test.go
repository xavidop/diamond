package ui

import "testing"

func TestTeamColorsLoad(t *testing.T) {
	c := loadTeamColors()
	if len(c) < 30 {
		t.Fatalf("expected >=30 team colors, got %d", len(c))
	}
	if _, ok := c["147"]; !ok { // Yankees
		t.Fatal("expected color for team 147")
	}
}

func TestAdaptForBackgroundShiftsExtremes(t *testing.T) {
	// Pure black and white must move off the extremes so one of the two
	// backgrounds can always render them; mid-tones stay put.
	br, bg, bb := adaptForBackground(0, 0, 0)
	wr, wg, wb := adaptForBackground(255, 255, 255)
	if br == 0 && bg == 0 && bb == 0 && wr == 255 && wg == 255 && wb == 255 {
		t.Fatal("expected at least one extreme to be shifted for the current background")
	}
	// A mid-luminance gray (lum 130, between the dark floor and light ceiling)
	// passes through unchanged on either background.
	if r, g, b := adaptForBackground(130, 130, 130); r != 130 || g != 130 || b != 130 {
		t.Fatalf("mid-tone changed: got #%02x%02x%02x", r, g, b)
	}
}
