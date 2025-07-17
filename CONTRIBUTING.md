# Contributing to @oxog/spark

Thank you for your interest in contributing to @oxog/spark! This guide will help you get started with contributing to our zero-dependency Node.js framework.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Style Guidelines](#style-guidelines)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/spark.git
   cd spark
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/oxog-dev/spark.git
   ```

## Development Setup

Since @oxog/spark has zero dependencies, setup is straightforward:

1. Ensure you have Node.js >= 14.0.0 installed
2. Clone the repository
3. Run the tests to ensure everything works:
   ```bash
   npm test
   ```

## Making Changes

1. Create a new branch for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our guidelines:
   - Keep the zero-dependency philosophy
   - Write clean, documented code
   - Add tests for new functionality
   - Update documentation as needed

3. Commit your changes with clear messages:
   ```bash
   git commit -m "feat: add new feature"
   git commit -m "fix: resolve issue with routing"
   git commit -m "docs: update API documentation"
   ```

### Commit Message Format

We follow the Conventional Commits specification:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `test:` Test additions or modifications
- `chore:` Build process or auxiliary tool changes

## Testing

All contributions must include appropriate tests:

1. **Unit Tests**: Test individual components
   ```bash
   npm run test:unit
   ```

2. **Integration Tests**: Test component interactions
   ```bash
   npm run test:integration
   ```

3. **Performance Tests**: Ensure no performance regressions
   ```bash
   npm run test:performance
   ```

4. **Security Tests**: Validate security measures
   ```bash
   npm run test:security
   ```

5. **Coverage**: Maintain 100% code coverage
   ```bash
   npm run test:coverage
   ```

### Running All Tests

```bash
npm test
npm run validate:all
```

## Submitting Changes

1. Push your changes to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Create a Pull Request (PR) on GitHub

3. Ensure your PR:
   - Has a clear title and description
   - References any related issues
   - Passes all CI checks
   - Includes tests and documentation
   - Maintains zero dependencies

4. Address review feedback promptly

## Style Guidelines

### JavaScript Style

- Use ES6+ features where appropriate
- Follow existing code patterns
- Use meaningful variable and function names
- Add JSDoc comments for all public APIs
- Keep functions small and focused

### File Structure

```
src/
  core/          # Core framework components
  middleware/    # Built-in middleware
  router/        # Routing system
  utils/         # Utility functions
tests/
  unit/          # Unit tests
  integration/   # Integration tests
  performance/   # Performance tests
  security/      # Security tests
examples/        # Example applications
docs/            # Documentation
```

### Zero Dependencies

The most important rule: **NO runtime dependencies**

- Implement functionality from scratch
- Keep the codebase lean and efficient
- If you need external functionality, consider if it's truly necessary
- DevDependencies are allowed for development tools

## Reporting Issues

When reporting issues, please include:

1. **Clear title**: Summarize the issue concisely
2. **Description**: Detailed explanation of the problem
3. **Steps to reproduce**: How to recreate the issue
4. **Expected behavior**: What should happen
5. **Actual behavior**: What actually happens
6. **Environment**: Node.js version, OS, etc.
7. **Code samples**: Minimal reproduction code

### Security Issues

For security vulnerabilities, please email security@oxog.dev directly instead of creating a public issue.

## Development Workflow

1. **Stay updated**: Regularly sync with upstream
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Run validation**: Before submitting
   ```bash
   npm run validate:all
   ```

3. **Check examples**: Ensure examples still work
   ```bash
   npm run examples:test
   ```

4. **Benchmark**: Check performance impact
   ```bash
   npm run benchmark
   ```

## Release Process

Maintainers follow this process for releases:

1. Run full validation suite
2. Update CHANGELOG.md
3. Bump version in package.json
4. Create git tag
5. Publish to npm

## Questions?

- Check existing issues and PRs
- Review the documentation
- Ask in discussions
- Contact maintainers

Thank you for contributing to @oxog/spark! Your efforts help keep the web fast and dependency-free.