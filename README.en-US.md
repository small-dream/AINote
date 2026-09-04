# AINote

[![Release](https://img.shields.io/github/v/release/small-dream/AINote?label=release&logo=github)](https://github.com/small-dream/AINote/releases/latest)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-2563EB)](https://github.com/small-dream/AINote/releases/latest)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-FFC131)](https://v2.tauri.app/)

[简体中文](README.md) · **English**

AINote is a cross-platform Markdown notes app for developers and knowledge workers. It uses a Git repository as its notes database: notes remain ordinary `.md` files, synchronization uses the Git protocol, history is preserved natively, and there is no proprietary format or server lock-in.

## Why AINote

- **Data ownership**: Notes live in your own GitHub repository, so they are portable, auditable, backup-friendly, and versioned.
- **Offline-first**: Browsing, searching, editing, and local commits work without a network. Push and pull when you reconnect.
- **Local-first AI**: Use OpenAI-compatible APIs or local Ollama. Providers and models are pluggable, and API keys are stored encrypted.
- **Native performance**: A React frontend connects to a Rust/Tauri backend; Git, file, and network work run outside the UI layer.

## Features

- **Markdown editing**: CodeMirror soft rendering provides a Typora-style WYSIWYG experience while saving source Markdown losslessly.
- **Rich-text notes**: An optional `.ainote` note type is powered by TipTap and supports tables, images, task lists, slash commands, and Markdown conversion.
- **GitHub sync**: Bind an existing or new repository through OAuth Device Flow or a PAT, then commit, push, and pull with one action.
- **Conflict resolution**: Resolve conflicts with a three-pane view showing local, merged, and remote content.
- **Version history**: Inspect per-note commit history and diffs, then restore a selected version.
- **Knowledge network**: Use `[[wiki links]]`, backlinks, `#tags`, full-text search, and a command palette.
- **Asset management**: Drop images or attachments into the repository `assets/` directory and insert portable references automatically.
- **Import and export**: Import Markdown files and export notes with A4 print/PDF layout.
- **Multi-repository support and themes**: Manage multiple repositories, choose light/dark/system appearance, use eight reading themes, and customize typography.
- **App localization**: Switch the interface between Simplified Chinese and English.

## Download

Choose your platform from [GitHub Releases](https://github.com/small-dream/AINote/releases/latest):

| Platform | Recommended package |
|---|---|
| macOS (Apple Silicon) | `.dmg` |
| Windows | `.msi` or `.exe` |
| Linux | `.AppImage`, `.deb`, or `.rpm` |

The current packages are not Apple-notarized or Windows code-signed:

- **macOS**: If macOS reports that the app is damaged, move `AINote.app` to `/Applications` and run `xattr -cr /Applications/AINote.app`.
- **Windows**: SmartScreen may appear on first launch. Verify that the installer came from the official project Release page.

The app includes a signature-checked auto-updater. You can also check manually from **Settings → Software Updates**.

> AINote is evolving quickly. Even though notes are stored in a standard Git repository, push to your remote or create a local backup before upgrading.

## Development

### Prerequisites

- Node.js 22
- pnpm 10.33.0
- Rust stable
- [Platform dependencies](https://v2.tauri.app/start/prerequisites/) for Tauri 2

### Run and build

```bash
git clone https://github.com/small-dream/AINote.git
cd AINote
pnpm install

# Development mode: Vite hot reload plus incremental Rust compilation
pnpm desktop:run

# Build a Release executable without producing an installer
pnpm desktop:build

# Produce an installer for the current platform
pnpm desktop:bundle
```

### Quality checks

```bash
pnpm build
pnpm test
pnpm lint
cargo test --manifest-path src-tauri/Cargo.toml
```

End-to-end tests are available with `pnpm test:e2e`.

## Architecture

AINote uses a one-way layered architecture:

```text
View → Hooks/Queries → api/ → IPC → commands → services → repositories → domain
```

- Frontend: React 19, TypeScript strict mode, Vite, Tailwind CSS, TanStack Query, and Zustand.
- Desktop layer: Tauri 2, Rust, `git2`, and AES-GCM encrypted storage.
- Editors: CodeMirror 6 for Markdown and TipTap for rich text.
- Data: The local Git repository is the authoritative data source; Git, not a private cloud API, is the synchronization protocol.

For more details, see the [architecture guide](docs/ARCHITECTURE.md), [product requirements](docs/PRD.md), [coding standards](docs/CODING_STANDARDS.md), and [changelog](docs/CHANGELOG.md).

## Contributing

Issues and pull requests are welcome. Please read the related documentation first and preserve the existing architectural boundaries:

1. Fork the repository on GitHub, or create a working branch.
2. Update the relevant living document in `docs/` before changing requirements or architecture.
3. Add tests for core logic alongside your implementation.
4. Ensure all quality checks above pass.
5. Use commit messages in `type(scope): summary` format, such as `feat(note): add tag suggestions`.

## Security

- GitHub tokens and AI provider API keys are never written to disk in plaintext and are not readable as plaintext by the frontend.
- Markdown rendering does not parse raw HTML by default, reducing XSS risk.
- Do not expose tokens, API keys, or private note data in issues, screenshots, or commits.

To report a security vulnerability, please use GitHub [private vulnerability reporting](https://github.com/small-dream/AINote/security/advisories/new) instead of opening a public issue.

## License

AINote is released under the [MIT License](LICENSE).
