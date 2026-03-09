# Editor Behavior Specification

This document defines the behavior and logic of the Design Editor.

This file describes interactions between:

UI components  
Fabric canvas  
Layer system  
Template system  

---

# Editor Initialization

When the editor page loads:

1. Load template from

src/templates/templates.js

2. Load front side template by default.

3. Render SVG shirt template.

4. Mount Fabric canvas inside the printArea.

---

# Surface Switching

The editor supports two surfaces:

Front side  
Back side  

Behavior:

When switching surface:

1. Serialize current canvas using:

canvas.toJSON()

2. Save JSON to surfaceData state.

3. Load the next surface JSON using:

canvas.loadFromJSON()

4. Render the canvas.

---

# Object Creation

Objects can be created using tools:

Upload  
Add Text  
Library  
Graphics  

Each created object must:

1. Be added to Fabric canvas
2. Be registered as a layer
3. Be selected automatically

---

# Layer System

Each Fabric object corresponds to a layer.

Layer list must update when:

object:added  
object:removed  
object:modified  

Layer properties:

id  
type  
name  
thumbnail  

---

# Layer Reordering

Layers must support drag-and-drop reordering.

When layer order changes:

1. Update layer list order.
2. Update Fabric object z-index.

Use Fabric method:

object.moveTo(index)

3. Call:

canvas.renderAll()

---

# Layer Selection

Clicking a layer must:

1. Select the corresponding Fabric object
2. Highlight the object on canvas

Use:

canvas.setActiveObject(object)

---

# Layer Deletion

Deleting a layer must:

1. Remove the Fabric object
2. Remove layer entry
3. Update canvas

Use:

canvas.remove(object)

---

# Object Constraints

All objects must stay inside the printArea.

Listen to Fabric events:

object:moving  
object:scaling  

If object exceeds the printArea boundary:

Adjust object position.

---

# Alignment Tools

Alignment tools align objects relative to the printArea.

Supported alignment:

Align Left  
Align Right  
Align Top  
Align Bottom  
Align Center Horizontal  
Align Center Vertical  

---

# Undo / Redo

Undo and redo must track these events:

Add object  
Delete object  
Move object  
Scale object  
Rotate object  

Use history stack.

Example:

undoStack  
redoStack  

---

# Auto Save

Canvas state must be auto saved.

Listen to:

object:added  
object:modified  
object:removed  

Debounce save operation by:

1000 ms

Save using:

canvas.toJSON()

Store result in:

surfaceData state

---

# Canvas Zoom

Zoom controls affect the entire canvas viewport.

Zoom range:

0.5x → 3x

Use Fabric:

canvas.setZoom()

---

# Canvas Pan

Hand tool allows moving the viewport.

When active:

Disable object selection.

Use Fabric viewportTransform.

---

# Save Product

Save product button must collect:

templateId  
shirtColor  
frontCanvasJson  
backCanvasJson  

Prepare this data for backend API.

---

# Implementation Constraints

Use:

React  
Fabric.js v7  

Architecture must follow:

EditorLayout  
LeftToolbar  
CenterWorkspace  
RightPanel  
TopToolbar  
BottomToolbar  

Canvas logic must stay inside:

CanvasWorkspace.jsx

Layer logic must stay inside:

RightPanel.jsx

State must be stored in:

EditorContext.jsx