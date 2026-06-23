package mlb

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	BaseURLV1  = "https://statsapi.mlb.com/api/v1"
	BaseURLV11 = "https://statsapi.mlb.com/api/v1.1"
)

type Client struct {
	v1   string
	v11  string
	http *http.Client
}

func NewClient(v1, v11 string) *Client {
	return &Client{
		v1:  v1,
		v11: v11,
		http: &http.Client{Timeout: 15 * time.Second},
	}
}

func DefaultClient() *Client {
	return NewClient(BaseURLV1, BaseURLV11)
}

func (c *Client) get(url string, out interface{}) error {
	resp, err := c.http.Get(url)
	if err != nil {
		return fmt.Errorf("GET %s: %w", url, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("GET %s: status %d", url, resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, out)
}
