#!/bin/bash
# Convert a Playwright .webm recording into a web-friendly .mp4 (H.264, faststart).
# Tutorials are silent, so audio is dropped (-an).
#   usage: ./to-mp4.sh <input.webm> <output.mp4>
set -e
in="$1"; out="$2"
[ -z "$in" ] || [ -z "$out" ] && { echo "usage: ./to-mp4.sh <input.webm> <output.mp4>"; exit 1; }
ffmpeg -y -i "$in" -c:v libx264 -crf 23 -preset veryfast -pix_fmt yuv420p -movflags +faststart -an "$out"
echo "wrote $out ($(ls -lh "$out" | awk '{print $5}'))"
