# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-14

### Added
- **Diagram Visualization**: Parses Nokia configuration files and visualizes network topology/interfaces.
- **Individual Download**: Supports downloading individual diagram cards as PNG (high-res) or SVG.
- **Custom UI**:
  - "Config Visualizer" title and branding.
  - Custom SVG Icons (Favicon & Header Logo) representing network topology.
  - Resizable sidebar and responsive layout.
- **Demo Mode**: Automatically loads demo config in beta environments.

### Changed
- **Toolbar Refactor**: Unified download buttons into card headers for better UX.
- **Icon Update**: Replaced default Vite icon with custom `cv.svg` (Config Visualizer) icon.
- **Performance**: Optimized rendering with `html-to-image` for robust PNG generation.

### Fixed
- **PNG Download**: Resolved issues with canvas tainting and low resolution by switching to `html-to-image`.
- **Build Errors**: Fixed unused variable typescript errors for production builds.
