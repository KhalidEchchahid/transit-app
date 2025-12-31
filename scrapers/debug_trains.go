package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

type OverpassResponse struct {
	Elements []Element `json:"elements"`
}

type Element struct {
	Type string            `json:"type"`
	ID   int64             `json:"id"`
	Tags map[string]string `json:"tags"`
}

func main() {
	query := `
		[out:json][timeout:60];
		(
		  relation["route"="train"](33.1,-7.9,33.9,-7.1);
		);
		out tags;
	`
	fmt.Println("Querying OSM for trains...")
	resp, err := http.PostForm("https://overpass-api.de/api/interpreter", url.Values{"data": {query}})
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("Error %d: %s\n", resp.StatusCode, body)
		return
	}

	var result OverpassResponse
	json.NewDecoder(resp.Body).Decode(&result)

	fmt.Printf("Found %d elements:\n", len(result.Elements))
	for _, el := range result.Elements {
		fmt.Printf("- %s (Ref: %s, Operator: %s)\n", el.Tags["name"], el.Tags["ref"], el.Tags["operator"])
	}
}
