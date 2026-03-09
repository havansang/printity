# Design Editor UI Specification

## Overview

This document describes the UI layout and behavior of the Design Editor page.

The editor allows users to design a T-shirt by adding text, images, and graphics inside a defined print area.

The editor UI is divided into five main regions:

- Top toolbar
- Left toolbar
- Center design workspace
- Right panel
- Bottom toolbar

The UI style should be **bright white / clean interface**.

---

# Layout Structure

The editor layout should follow this structure:

EditorLayout

TopToolbar  
LeftToolbar  
CenterWorkspace  
RightPanel  
BottomToolbar  

The layout uses a horizontal split:

LeftToolbar | CenterWorkspace | RightPanel

TopToolbar is fixed at the top.

BottomToolbar is fixed at the bottom.

---

# Top Toolbar

The top toolbar contains:

Undo button  
Redo button  

Buttons trigger Fabric.js undo / redo actions.

Layout example:

[ Undo ] [ Redo ]

---

# Left Toolbar

The left toolbar contains tools:

Upload  
Add Text  
Library  
Graphics  

Each tool opens a **popup panel next to the toolbar**.

---

## Upload Tool

When clicking Upload:

Show popup with:

Button:

My Device

Allows selecting files from computer.

Supported formats:

JPG  
PNG  
SVG  

File size limits:

JPG / PNG → maximum 100 MiB  
SVG → maximum 20 MiB

---

## Add Text Tool

When clicking Add Text:

Show popup with:

Search input for fonts

Font list

Users must select a font first before adding text to the design area.

After selecting font:

A textbox object is added to the canvas.

---

## Library Tool

Library shows uploaded assets.

Supported file types:

PNG  
JPG  
SVG

Each item should show a thumbnail.

Clicking an item adds the asset to the design canvas.

---

## Graphics Tool

Graphics panel contains shapes:

Star  
Heart  
Underline  
Triangle  
Circle  
Square  

Clicking a shape adds the object to the canvas.

---

# Center Workspace

The center workspace displays the shirt template and design area.

When the editor loads:

Load the template from:

src/templates/templates.js

The template includes:

SVG image  
printArea coordinates  

Example:
{
template: "tshirt",
front: {
svg: "/templates/tshirt-front.svg",
printArea: { x, y, width, height }
},
back: {
svg: "/templates/tshirt-back.svg",
printArea: { x, y, width, height }
}
}

The workspace contains two modes:

Front side  
Back side  

Buttons allow switching between front and back.

---

## Print Area

The print area defines the design region.

All objects must stay inside the print area.

Objects outside the print area should be automatically constrained.

---

# Right Panel

The right panel contains two sections:

1. Shirt color selection
2. Layer management

---

## Shirt Color Selection

Available colors:

White  
Silver  
Iron Grey  
Grey Concrete  
Black  
True Red  
Cardinal  
Maroon  
Neon Orange  
Gold  
Neon Yellow  
Lime Shock  
Olive Drab Green  
Kelly Green  
Atomic Blue  
True Royal  
True Navy  
Purple  
Neon Pink  

Changing the color updates the shirt template color.

---

# Layer Management

Each object added to the canvas becomes a layer.

Layer structure:

Thumbnail  
Layer name  
Delete button  
Drag handle  

Layers must support drag-and-drop reordering.

Changing order updates Fabric object z-index.

---

## Layer Accordion

Each layer is an accordion item.

Collapsed → default state

Expanded → editing controls visible

---

# Layer Controls

Controls depend on object type.

---

## Text Layer

Controls:

Rotate  
Position Left  
Position Top  

Alignment tools:

Align Left  
Align Right  
Align Top  
Align Bottom  
Align Center Horizontal  
Align Center Vertical  

Alignment should be relative to the printArea.

---

## Shape Layer

Controls:

Color  
Width  
Height  
Rotate  
Position Left  
Position Top  

Alignment tools same as text.

---

## Image Layer

Controls:

Width  
Height  
Rotate  
Scale  
Position Left  
Position Top  

Alignment tools same as text.

---

# Bottom Toolbar

Bottom toolbar contains:

Zoom Out  
Zoom Percentage  
Zoom In  

Hand Tool (Canvas Pan)

Hand tool allows moving the viewport.

Example tools:

Zoom slider  
Hand tool  

On the right side:

Save product button.

---

# Canvas Behavior

Canvas uses Fabric.js.

Requirements:

Objects can move, rotate, scale.

Objects must remain inside printArea.

Layer order controls object z-index.

Undo and redo must work for:

Add object  
Delete object  
Move object  
Scale object  

---

# Implementation Notes

Recommended tech stack:

React  
Fabric.js v7  

Component structure:

EditorLayout  
TopToolbar  
LeftToolbar  
CenterWorkspace  
RightPanel  
BottomToolbar  

State management:

EditorContext

Stores:

canvas instance  
layers  
active surface  
surface data  

---

# AI Implementation Instructions

When implementing this UI:

1. Follow the layout structure exactly.
2. Use React components.
3. Use Fabric.js for canvas rendering.
4. Maintain separation between UI and canvas logic.
5. Ensure modular code structure.

Do not implement backend logic here.

Only implement the frontend editor UI.