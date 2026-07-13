package mlb

import "testing"

func sampleFeed() *LiveFeed {
	f := &LiveFeed{}
	mk := func(desc string, inn int, ev, la, dist float64) PlayEvent {
		p := PlayEvent{}
		p.Result.Description = desc
		p.About.Inning = inn
		p.PlayEvents = []PlayEventDetail{
			{IsPitch: true},
			{HitData: &HitData{LaunchSpeed: ev, LaunchAngle: la, TotalDistance: dist}},
		}
		return p
	}
	noHit := PlayEvent{}
	noHit.Result.Description = "Walk"
	noHit.PlayEvents = []PlayEventDetail{{IsPitch: true}}
	f.LiveData.Plays.AllPlays = []PlayEvent{
		mk("Judge homers", 3, 118.2, 29, 451),
		mk("Soto grounds out", 4, 92.1, -5, 12),
		noHit,
	}
	return f
}

func TestBattedBalls(t *testing.T) {
	balls := BattedBalls(sampleFeed())
	if len(balls) != 2 {
		t.Fatalf("got %d balls, want 2", len(balls))
	}
	if balls[0].EV != 118.2 || balls[0].Distance != 451 {
		t.Fatalf("unexpected first ball: %+v", balls[0])
	}
}

func TestHardestAndLongest(t *testing.T) {
	balls := BattedBalls(sampleFeed())
	if h := HardestHit(balls); h == nil || h.EV != 118.2 {
		t.Fatalf("hardest = %+v", h)
	}
	if l := Longest(balls); l == nil || l.Distance != 451 {
		t.Fatalf("longest = %+v", l)
	}
	if HardestHit(nil) != nil || Longest(nil) != nil {
		t.Fatalf("nil input should give nil")
	}
}
