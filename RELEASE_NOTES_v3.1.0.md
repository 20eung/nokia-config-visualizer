# Release Notes - v3.1.0 (Advanced BGP/OSPF Visualization & UI Polish)

We are excited to announce the release of **v3.1.0**! This update focuses on significantly enhancing the visualization of VPRN services, specifically for BGP and OSPF routing protocols, and improving the overall user interface polish.

## 🚀 New Features

### 🌟 Advanced VPRN Visualization
- **Integrated BGP/OSPF Display**: BGP and OSPF routing details are now intelligently visualized within the **Service Node** label, providing a consolidated view of the logical service topology.
- **BGP Detail Box**: Added a styled box to display:
    - **AS Number & Route Distinguisher (RD)**
    - **Router ID**
    - **Neighbor List** (with their respective AS numbers)
- **OSPF Detail Box**: Added visualization for:
    - **OSPF Areas**
    - **Associated Interfaces** (with type indications)
- **Deduplication**: Removed redundant AS and RD information from the main service summary to reduce clutter.

### 🎨 UI/UX Improvements
- **Cleaner Initial Screen**: Simplified the initial "No Configuration Loaded" message, removing specific references to "L2 VPN" to reflect the tool's unified capabilities (L2/L3/Base).
- **Red Styling for Protocols**: Applied distinct red styling to BGP and OSPF sections to match network diagram conventions and improve readability.

## 🐛 Bug Fixes
- Fixed an issue where duplicate variable declarations in the parser could cause build failures.
- Resolved redundancies in Service Labels where AS/RD information was displayed twice.

## 🛠 Technical Updates
- Updated `parserV3.ts` to support deeper extraction of BGP and OSPF configurations.
- Refactored `mermaidGeneratorV3.ts` to support the new embedded label layout for service nodes.

---

**Full Changelog**: https://github.com/20eung/mermaid-web/compare/v3.0.0...v3.1.0
