package mlb

import "testing"

func TestZoneGrid(t *testing.T) {
	zones := []Zone{
		{Zone: "01", Value: ".200", Temp: "cold"},
		{Zone: "5", Value: ".350", Temp: "hot"}, // unpadded
		{Zone: "11", Value: ".100", Temp: "cold"},
	}
	inner, outside := ZoneGrid(zones)
	if inner[0] == nil || inner[0].Value != ".200" {
		t.Fatalf("inner[0] = %+v", inner[0])
	}
	if inner[4] == nil || inner[4].Value != ".350" {
		t.Fatalf("inner[4] (unpadded 5) = %+v", inner[4])
	}
	if inner[1] != nil {
		t.Fatalf("inner[1] should be nil, got %+v", inner[1])
	}
	if outside[0] == nil || outside[0].Value != ".100" {
		t.Fatalf("outside[0] = %+v", outside[0])
	}
}
