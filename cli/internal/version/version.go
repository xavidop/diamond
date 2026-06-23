// Package version holds build information, injected at release time via
// -ldflags by GoReleaser. It lives in its own low-level package so both the
// cmd layer (for --version) and the ui layer (to display it) can import it
// without an import cycle.
package version

var (
	Version = "dev"
	Commit  = "none"
	Date    = "unknown"
)

// Short returns a compact display label: "vX.Y.Z" for a release, or "dev".
func Short() string {
	if Version == "" || Version == "dev" {
		return "dev"
	}
	return "v" + Version
}
