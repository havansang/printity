# System Architecture

The project is a web based product design editor.

The system contains two main parts:

Frontend:
- Canvas based design editor
- Product template selection
- Layer management

Backend:
- User authentication
- Project storage
- Asset storage

---

## Frontend Architecture

Main modules:

editor
Handles the Fabric.js canvas editor.

layout
Contains UI layout components such as toolbar, canvas workspace, and layer panel.

components
Reusable UI components.

pages
Application routes.

---

## Editor Layout

EditorLayout

TopBar  
LeftToolbar  
CanvasWorkspace  
RightPanel  

---

## Editor Data Flow

User action  
→ Canvas update  
→ Fabric event  
→ Update layers  
→ Auto save JSON  

---

## Surfaces

Each product contains two surfaces:

Front  
Back  

Each surface stores a Fabric canvas JSON representation.
