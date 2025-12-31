package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

func inspect(url string) {
	fmt.Printf("Inspecting %s...\n", url)
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		fmt.Printf("Error creating request: %v\n", err)
		return
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Error fetching: %v\n", err)
		return
	}
	defer resp.Body.Close()

	fmt.Printf("Status: %s\n", resp.Status)
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading body: %v\n", err)
		return
	}

    // Save to file for inspection
    filename := strings.ReplaceAll(url, "https://www.", "")
    filename = strings.ReplaceAll(filename, "https://", "")
    filename = strings.ReplaceAll(filename, "/", "_") + ".html"
    
    os.WriteFile(filename, body, 0644)
    fmt.Println("Saved to", filename)
    
    // Write using os (need to import os)
    // For brevity in this tool call, I'm assuming 'os' is imported or I'll fix imports.
    // Actually, I'll just use MultiReplace to rewrite the file correctly with imports.

	content := string(body)
	fmt.Printf("Body Length: %d bytes\n", len(content))

    if strings.Contains(url, "casatramway") {
        os.WriteFile("tram.html", body, 0644)
        fmt.Println("Saved to tram.html")
    }

	// Simple checks
	if strings.Contains(content, "Ligne") {
		fmt.Println("Found 'Ligne' references.")
		// extract a snippet
		idx := strings.Index(content, "Ligne")
		end := idx + 200
		if end > len(content) {
			end = len(content)
		}
		fmt.Printf("Snippet: %s\n", content[idx:end])
	} else {
		fmt.Println("No 'Ligne' found (might be JS rendered).")
	}
}

func main() {
	inspect("https://www.casatramway.ma/se-deplacer/lignes-et-horaires")
	fmt.Println("------------------------------------------------")
	inspect("https://www.casabus.ma/")
    fmt.Println("------------------------------------------------")
    inspect("https://www.casatramway.ma/horaires/horaires-de-services/ligne-tram-t1")
    fmt.Println("------------------------------------------------")
    inspect("https://www.casatramway.ma/pthv/get?line=T1")
}
