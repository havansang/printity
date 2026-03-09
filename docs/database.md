# Database Schema

Database: MongoDB

---

## Users

User accounts.

Fields:

_id  
email  
passwordHash  
createdAt  

---

## Projects

Stores user designs.

Fields:

_id  
userId  
name  
templateId  
frontCanvasJson  
backCanvasJson  
createdAt  
updatedAt  

---

## Templates

Product templates.

Fields:

_id  
name  
type (tshirt, polo)  
frontPrintArea  
backPrintArea  

---

## Assets

User uploaded images.

Fields:

_id  
userId  
url  
createdAt  
