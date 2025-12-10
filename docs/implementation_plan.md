# Implementation Plan - Nokia Config Visualizer (Stage 1)

## Goal Description
Develop a web application that parses a single Nokia equipment configuration file and generates a network diagram using Mermaid.js. The diagram will visualize connections based on interface descriptions and selected ports.

## User Review Required
> [!IMPORTANT]
> - I will be using **Vite + React + TypeScript** for the web application to handle state management effectively for future stages.
> - I will assume standard **Nokia SR OS** configuration syntax (TiMOS).
> - I will create a **dummy config file** for testing since one hasn't been provided yet.

## Proposed Changes

### Project Structure (Vite + React)
- **Framework**: React with TypeScript
- **Styling**: Vanilla CSS (CSS Modules or Global CSS with variables for theming)
- **Visualization**: `mermaid` package

### Core Components

#### 1. Data Parser (`src/utils/nokiaParser.ts`)
- **Input**: Raw text content of the `.cfg` or `.txt` file.
- **Output**: Structured JSON object.
- **Logic**:
    - Identify `system name` for Hostname.
    - Parse `port` configurations (description, access/network mode).
    - Parse `router interface` configurations (address, port association, qos, service-id).
    - Extract "To-Device" information from descriptions (e.g., "To_RouterB").

#### 2. State Management
- `configData`: Parsed data store.
- `selectedInterfaces`: Set of IDs for interfaces selected by the user.

#### 3. UI Components
- **`Layout.tsx`**: Main container with sidebar (config/selection) and main area (diagram).
- **`FileUpload.tsx`**: Simple drag-and-drop or click-to-upload.
- **`InterfaceList.tsx`**: List of available interfaces with details for selection.
- **`DiagramViewer.tsx`**: Renders the Mermaid diagram.

### Diagram Logic
- **Nodes**:
    - Central Node: The parsed Device (Hostname).
    - Remote Nodes: Devices inferred from Interface/Port Descriptions.
- **Edges**:
    - Labeled with Port, IP, QoS, Service ID, etc.
   #### [NEW] [walkthrough.md](file:///Users/a04258/.gemini/antigravity/brain/666e0733-491c-4000-8551-ee87be43424e/walkthrough.md)

## Stage 1.5: Information Enhancements
- **Goal**: Enrich the diagram with detailed configuration data and fix hostname parsing.
- **Changes**:
    - `src/utils/nokiaParser.ts`:
        - Improve `system name` parsing robustness.
        - Parse `static-route` configuration.
        - Ensure `qos`, `service-id` are correctly extracted.
    - `src/utils/mermaidGenerator.ts`:
        - Update edge labels to display:
            - Port ID
            - Local IP / Remote IP (if inferable)
            - QoS
            - Service ID
            - Associated Static Routes

## Verification Plan
- **Automated**: Browser test with complex config containing static routes and check for correct labels.
- **Manual**: Verify "Unknown" hostname is resolved.
### Automated Tests
- Parse a known dummy config string and assert output JSON structure.

### Manual Verification
- Upload the dummy config.
- Select `interface A` and `interface B`.
- Verify the generated Mermaid graph matches the expected topology.
