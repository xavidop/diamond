package version

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const githubRepo = "xavidop/diamond"

type ghRelease struct {
	TagName string `json:"tag_name"`
}

// CheckLatest queries GitHub for the latest release tag and returns it
// (e.g. "1.2.3") or an empty string if unavailable.
func CheckLatest() string {
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", githubRepo))
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return ""
	}
	var rel ghRelease
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return ""
	}
	return strings.TrimPrefix(rel.TagName, "v")
}

// IsNewer returns true if latest represents a newer version than current.
// Both should be bare semver strings (no "v" prefix).
func IsNewer(current, latest string) bool {
	if current == "" || latest == "" || current == "dev" {
		return false
	}
	cp := parseSemver(current)
	lp := parseSemver(latest)
	if cp == nil || lp == nil {
		return false
	}
	for i := 0; i < 3; i++ {
		if lp[i] > cp[i] {
			return true
		}
		if lp[i] < cp[i] {
			return false
		}
	}
	return false
}

func parseSemver(s string) []int {
	s = strings.TrimPrefix(s, "v")
	parts := strings.SplitN(s, ".", 3)
	if len(parts) != 3 {
		return nil
	}
	nums := make([]int, 3)
	for i, p := range parts {
		// Strip pre-release suffix (e.g. "1-rc1")
		if idx := strings.IndexByte(p, '-'); idx >= 0 {
			p = p[:idx]
		}
		n := 0
		for _, c := range p {
			if c < '0' || c > '9' {
				return nil
			}
			n = n*10 + int(c-'0')
		}
		nums[i] = n
	}
	return nums
}
