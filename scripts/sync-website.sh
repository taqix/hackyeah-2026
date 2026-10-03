#!/bin/sh
# Copies the marketing site out of design/ into website/, the only folder Vercel deploys.
# design/website.html stays the source of truth; rerun this after editing it or design/system/.
set -eu
cd "$(dirname "$0")/.."
rm -rf website
mkdir -p website/system
sed 's/"website\.html"/"index.html"/' design/website.html > website/index.html
cp -R design/system/fonts design/system/tokens website/system/
cp design/system/styles.css design/system/components.js website/system/
touch website/.nojekyll  # serve files as-is on GitHub Pages
echo "website/ synced from design/"
