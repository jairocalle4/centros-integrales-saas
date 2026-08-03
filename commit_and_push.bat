git add .
git diff --check --cached > diff.log 2>&1
git commit -m "chore: initial commit for Sprint 0"
git push -u origin main
