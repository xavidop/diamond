package mlb

// BattedBall is one ball in play with its Statcast measurements.
type BattedBall struct {
	Result   string
	EV       float64
	Angle    float64
	Distance float64
	Inning   int
}

// BattedBalls extracts every ball-in-play (last hitData per play) from a feed.
func BattedBalls(feed *LiveFeed) []BattedBall {
	if feed == nil {
		return nil
	}
	var out []BattedBall
	for _, play := range feed.LiveData.Plays.AllPlays {
		var hit *HitData
		for i := range play.PlayEvents {
			if play.PlayEvents[i].HitData != nil {
				hit = play.PlayEvents[i].HitData
			}
		}
		if hit == nil {
			continue
		}
		out = append(out, BattedBall{
			Result:   play.Result.Description,
			EV:       hit.LaunchSpeed,
			Angle:    hit.LaunchAngle,
			Distance: hit.TotalDistance,
			Inning:   play.About.Inning,
		})
	}
	return out
}

// HardestHit returns the ball with the max exit velocity, or nil.
func HardestHit(balls []BattedBall) *BattedBall {
	var best *BattedBall
	for i := range balls {
		if best == nil || balls[i].EV > best.EV {
			best = &balls[i]
		}
	}
	return best
}

// Longest returns the ball with the max total distance, or nil.
func Longest(balls []BattedBall) *BattedBall {
	var best *BattedBall
	for i := range balls {
		if best == nil || balls[i].Distance > best.Distance {
			best = &balls[i]
		}
	}
	return best
}
