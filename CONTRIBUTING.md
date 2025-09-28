# 🤝 Contributing to Nexus AI

Thank you for your interest in contributing to Nexus AI! This guide will help you get started with contributing to the project.

## 🌟 Ways to Contribute

- 🐛 **Bug Reports**: Found a bug? Help us fix it!
- 💡 **Feature Requests**: Have an idea? We'd love to hear it!
- 📝 **Documentation**: Help improve our docs
- 🔧 **Code Contributions**: Submit patches and new features
- 🧪 **Testing**: Help test new features and releases
- 💬 **Community Support**: Help other users in discussions

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v16.0.0 or higher
- **git**: Any recent version
- **npm**: v7.0.0 or higher
- **Code Editor**: VS Code, Vim, or your preferred editor

### Development Setup

1. **Fork the Repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/nexusai.git
   cd nexusai
   ```

2. **Install Dependencies**
   ```bash
   # Install all dependencies (including dev dependencies)
   npm install
   ```

3. **Set Up Development Environment**
   ```bash
   # Create development configuration
   cp .env.example .env.development
   
   # Initialize development project
   mkdir dev-test
   cd dev-test
   node ../nexusai/bin/nexus-memory.js init --memory-only
   ```

4. **Verify Setup**
   ```bash
   # Run tests
   npm test
   
   # Run linting
   npm run lint
   
   # Check code formatting
   npm run format:check
   ```

### Development Workflow

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/bug-description
   ```

2. **Make Your Changes**
   - Write clean, readable code
   - Follow existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   # Run all tests
   npm test
   
   # Run specific test file
   npm test -- --grep "test description"
   
   # Run tests with coverage
   npm run test:coverage
   ```

4. **Commit Your Changes**
   ```bash
   # Add files
   git add .
   
   # Commit with descriptive message
   git commit -m "feat: add memory consolidation algorithm"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   # Then create a PR on GitHub
   ```

## 📋 Development Guidelines

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Check linting
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Check formatting
npm run format:check

# Format code
npm run format
```

### Code Standards

- **ES6+**: Use modern JavaScript features
- **Async/Await**: Prefer async/await over promises
- **Error Handling**: Always handle errors gracefully
- **JSDoc**: Document public APIs with JSDoc comments
- **Modular Code**: Keep functions small and focused

### Example Code Style

```javascript
/**
 * Consolidates memory by moving low-priority items to long-term storage
 * @param {Object} options - Consolidation options
 * @param {boolean} options.force - Force consolidation even if not due
 * @param {number} options.threshold - Override default threshold
 * @returns {Promise<Object>} Consolidation results
 */
async function consolidateMemory(options = {}) {
  try {
    const { force = false, threshold = this.consolidationThreshold } = options;
    
    // Implementation here
    
    return {
      success: true,
      itemsConsolidated: count,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Memory consolidation failed:', error);
    throw new Error(`Consolidation failed: ${error.message}`);
  }
}
```

### Commit Message Format

