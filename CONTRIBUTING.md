# Contributing to Nexus AI Framework

Thank you for your interest in contributing to Nexus AI! We welcome contributions from the vibecoder community.

## 🎯 Our Mission

Nexus AI aims to solve the #1 problem in AI-assisted development: context loss and conversation retraining. We're building for developers who want to create with AI without losing work or context.

## 🤝 How to Contribute

### Reporting Issues
- Check existing issues first
- Use issue templates when available
- Provide clear reproduction steps
- Include system information

### Submitting Pull Requests
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Use ESLint and Prettier configurations
- Follow existing code patterns
- Add tests for new features
- Document new APIs

### Testing
```bash
npm test           # Run tests
npm run test:coverage  # Check coverage
```

### Areas We Need Help

#### 🧠 AI Model Hooks
- Conversation compression algorithms
- Context optimization strategies
- Memory management improvements

#### 📚 Knowledge Base
- New documentation sources
- Language-specific analyzers
- Framework integrations

#### 🔧 GitHub Analyzer
- Support for more languages
- Better pattern detection
- Performance optimizations

#### 🌐 Documentation Scraper
- Additional format support
- Better content extraction
- API documentation parsing

## 📋 Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/nexus-ai.git

# Install dependencies
cd nexus-ai
npm install

# Run in development mode
npm run dev

# Run tests
npm test
```

## 🏗️ Architecture Overview

```
nexus-ai/
├── core/               # Core systems
│   ├── ai-model-hooks.js    # Conversation management
│   ├── backup-system.js     # Data protection
│   └── hook-system.js       # Integration hooks
├── analyzers/          # Code analyzers
│   └── github-repo-analyzer.js
├── scrapers/           # Documentation scrapers
│   └── documentation-scraper.js
├── bin/               # CLI entry points
└── scripts/           # Utility scripts
```

## 🚀 Release Process

1. Update version in package.json
2. Update CHANGELOG.md
3. Create release PR
4. After merge, tag release
5. Publish to npm

## 📝 Commit Message Guidelines

Use conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Tests
- `chore:` Maintenance

## 🌟 Recognition

Contributors are recognized in:
- README.md contributors section
- GitHub contributors page
- Release notes

## 💬 Community

- GitHub Discussions for questions
- Issues for bugs and features
- Pull Requests for contributions

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You!

Every contribution matters. Whether it's code, documentation, or bug reports, you're helping millions of vibecoders build better with AI.

---

**Questions?** Open an issue or start a discussion!