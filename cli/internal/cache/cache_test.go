package cache_test

import (
	"testing"
	"time"

	"github.com/xavidop/diamond/cli/internal/cache"
)

func TestSetAndGet(t *testing.T) {
	c := cache.New()
	c.Set("key", "value", time.Minute)
	v, ok := c.Get("key")
	if !ok {
		t.Fatal("expected key to exist")
	}
	if v.(string) != "value" {
		t.Errorf("expected 'value', got %v", v)
	}
}

func TestExpiry(t *testing.T) {
	c := cache.New()
	c.Set("key", "value", time.Millisecond)
	time.Sleep(5 * time.Millisecond)
	_, ok := c.Get("key")
	if ok {
		t.Fatal("expected key to be expired")
	}
}

func TestMiss(t *testing.T) {
	c := cache.New()
	_, ok := c.Get("missing")
	if ok {
		t.Fatal("expected miss")
	}
}