We follow the [Conventional Commits](https://conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(memory): add priority-based consolidation algorithm

fix(watcher): prevent recursive file tracking in .nexus directory

docs(readme): update installation instructions for Windows

test(analyzer): add unit tests for transcript pattern extraction
```

## 🧪 Testing

### Test Structure

```
tests/
├── unit/           # Unit tests for individual functions
├── integration/    # Integration tests for components
├── e2e/           # End-to-end tests
└── fixtures/      # Test data and mock files
```

### Writing Tests

We use Jest for testing:

```javascript
// tests/unit/memory/consolidator.test.js
const MemoryConsolidator = require('../../../nexusai/memory/memory-consolidator');

describe('MemoryConsolidator', () => {
  let consolidator;

  beforeEach(() => {
    consolidator = new MemoryConsolidator({
      projectRoot: '/tmp/test',
      maxWorkingSetSize: 10
    });
  });

  describe('consolidateMemory', () => {
    it('should consolidate low-priority memories', async () => {
      // Setup test data
      await consolidator.addMemory('test1', 'content1', { priority: 0.1 });
      await consolidator.addMemory('test2', 'content2', { priority: 0.9 });

      // Execute
      const result = await consolidator.consolidate();

      // Assert
      expect(result.itemsConsolidated).toBeGreaterThan(0);
      expect(consolidator.workingSet.has('test2')).toBe(true);
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/unit/memory/consolidator.test.js

# Run tests in watch mode
npm run test:watch

# Run integration tests only
npm run test:integration
```

## 📚 Documentation

### Documentation Standards

- **Clear Examples**: Provide working code examples
- **Complete Coverage**: Document all public APIs
- **User-Focused**: Write from the user's perspective
- **Up-to-Date**: Keep docs synchronized with code changes

### Documentation Types

1. **README**: Project overview and quick start
2. **API Docs**: Complete function/class documentation
3. **Guides**: Step-by-step tutorials
4. **Examples**: Working code samples

### Writing Documentation

```markdown
# Function Documentation Template

## `functionName(param1, param2)`

Brief description of what the function does.

### Parameters

- `param1` (string): Description of parameter
- `param2` (Object, optional): Configuration options
  - `option1` (boolean): Description of option

### Returns

Returns a Promise that resolves to an Object with:
- `success` (boolean): Whether operation succeeded
- `data` (any): Result data

### Example

\`\`\`javascript
const result = await functionName('value', {
  option1: true
});

console.log(result.data);
\`\`\`

### Throws

- `Error`: If parameter validation fails
```

## 🐛 Bug Reports

### Before Reporting

1. **Search Existing Issues**: Check if the bug is already reported
2. **Update to Latest**: Ensure you're using the latest version
3. **Minimal Reproduction**: Create a minimal test case

### Bug Report Template

```markdown
**Describe the Bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected Behavior**
What you expected to happen.

**Actual Behavior**
What actually happened.

**Environment**
- OS: [e.g. Ubuntu 20.04, macOS 12.0, Windows 10]
- Node.js Version: [e.g. 16.14.0]
- Nexus AI Version: [e.g. 1.0.0]

**Additional Context**
- Error logs
- Screenshots
- Configuration files
```

## 💡 Feature Requests

### Feature Request Template

```markdown
**Feature Description**
A clear description of the feature you'd like to see.

**Use Case**
Describe the problem this feature would solve or the workflow it would improve.

**Proposed Solution**
How you envision this feature working.

**Alternatives Considered**
Other solutions you've considered.

**Additional Context**
Any other context, mockups, or examples.
```

## 🔄 Pull Request Process

### PR Checklist

Before submitting a PR, ensure:

- [ ] Code follows project style guidelines
- [ ] All tests pass
- [ ] New tests added for new functionality
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] PR description explains changes clearly

### PR Template

```markdown
**Description**
Brief description of changes made.

**Type of Change**
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

**Testing**
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

**Checklist**
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Code is commented where necessary
- [ ] Documentation updated
- [ ] No merge conflicts
```

### Review Process

1. **Automated Checks**: CI/CD runs tests and linting
2. **Code Review**: Maintainers review the code
3. **Feedback**: Address any requested changes
4. **Approval**: PR gets approved by maintainers
5. **Merge**: PR is merged into main branch

## 🎯 Development Priorities

### High Priority

- 🔬 **Enhanced Pattern Recognition**: Improve AI conversation analysis
- 🚀 **Performance Optimization**: Reduce memory usage and improve speed
- 🔒 **Security Hardening**: Implement additional security measures
- 🌐 **Cross-Platform Support**: Improve Windows and macOS compatibility

### Medium Priority

- 🔌 **IDE Integration**: VS Code, IntelliJ, and other editor plugins
- 📊 **Analytics Dashboard**: Web interface for memory visualization
- 🌐 **Cloud Sync**: Optional cloud backup and synchronization
- 📱 **Mobile Support**: React Native or web-based mobile interface

### Future Considerations

- 🤖 **AI Integration**: Direct integration with AI models
- 🔗 **API Gateway**: REST/GraphQL API for external integrations
- 📈 **Metrics & Monitoring**: Comprehensive system monitoring
- 🏗️ **Plugin System**: Extensible plugin architecture

## 🏷️ Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Workflow

1. **Feature Freeze**: Stop adding new features
2. **Testing**: Comprehensive testing of release candidate
3. **Documentation**: Update changelog and docs
4. **Tagging**: Create git tag with version
5. **Release**: Publish to npm and GitHub
6. **Announcement**: Notify community of release

## 📞 Communication

### Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and community chat
- **Discord**: Real-time chat (coming soon)
- **Email**: security@nexusai.dev (security issues only)

### Communication Guidelines

- **Be Respectful**: Treat everyone with respect
- **Be Constructive**: Focus on solutions, not problems
- **Be Patient**: Maintainers are volunteers
- **Be Clear**: Provide clear, detailed information

## 📄 License

By contributing to Nexus AI, you agree that your contributions will be licensed under the same license as the project (MIT License).

## 🙏 Recognition

Contributors are recognized in:
- **CONTRIBUTORS.md**: List of all contributors
- **Release Notes**: Major contributors mentioned
- **GitHub**: Contributor statistics and graphs

---

Thank you for contributing to Nexus AI! Together, we're building the future of AI memory systems. 🧠✨