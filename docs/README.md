# T-Shirt Design Editor

A web application that allows users to design T-shirts and Polo shirts by adding images, text, and graphics on predefined print areas.

The application provides a Fabric.js based canvas editor with layer management, auto save, and mockup preview.

---

## Features

- Select product template (T-Shirt / Polo)
- Canvas editor using Fabric.js
- Add text
- Upload images
- Layer management
- Multi surface design (Front / Back)
- Auto save draft
- Export preview mockup
- Save project

---

## Tech Stack

Frontend
- React
- Vite
- Fabric.js

Backend (planned)
- Node.js
- Express
- MongoDB

Infrastructure
- Docker
- Nginx

---



# 🚀 Hướng dẫn cài đặt & chạy dự án

## 1. Yêu cầu hệ thống

Trước khi bắt đầu, hãy đảm bảo bạn đã cài đặt:

* **Docker**
* **Docker Compose** (thường đi kèm Docker Desktop)

👉 Tải tại: https://www.docker.com/products/docker-desktop/

---

## 2. Clone source code

```bash
git clone https://github.com/havansang/printity.git
cd printity
---

## 3. Chạy dự án với Docker

Chạy lệnh sau để build và start tất cả services:

```bash
docker compose -f docker-compose.dev.yml up --build
```

📌 Lần đầu chạy sẽ mất vài phút để build image

---

## 4. Seed dữ liệu

Sau khi container chạy thành công, mở terminal mới và chạy:

### Seed templates

```bash
docker compose -f docker-compose.dev.yml exec backend npm run seed:templates
```

### Seed shapes

```bash
docker compose -f docker-compose.dev.yml exec backend npm run seed:shapes
```

---

## 5. Truy cập ứng dụng

* Frontend: http://localhost:5173
* Backend: http://localhost:5000

---

## 6. Một số lệnh hữu ích

### Dừng container

```bash
docker compose -f docker-compose.dev.yml down
```

 compose -f docker-compose.dev.yml logs -f
```

### Rebuild lại

```bash
docker compose -f docker-compose.dev.yml up --build
```

---

## ⚠️ Lưu ý

* Đảm bảo Docker đang chạy trước khi execute lệnh
* Nếu port bị trùng, hãy chỉnh trong file `docker-compose.dev.yml`
* Nếu gặp lỗi, thử:

```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up --build
```

---

## ✅ Hoàn tất

Sau khi seed xong, bạn có thể bắt đầu sử dụng hệ thống 🎉

