#!/bin/bash

# AI Factory Scripts Verification Tool
# Final check after 10 rounds of optimization

echo "========================================="
echo "AI Factory Scripts Final Verification"
echo "========================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

errors=0
warnings=0

echo -e "\n[1/3] Syntax Check..."
for file in *.sh; do
  if [[ "$file" == "verify.sh" ]]; then continue; fi
  if bash -n "$file" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} $file - syntax OK"
  else
    echo -e "  ${RED}✗${NC} $file - syntax error"
    ((errors++))
  fi
done

echo -e "\n[2/3] ShellCheck Analysis..."
if command -v shellcheck >/dev/null 2>&1; then
  for file in main.sh prepare.sh executor.sh cleanup.sh config.sh utils.sh worktree-manager.sh; do
    if [[ ! -f "$file" ]]; then continue; fi

    # Check for errors
    if shellcheck -S error "$file" 2>/dev/null | grep -q "SC"; then
      echo -e "  ${RED}✗${NC} $file - has errors"
      ((errors++))
    else
      # Check for warnings
      if shellcheck -S warning "$file" 2>/dev/null | grep -q "SC"; then
        echo -e "  ${GREEN}⚠${NC} $file - has warnings"
        ((warnings++))
      else
        echo -e "  ${GREEN}✓${NC} $file - clean"
      fi
    fi
  done
else
  echo "  ShellCheck not installed, skipping..."
fi

echo -e "\n[3/3] Dependency Check..."
for file in main.sh prepare.sh executor.sh cleanup.sh worktree-manager.sh; do
  if [[ ! -f "$file" ]]; then continue; fi

  # Check if sourced files exist
  sources=$(grep "^source " "$file" 2>/dev/null | sed 's/source //' | tr -d '"')
  all_good=true
  for src in $sources; do
    # Evaluate the path
    src_path=$(eval echo "$src")
    if [[ ! -f "$src_path" ]]; then
      echo -e "  ${RED}✗${NC} $file - missing dependency: $src"
      all_good=false
      ((errors++))
    fi
  done
  if $all_good; then
    echo -e "  ${GREEN}✓${NC} $file - dependencies OK"
  fi
done

echo -e "\n========================================="
echo "Verification Results:"
echo "  Errors: $errors"
echo "  Warnings: $warnings"

if [[ $errors -eq 0 ]]; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Found $errors errors that need fixing${NC}"
  exit 1
fi