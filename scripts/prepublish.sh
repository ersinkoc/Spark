#!/bin/bash

# Pre-publish validation script for @oxog/spark
# Ensures everything is perfect before npm publish

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Running pre-publish validation for @oxog/spark...${NC}\n"

# Function to check command status
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
    else
        echo -e "${RED}❌ $1 failed${NC}"
        exit 1
    fi
}

# 1. Code quality checks
echo -e "${YELLOW}Running code quality checks...${NC}"
npm run lint
check_status "Linting"

npm run format:check
check_status "Code formatting"

# 2. Run all tests
echo -e "\n${YELLOW}Running test suite...${NC}"
npm test
check_status "Unit tests"

npm run test:coverage
check_status "Code coverage"

npm run test:integration
check_status "Integration tests"

npm run test:security
check_status "Security tests"

# 3. Build the project
echo -e "\n${YELLOW}Building project...${NC}"
npm run build
check_status "Build"

npm run validate:build
check_status "Build validation"

# 4. Documentation validation
echo -e "\n${YELLOW}Validating documentation...${NC}"
npm run docs:validate
check_status "Documentation validation"

npm run docs:build
check_status "Documentation build"

# 5. Example validation
echo -e "\n${YELLOW}Testing examples...${NC}"
npm run examples:test
check_status "Examples"

# 6. Performance benchmarks
echo -e "\n${YELLOW}Running benchmarks...${NC}"
npm run benchmark
check_status "Performance benchmarks"

# 7. Package validation
echo -e "\n${YELLOW}Validating package...${NC}"
npm pack --dry-run
check_status "Package structure"

npm run validate:package
check_status "Package validation"

# 8. Run final validation
echo -e "\n${YELLOW}Running final validation...${NC}"
node scripts/final-validation.js
check_status "Final validation"

# Success!
echo -e "\n${GREEN}✅ All checks passed! Ready to publish.${NC}"
echo -e "${BLUE}📦 Run 'npm publish --access public' to publish @oxog/spark${NC}\n"