#!/bin/bash
# Create simple 1x1 red PNG for all required assets
RED_PNG="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

# Decode and create assets
echo "$RED_PNG" | base64 -d > icon.png
cp icon.png adaptive-icon.png
cp icon.png splash-icon.png
cp icon.png favicon.png

echo "Placeholder assets created successfully"
