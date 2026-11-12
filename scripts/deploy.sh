#!/usr/bin/env sh
# Publish the built app on the gh-pages branch (GitHub Pages serves it).
# VITE_GOATCOUNTER, when set, makes this copy count its own visits there.
set -e

npm run build
cd dist
touch .nojekyll
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy $(git -C .. rev-parse --short HEAD)"
git push -q -f "$(git -C .. remote get-url origin)" gh-pages
rm -rf .git
cd -
