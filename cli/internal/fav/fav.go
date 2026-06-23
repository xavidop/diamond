// Package fav persists the user's favorite teams and players to a small JSON
// file in the OS config dir. Bubble Tea runs Update on a single goroutine, so
// the package-level store is safe to mutate without locking.
package fav

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
)

// Entry is a favorited team or player.
type Entry struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// Store holds the persisted favorites.
type Store struct {
	Teams   []Entry `json:"teams"`
	Players []Entry `json:"players"`
}

var store *Store

func path() string {
	dir, err := os.UserConfigDir()
	if err != nil || dir == "" {
		home, _ := os.UserHomeDir()
		dir = filepath.Join(home, ".config")
	}
	return filepath.Join(dir, "diamond", "favorites.json")
}

func get() *Store {
	if store != nil {
		return store
	}
	store = &Store{}
	if b, err := os.ReadFile(path()); err == nil {
		_ = json.Unmarshal(b, store)
	}
	return store
}

func save() {
	s := get()
	p := path()
	_ = os.MkdirAll(filepath.Dir(p), 0o755)
	if b, err := json.MarshalIndent(s, "", "  "); err == nil {
		_ = os.WriteFile(p, b, 0o644)
	}
}

func has(list []Entry, id int) bool {
	for _, e := range list {
		if e.ID == id {
			return true
		}
	}
	return false
}

func toggle(list []Entry, id int, name string) []Entry {
	for i, e := range list {
		if e.ID == id {
			return append(list[:i], list[i+1:]...)
		}
	}
	list = append(list, Entry{ID: id, Name: name})
	sort.Slice(list, func(i, j int) bool { return list[i].Name < list[j].Name })
	return list
}

// HasTeam / HasPlayer report whether an id is favorited.
func HasTeam(id int) bool   { return has(get().Teams, id) }
func HasPlayer(id int) bool { return has(get().Players, id) }

// ToggleTeam / TogglePlayer add or remove a favorite and persist.
func ToggleTeam(id int, name string) {
	s := get()
	s.Teams = toggle(s.Teams, id, name)
	save()
}
func TogglePlayer(id int, name string) {
	s := get()
	s.Players = toggle(s.Players, id, name)
	save()
}

// Teams / Players return the favorited entries (sorted by name).
func Teams() []Entry   { return get().Teams }
func Players() []Entry { return get().Players }

// Count returns the total number of favorites.
func Count() int { return len(get().Teams) + len(get().Players) }
