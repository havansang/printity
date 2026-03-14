# Backend Implementation Spec v2 - Garment Design Editor

## 1. Mục tiêu tài liệu

Tài liệu này là phiên bản nâng cấp của backend spec hiện tại để một coding agent có thể generate backend **rõ ràng hơn, ít suy đoán hơn, và bám sát nhu cầu sản phẩm thực tế**.

Phiên bản mới kế thừa các mục tiêu lõi của tài liệu gốc: backend phục vụ trực tiếp cho editor, tập trung vào xác thực người dùng, quản lý project thiết kế, upload asset, cung cấp template sản phẩm, autosave, và hạ tầng deploy bằng Docker. Đồng thời, bản này bổ sung 2 yêu cầu quan trọng:

1. **Đăng nhập bằng Google là bắt buộc ở phase 1**
2. **Hệ thống phải hỗ trợ nhiều loại áo, trước mắt là `tshirt` và `polo`, mỗi loại luôn có 2 mặt `front` và `back`, mỗi mặt có template riêng**

Mục tiêu của backend là lưu trữ và phục vụ dữ liệu cho một **garment design editor** dựa trên Fabric.js, trong đó mỗi project gắn với một sản phẩm cụ thể và được thiết kế trên nhiều surface.

---

## 2. Những gì giữ nguyên từ tài liệu gốc

Tài liệu gốc đã xác định khá tốt các phần nền tảng sau:

- Stack backend: **Node.js + Express + MongoDB + Mongoose**
- Frontend/editor stack liên quan: **React + Vite + Fabric.js 7**
- Cấu trúc module hợp lý: **auth**, **projects**, **assets**, **templates**
- Cách lưu editor state bằng **Fabric canvas JSON**
- Tư duy multi-surface: **front/back**
- Autosave là use case quan trọng
- Upload asset nên bắt đầu từ local storage
- Docker/Nginx là một phần của phase 1

Các điểm này vẫn hợp lý và nên được giữ lại. Spec mới chỉ chuẩn hóa lại domain model và bổ sung các yêu cầu còn thiếu. Tham chiếu từ bản gốc: backend hiện tập trung vào auth, projects, assets, templates; project lưu theo 2 surface front/back; template đang được xem là nguồn dữ liệu vùng in; và autosave là endpoint lõi của editor. fileciteturn0file0

---

## 3. Phân tích tài liệu cũ và các điểm cần nâng cấp

## 3.1 Điểm mạnh của tài liệu cũ

Tài liệu cũ đã mô tả khá đầy đủ:

- phạm vi backend phase 1
- data model cơ bản cho user, template, project, asset
- route map REST rõ ràng
- business rules quan trọng như ownership và autosave nhẹ
- infrastructure tối thiểu để agent generate code chạy được

Đây là nền tốt để coding agent triển khai nhanh. fileciteturn0file0

## 3.2 Điểm còn thiếu hoặc dễ gây generate sai

Tài liệu cũ vẫn có 5 khoảng trống đáng chú ý:

### A. Chưa có Google login

Bản gốc chỉ mô tả register/login bằng email + password + JWT, chưa có khái niệm auth provider hay Google identity. Nếu agent bám đúng bản cũ, backend sẽ không hỗ trợ Google login. fileciteturn0file0

### B. Template model còn quá đơn giản

Bản gốc dùng `frontPrintArea` và `backPrintArea` ở cấp root của template. Cách này dùng được cho 2 mặt, nhưng kém mở rộng khi cần:

- lưu ảnh template riêng cho từng mặt
- thêm metadata cho từng surface
- mở rộng về sau sang sleeve / collar / side

Vì vậy nên chuyển sang cấu trúc `surfaces.front` và `surfaces.back` ngay từ đầu. fileciteturn0file0

### C. Chưa tách rõ `productType` và `template`

Bản cũ có `type: tshirt | polo`, nhưng chưa mô tả rõ đây là loại sản phẩm hay chỉ là tag hiển thị. Để frontend và backend cùng hiểu giống nhau, cần quy ước rõ:

- `productType` là loại áo ở mức domain
- `template` là một biến thể thiết kế cụ thể thuộc loại áo đó

Ví dụ: cùng là `tshirt`, sau này có thể có nhiều template khác nhau.

### D. User model chưa sẵn sàng cho multi-provider auth

Bản cũ có `email` + `passwordHash`, phù hợp với local auth, nhưng chưa phù hợp nếu user đăng nhập bằng Google. Cần nâng cấp schema user để:

- cho phép user có provider `google`
- cho phép account local và Google cùng trỏ về một user
- tránh bắt buộc `passwordHash` với user chỉ dùng Google

### E. Chưa mô tả rõ dữ liệu template hình ảnh trước/sau

Người dùng đã xác nhận rằng mỗi loại áo cần có template trước và sau. Vì vậy backend không chỉ trả về print area, mà còn cần trả về **template image/base image/mask info** cho từng mặt.

---

## 4. Quyết định kiến trúc mới

## 4.1 Kiểu kiến trúc

Tiếp tục dùng **REST API theo module**.

Mỗi module tách rõ:

- route
- controller
- service
- model
- validation

## 4.2 Nguyên tắc tổ chức code

- Không dồn business logic vào route
- Mọi validation nằm riêng
- Mọi check ownership nằm ở service hoặc helper dùng chung
- Response format thống nhất
- Có middleware auth, validate, error handling
- Chỉ tin dữ liệu identity từ token hoặc Google token verification, không tin từ client body

## 4.3 API prefix

Sử dụng prefix thống nhất:

`/api/v1`

---

## 5. Phạm vi generate của backend phase 1

## 5.1 In scope

### 1. Authentication module

Bắt buộc hỗ trợ:

- local register
- local login
- Google login
- get current user
- logout stateless

### 2. Product templates module

Bắt buộc hỗ trợ:

- lấy danh sách template đang active
- filter theo `productType`
- lấy chi tiết một template
- seed dữ liệu mặc định cho `tshirt` và `polo`
- mỗi template phải có đủ `front` và `back`

### 3. Projects module

Bắt buộc hỗ trợ:

- tạo project mới
- lấy danh sách project của user
- lấy chi tiết một project
- update thủ công
- autosave
- xóa project
- duplicate project là optional nhưng khuyến nghị có

### 4. Assets module

Bắt buộc hỗ trợ:

- upload ảnh
- list assets của user
- delete asset

### 5. Infrastructure cơ bản

- Express app
- MongoDB connection
- Dockerfile
- docker-compose.yml
- .env.example
- Nginx reverse proxy cơ bản

## 5.2 Out of scope

Chưa cần ưu tiên ở phase 1:

- thanh toán
- admin portal phức tạp
- email verification
- forgot password
- refresh token rotation phức tạp
- realtime collaboration
- version history nâng cao
- queue/background processing
- server-side render mockup PNG hoàn chỉnh

## 5.3 Ghi chú về export PNG

Giữ nguyên tinh thần của bản cũ:

- **không bắt buộc** làm server-side PNG export ở phase 1
- chỉ cần chuẩn bị chỗ để lưu `previewImageUrl` hoặc `thumbnailUrl`

Điểm này phù hợp với định hướng trong tài liệu gốc: export PNG được nhắc đến nhưng chưa phải trọng tâm backend ở giai đoạn đầu. fileciteturn0file0

---

## 6. Stack backend đề xuất

## 6.1 Runtime và framework

- Node.js LTS
- Express.js

## 6.2 Database

- MongoDB
- Mongoose ODM

## 6.3 Authentication

- JWT access token cho backend session stateless
- bcrypt cho local password
- `google-auth-library` để verify Google ID token ở backend

## 6.4 Upload file

Phase 1:

- `multer`
- local storage tại `uploads/`

Thiết kế abstraction để về sau thay bằng:

- AWS S3
- Cloudinary
- MinIO

## 6.5 Package khuyến nghị

Runtime:

- express
- mongoose
- bcrypt
- jsonwebtoken
- multer
- cors
- helmet
- morgan
- dotenv
- zod
- google-auth-library
- cookie-parser (optional)
- uuid hoặc nanoid

Dev:

- nodemon
- eslint
- prettier

---

## 7. Cấu trúc thư mục đề xuất

```text
backend/
  src/
    app.js
    server.js

    config/
      env.js
      db.js
      google.js

    constants/
      auth.js
      product.js
      project.js

    middlewares/
      auth.middleware.js
      error.middleware.js
      not-found.middleware.js
      validate.middleware.js
      upload.middleware.js

    utils/
      ApiError.js
      asyncHandler.js
      response.js
      pagination.js
      file.js
      auth.js

    modules/
      auth/
        auth.routes.js
        auth.controller.js
        auth.service.js
        auth.validation.js
        auth.mapper.js

      users/
        user.model.js

      templates/
        template.model.js
        template.routes.js
        template.controller.js
        template.service.js
        template.validation.js
        template.seed.js

      projects/
        project.model.js
        project.routes.js
        project.controller.js
        project.service.js
        project.validation.js
        project.mapper.js

      assets/
        asset.model.js
        asset.routes.js
        asset.controller.js
        asset.service.js
        asset.validation.js

    routes/
      index.js

  uploads/
  scripts/
    seed-templates.js

  Dockerfile
  .env.example
  nginx.conf
  package.json
  README.md
```

---

## 8. Environment variables

Tạo `.env.example`:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://mongo:27017/garment_editor
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=10
GOOGLE_CLIENT_ID=your_google_web_client_id.apps.googleusercontent.com
PUBLIC_BASE_URL=http://localhost:5000
```

### Ghi chú

- `JWT_SECRET` bắt buộc phải có
- `GOOGLE_CLIENT_ID` bắt buộc nếu bật Google login
- `PUBLIC_BASE_URL` dùng để build absolute URL cho uploads nếu cần
- `CLIENT_URL` dùng cho CORS

---

## 9. Quy ước response API

## 9.1 Success response

```json
{
  "success": true,
  "message": "Project created successfully",
  "data": {
    "id": "..."
  }
}
```

## 9.2 Error response

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email"
    }
  ]
}
```

## 9.3 HTTP status code

- 200: success
- 201: created
- 400: bad request
- 401: unauthorized
- 403: forbidden
- 404: not found
- 409: conflict
- 422: validation error
- 500: internal server error

---

## 10. Domain model mới

## 10.1 Các enum chuẩn

### Auth providers

```js
['local', 'google']
```

### Product types

```js
['tshirt', 'polo']
```

### Surface keys

```js
['front', 'back']
```

### Project status

```js
['draft', 'completed']
```

---

## 11. Data model chi tiết

## 11.1 User model

### Mục đích

Lưu thông tin user và cho phép một tài khoản hỗ trợ nhiều provider.

### Fields

```js
{
  email: String,                    // unique, required, lowercase
  displayName: String,              // optional
  avatarUrl: String,                // optional

  authProviders: [String],          // enum: ['local', 'google']

  passwordHash: String,             // optional nếu user chỉ login Google

  google: {
    googleId: String,               // unique sparse
    email: String,
    emailVerified: Boolean,
    picture: String
  },

  lastLoginAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Rules

- `email` là khóa định danh chính theo business logic
- `passwordHash` **không bắt buộc** nếu user chỉ đăng nhập Google
- Nếu user có provider `local`, phải có `passwordHash`
- Nếu user có provider `google`, phải có `google.googleId`
- Một user có thể có cả `local` và `google`

### Index

- unique index cho `email`
- unique sparse index cho `google.googleId`

### Gợi ý flow linking account

- Nếu user login Google và `email` đã tồn tại ở DB, backend có thể link provider `google` vào cùng user đó
- Nếu muốn an toàn hơn, coding agent có thể chỉ auto-link khi email từ Google đã được verify

---

## 11.2 Template model

### Mục đích

Mô tả template của một sản phẩm may mặc. Mỗi template luôn gắn với một `productType` và có đầy đủ dữ liệu cho `front` và `back`.

### Fields

```js
{
  name: String,                     // ví dụ: "Basic T-shirt"
  slug: String,                     // ví dụ: "basic-tshirt"
  productType: String,              // enum: ['tshirt', 'polo']
  description: String,

  surfaces: {
    front: {
      label: String,                // "Front"
      templateImageUrl: String,     // ảnh nền/mockup dùng cho editor
      overlayImageUrl: String,      // optional
      maskImageUrl: String,         // optional
      printArea: {
        x: Number,
        y: Number,
        width: Number,
        height: Number
      }
    },
    back: {
      label: String,
      templateImageUrl: String,
      overlayImageUrl: String,
      maskImageUrl: String,
      printArea: {
        x: Number,
        y: Number,
        width: Number,
        height: Number
      }
    }
  },

  thumbnailUrl: String,             // optional
  isActive: Boolean,
  sortOrder: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### Rules

- `productType` bắt buộc và phải thuộc enum hợp lệ
- `surfaces.front` và `surfaces.back` bắt buộc tồn tại
- Mỗi surface bắt buộc có `templateImageUrl` và `printArea`
- `slug` nên unique để frontend có thể tham chiếu ổn định

### Vì sao đổi từ `frontPrintArea/backPrintArea` sang `surfaces`?

Vì yêu cầu hiện tại đã xác định **mỗi loại áo có template trước và sau**, nên lưu flat ở root sẽ thiếu chỗ để gắn ảnh template theo từng mặt. Cấu trúc `surfaces` giải quyết triệt để điều đó và vẫn tương thích tốt với editor nhiều mặt.

---

## 11.3 Project model

### Mục đích

Lưu một thiết kế cụ thể của user trên một template sản phẩm.

### Fields

```js
{
  userId: ObjectId,
  name: String,
  templateId: ObjectId,
  productType: String,              // denormalized từ template để query nhanh

  surfaces: {
    front: {
      canvasJson: Mixed,
      previewImageUrl: String
    },
    back: {
      canvasJson: Mixed,
      previewImageUrl: String
    }
  },

  thumbnailUrl: String,
  status: String,                   // enum: ['draft', 'completed']
  lastOpenedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Rules

- `userId`, `templateId`, `name` bắt buộc
- `productType` nên lưu denormalized để filter project nhanh hơn
- `surfaces.front` và `surfaces.back` nên luôn có structure ổn định
- `canvasJson` dùng `Schema.Types.Mixed`

### Tương thích ngược

Backend vẫn phải chấp nhận payload cũ:

```json
{
  "frontCanvasJson": {...},
  "backCanvasJson": {...}
}
```

và map sang:

```json
{
  "surfaces": {
    "front": { "canvasJson": {...} },
    "back": { "canvasJson": {...} }
  }
}
```

Điều này giữ đúng tinh thần của bản gốc vốn đã yêu cầu hỗ trợ payload cũ. fileciteturn0file0

### Index

- `{ userId: 1, updatedAt: -1 }`
- `{ userId: 1, productType: 1, updatedAt: -1 }`
- optional: text index cho `name`

---

## 11.4 Asset model

### Mục đích

Lưu metadata của ảnh người dùng upload để dùng trong editor.

### Fields

```js
{
  userId: ObjectId,
  originalName: String,
  mimeType: String,
  size: Number,
  storageType: String,              // 'local'
  path: String,
  url: String,
  width: Number,
  height: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### Rules

- chỉ owner được đọc/xóa asset của mình
- chỉ cho phép image mime types
- `url` là public URL để frontend load trực tiếp

---

## 12. Quan hệ dữ liệu

- Một `User` có nhiều `Projects`
- Một `User` có nhiều `Assets`
- Một `Project` thuộc về một `User`
- Một `Project` dùng một `Template`
- Một `Template` thuộc một `productType`

Không cần embed toàn bộ template vào project trong phase 1. Chỉ cần lưu `templateId` và denormalize thêm `productType`.

---

## 13. Auth module chi tiết

## 13.1 Mục tiêu

Cung cấp cả **local auth** và **Google login** với JWT stateless.

## 13.2 Auth strategy đề xuất

### Local auth

- register bằng email/password
- login bằng email/password

### Google auth

Frontend lấy **Google ID token** sau khi user đăng nhập Google, sau đó gửi token này lên backend.

Backend sẽ:

1. verify ID token bằng `google-auth-library`
2. đọc payload từ Google
3. tìm user theo `google.googleId` hoặc `email`
4. tạo mới user nếu chưa tồn tại
5. cập nhật provider `google` nếu user đã tồn tại
6. trả JWT của hệ thống backend

### Vì sao dùng ID token verification ở backend?

Vì cách này đơn giản hơn cho phase 1 so với full OAuth authorization code flow, nhưng vẫn đủ chuẩn để verify danh tính Google ở phía server.

---

## 13.3 API auth

### POST `/api/v1/auth/register`

#### Request body

```json
{
  "email": "user@example.com",
  "password": "secret123",
  "displayName": "John Doe"
}
```

#### Flow

1. validate input
2. kiểm tra email đã tồn tại chưa
3. hash password bằng bcrypt
4. tạo user với `authProviders = ['local']`
5. sinh JWT
6. trả user info + token

---

### POST `/api/v1/auth/login`

#### Request body

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

#### Flow

1. validate input
2. tìm user theo email
3. đảm bảo user có provider `local`
4. compare password
5. sinh JWT
6. cập nhật `lastLoginAt`
7. trả user + token

---

### POST `/api/v1/auth/google`

#### Request body

```json
{
  "idToken": "google_id_token_from_frontend"
}
```

#### Flow

1. validate `idToken`
2. verify với `GOOGLE_CLIENT_ID`
3. lấy payload từ Google
4. reject nếu email không có hoặc token invalid
5. tìm user theo `google.googleId`
6. nếu chưa có thì tìm tiếp theo `email`
7. nếu vẫn chưa có thì tạo user mới
8. nếu đã có user theo email nhưng chưa có provider `google`, link provider `google`
9. sinh JWT backend
10. trả user + token

#### Response

```json
{
  "success": true,
  "message": "Google login successful",
  "data": {
    "user": {
      "id": "...",
      "email": "user@example.com",
      "displayName": "John Doe",
      "avatarUrl": "https://...",
      "authProviders": ["google"]
    },
    "token": "jwt_token"
  }
}
```

---

### GET `/api/v1/auth/me`

Header:

`Authorization: Bearer <token>`

Trả user profile hiện tại.

---

### POST `/api/v1/auth/logout`

Vì hệ thống dùng JWT stateless, endpoint này chỉ cần trả thành công để frontend xóa token local.

---

## 13.4 JWT payload tối thiểu

```js
{
  userId: string,
  email: string,
  authProviders: string[]
}
```

## 13.5 Auth middleware

Middleware `requireAuth` cần:

- đọc token từ header Authorization
- verify JWT
- attach `req.user`
- từ chối nếu token invalid

---

## 14. Templates module chi tiết

## 14.1 Mục tiêu

Cho frontend lấy đúng template sản phẩm để render editor cho từng loại áo và từng mặt.

## 14.2 API

### GET `/api/v1/templates`

#### Query params

- `productType` optional, ví dụ `tshirt` hoặc `polo`
- `activeOnly` optional, default `true`

#### Response mẫu

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "...",
        "name": "Basic T-shirt",
        "slug": "basic-tshirt",
        "productType": "tshirt",
        "thumbnailUrl": "/uploads/templates/basic-tshirt-thumb.png",
        "surfaces": {
          "front": {
            "templateImageUrl": "/uploads/templates/basic-tshirt-front.png",
            "printArea": { "x": 120, "y": 140, "width": 260, "height": 320 }
          },
          "back": {
            "templateImageUrl": "/uploads/templates/basic-tshirt-back.png",
            "printArea": { "x": 120, "y": 140, "width": 260, "height": 320 }
          }
        }
      }
    ]
  }
}
```

### GET `/api/v1/templates/:id`

Trả chi tiết một template.

## 14.3 Seed data mặc định

Phase 1 bắt buộc seed ít nhất 2 template:

### Template 1 - Basic T-shirt

```json
{
  "name": "Basic T-shirt",
  "slug": "basic-tshirt",
  "productType": "tshirt",
  "surfaces": {
    "front": {
      "label": "Front",
      "templateImageUrl": "/uploads/templates/basic-tshirt-front.png",
      "printArea": { "x": 120, "y": 140, "width": 260, "height": 320 }
    },
    "back": {
      "label": "Back",
      "templateImageUrl": "/uploads/templates/basic-tshirt-back.png",
      "printArea": { "x": 120, "y": 140, "width": 260, "height": 320 }
    }
  },
  "isActive": true,
  "sortOrder": 1
}
```

### Template 2 - Basic Polo

```json
{
  "name": "Basic Polo",
  "slug": "basic-polo",
  "productType": "polo",
  "surfaces": {
    "front": {
      "label": "Front",
      "templateImageUrl": "/uploads/templates/basic-polo-front.png",
      "printArea": { "x": 130, "y": 150, "width": 240, "height": 300 }
    },
    "back": {
      "label": "Back",
      "templateImageUrl": "/uploads/templates/basic-polo-back.png",
      "printArea": { "x": 130, "y": 150, "width": 240, "height": 300 }
    }
  },
  "isActive": true,
  "sortOrder": 2
}
```

## 14.4 Ghi chú

- GET templates có thể public
- backend là nguồn chuẩn cho dữ liệu `printArea`
- frontend không được hardcode print area theo loại áo

Điểm này vẫn giữ đúng tinh thần từ bản cũ: template là nguồn chuẩn cho ràng buộc vùng in. fileciteturn0file0

---

## 15. Projects module chi tiết

## 15.1 Mục tiêu

Đây vẫn là module quan trọng nhất vì editor cần lưu Fabric JSON cho 2 mặt `front` và `back`, đồng thời autosave phải chạy nhẹ và an toàn.

Điểm này hoàn toàn nhất quán với tài liệu gốc. fileciteturn0file0

## 15.2 Ownership rule

Mọi project đều thuộc về `req.user.userId`.

User không được:

- xem project của user khác
- sửa project của user khác
- xóa project của user khác

## 15.3 API

### GET `/api/v1/projects`

#### Query params

- `page`
- `limit`
- `search`
- `productType` optional
- `sortBy` default `updatedAt`
- `sortOrder` default `desc`

#### Response mẫu

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "...",
        "name": "Summer Polo Design",
        "templateId": "...",
        "productType": "polo",
        "thumbnailUrl": null,
        "updatedAt": "2026-03-14T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### POST `/api/v1/projects`

#### Request body tối thiểu

```json
{
  "name": "My Design",
  "templateId": "template_object_id",
  "surfaces": {
    "front": {
      "canvasJson": {
        "version": "7.x",
        "objects": []
      }
    },
    "back": {
      "canvasJson": {
        "version": "7.x",
        "objects": []
      }
    }
  }
}
```

#### Flow

1. verify auth
2. validate template tồn tại và đang active
3. lấy `productType` từ template
4. normalize payload
5. tạo project mới
6. trả project detail

#### Tương thích payload cũ

Backend phải chấp nhận cả payload cũ:

```json
{
  "name": "My Design",
  "templateId": "template_object_id",
  "frontCanvasJson": { "version": "7.x", "objects": [] },
  "backCanvasJson": { "version": "7.x", "objects": [] }
}
```

và map sang `surfaces.front.canvasJson` + `surfaces.back.canvasJson`.

---

### GET `/api/v1/projects/:id`

Trả toàn bộ thông tin project để frontend load lại editor.

#### Response nên gồm

- `id`
- `name`
- `productType`
- `template`
- `surfaces.front.canvasJson`
- `surfaces.back.canvasJson`
- timestamps

---

### PUT `/api/v1/projects/:id`

Dùng cho save thủ công.

#### Request body có thể gồm

```json
{
  "name": "New Name",
  "templateId": "template_object_id",
  "surfaces": {
    "front": { "canvasJson": { "version": "7.x", "objects": [] } },
    "back": { "canvasJson": { "version": "7.x", "objects": [] } }
  },
  "thumbnailUrl": null,
  "status": "draft"
}
```

#### Rules

- chỉ update field được phép
- nếu đổi `templateId`, phải re-sync `productType`
- không cho phép client set `userId`
- `updatedAt` phải thay đổi sau mỗi lần save

---

### PATCH `/api/v1/projects/:id/autosave`

Đây là endpoint quan trọng nhất cho editor.

#### Mục tiêu

Frontend gọi định kỳ khi canvas thay đổi.

#### Request body ví dụ

```json
{
  "surfaces": {
    "front": {
      "canvasJson": {
        "version": "7.x",
        "objects": []
      }
    }
  }
}
```

#### Rules

- phải có ít nhất một field được autosave
- chỉ update các field liên quan được gửi lên
- không replace toàn bộ document nếu không cần
- có thể cập nhật `lastOpenedAt`

#### Response

```json
{
  "success": true,
  "message": "Project autosaved",
  "data": {
    "id": "...",
    "updatedAt": "2026-03-14T00:00:00.000Z"
  }
}
```

---

### DELETE `/api/v1/projects/:id`

Phase 1 hard delete là đủ.

---

### POST `/api/v1/projects/:id/duplicate`

Optional nhưng khuyến nghị có.

Tên mặc định:

`<old name> Copy`

---

## 15.4 Business rules quan trọng

- backend chỉ lưu **Fabric canvas JSON**, không cần collection layer riêng
- autosave phải là partial update
- mọi query project phải filter theo `userId` từ token
- `templateId` phải là nguồn chuẩn để xác định `productType`

Các rule này về bản chất giữ nguyên tinh thần tài liệu gốc. fileciteturn0file0

---

## 16. Assets module chi tiết

## 16.1 Mục tiêu

Cho user upload ảnh để kéo vào editor.

## 16.2 File constraints

Mime types cho phép:

- image/png
- image/jpeg
- image/jpg
- image/webp
- image/svg+xml (optional nếu frontend hỗ trợ)

Giới hạn mặc định:

- 10MB

## 16.3 Lưu file local

- thư mục vật lý: `uploads/`
- public URL: `/uploads/<filename>`

Express phải serve static folder này.

Ví dụ:

```js
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || 'uploads')))
```

## 16.4 API

### POST `/api/v1/assets/upload`

Content type: `multipart/form-data`

Form field:

- `file`

#### Flow

1. verify auth
2. validate file
3. validate mime type + size
4. lưu file
5. tạo asset record trong DB
6. trả metadata

#### Response mẫu

```json
{
  "success": true,
  "message": "Asset uploaded successfully",
  "data": {
    "id": "...",
    "url": "/uploads/abc123.png",
    "originalName": "logo.png",
    "mimeType": "image/png",
    "size": 123456
  }
}
```

### GET `/api/v1/assets`

Trả danh sách asset của user, sort `createdAt desc`.

### DELETE `/api/v1/assets/:id`

1. verify auth
2. tìm asset theo id và ownership
3. xóa file vật lý nếu tồn tại
4. xóa record DB

---

## 17. Validation rules

Dùng `zod` cho request validation.

## 17.1 Auth validation

### Register

- email hợp lệ
- password min 8 ký tự
- displayName optional

### Login

- email hợp lệ
- password required

### Google login

- `idToken` bắt buộc, string non-empty

---

## 17.2 Template validation

### Seed/Create shape

- `name` required
- `slug` required
- `productType` phải thuộc enum
- `surfaces.front.printArea` required
- `surfaces.back.printArea` required
- `surfaces.front.templateImageUrl` required
- `surfaces.back.templateImageUrl` required

---

## 17.3 Project validation

### Create

- `name`: required, string, min 1, max 100
- `templateId`: required
- `surfaces.front.canvasJson`: optional object
- `surfaces.back.canvasJson`: optional object

### Update

- `name`: optional
- `templateId`: optional
- `surfaces`: optional
- `status`: optional
- `thumbnailUrl`: optional nullable string

### Autosave

- phải có ít nhất một surface hoặc field hợp lệ được gửi lên
- nếu surface tồn tại thì `canvasJson` phải là object

---

## 17.4 Asset validation

- file required
- mime type hợp lệ
- size không vượt limit

---

## 18. Security requirements

## 18.1 Middleware bảo mật

Dùng:

- `helmet()`
- `cors()` cấu hình theo `CLIENT_URL`
- `express.json({ limit: '2mb' })`

## 18.2 Password hashing

- bcrypt với salt rounds 10 hoặc 12

## 18.3 JWT

- secret lấy từ env
- không hardcode
- token mặc định 7 ngày

## 18.4 Google token verification

- verify đúng `audience = GOOGLE_CLIENT_ID`
- reject token invalid
- không tin email/profile do client tự gửi ngoài Google payload

## 18.5 Upload security

- chỉ nhận image types hợp lệ
- không dùng nguyên filename từ user
- sanitize path
- generate filename an toàn

## 18.6 Ownership

- `projects` và `assets` luôn filter theo `userId` từ token
- không bao giờ dùng `userId` từ client body

---

## 19. Error handling

## 19.1 API error class

Tạo class `ApiError` gồm:

- `statusCode`
- `message`
- `errors` optional

## 19.2 Global error middleware

- normalize error response
- log lỗi ở dev
- không expose stack ở production

## 19.3 Not found middleware

Response:

```json
{
  "success": false,
  "message": "Route not found"
}
```

---

## 20. Logging

- `morgan('dev')` cho development
- chưa cần logging phức tạp ở phase 1

---

## 21. Seed data

Bắt buộc có script:

```bash
npm run seed:templates
```

Script cần:

1. connect DB
2. upsert template `basic-tshirt`
3. upsert template `basic-polo`
4. log kết quả
5. exit process an toàn

---

## 22. Docker yêu cầu

## 22.1 Dockerfile

Yêu cầu:

- dùng Node LTS image
- copy package files
- install deps
- copy source
- expose port 5000
- run server

## 22.2 docker-compose.yml

Tối thiểu 2 services:

- backend
- mongo

Optional:

- nginx

Ví dụ:

```yaml
version: '3.9'
services:
  mongo:
    image: mongo:7
    restart: unless-stopped
    ports:
      - '27017:27017'
    volumes:
      - mongo_data:/data/db

  backend:
    build: .
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - '5000:5000'
    depends_on:
      - mongo
    volumes:
      - ./uploads:/app/uploads

volumes:
  mongo_data:
```

---

## 23. Nginx yêu cầu

Tối thiểu cần reverse proxy cho API và uploads:

```nginx
server {
  listen 80;

  location /api/ {
    proxy_pass http://backend:5000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /uploads/ {
    proxy_pass http://backend:5000/uploads/;
  }
}
```

---

## 24. Route map tổng hợp

## Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/google`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

## Templates

- `GET /api/v1/templates`
- `GET /api/v1/templates/:id`

## Projects

- `GET /api/v1/projects`
- `POST /api/v1/projects`
- `GET /api/v1/projects/:id`
- `PUT /api/v1/projects/:id`
- `PATCH /api/v1/projects/:id/autosave`
- `DELETE /api/v1/projects/:id`
- `POST /api/v1/projects/:id/duplicate` optional

## Assets

- `GET /api/v1/assets`
- `POST /api/v1/assets/upload`
- `DELETE /api/v1/assets/:id`

---

## 25. Thứ tự triển khai khuyến nghị

### Bước 1

- bootstrap Express app
- config env
- connect MongoDB
- global middlewares
- global error handler

### Bước 2

- user model mới hỗ trợ provider
- auth validation
- local auth APIs
- Google login API
- JWT middleware

### Bước 3

- template model mới theo `productType + surfaces`
- seed script
- template read APIs

### Bước 4

- project model
- project normalization logic
- project CRUD APIs
- autosave endpoint

### Bước 5

- upload middleware
- asset model
- asset APIs
- static file serving

### Bước 6

- Dockerfile
- docker-compose
- nginx.conf
- README run guide

---

## 26. Acceptance criteria phase 1

Backend được xem là đạt yêu cầu khi:

1. Có thể register/login bằng email + password
2. Có thể login bằng Google qua `POST /api/v1/auth/google`
3. Có thể gọi `/auth/me` với JWT hợp lệ
4. Có thể seed và lấy danh sách template cho `tshirt` và `polo`
5. Mỗi template trả về đủ `front` và `back`, mỗi mặt có `templateImageUrl` và `printArea`
6. Có thể tạo project mới gắn với template cụ thể
7. Có thể autosave một hoặc nhiều surface
8. Có thể load lại project và khôi phục editor state
9. Có thể upload asset và lấy URL public
10. Có thể xóa project và asset đúng ownership
11. Chạy được bằng Docker Compose

---

## 27. Yêu cầu dành cho coding agent

Hãy generate code backend **production-leaning**, rõ ràng, sạch, dễ bảo trì.

### Bắt buộc

- Dùng **Node.js + Express + MongoDB + Mongoose**
- Dùng **JWT** cho auth
- Dùng **bcrypt** cho local password
- Dùng **google-auth-library** để verify Google ID token
- Dùng **multer** cho upload ảnh
- Tách module rõ ràng: `auth`, `projects`, `assets`, `templates`
- Có middleware: auth, validate, error
- Có response format nhất quán
- Có Dockerfile, docker-compose, `.env.example`
- Có seed script cho templates

### Không được làm

- Không generate frontend
- Không dùng session-based auth làm mặc định
- Không tin `userId` gửi từ client
- Không lưu plaintext password
- Không bỏ qua ownership check
- Không hardcode print area hay template data trong controller

### Ưu tiên tương thích frontend hiện tại

- Hỗ trợ dữ liệu Fabric canvas JSON
- Hỗ trợ 2 surface: `front`, `back`
- Hỗ trợ payload cũ `frontCanvasJson` / `backCanvasJson`

---

## 28. Gợi ý mở rộng phase 2

Sau khi phase 1 ổn định, có thể mở rộng:

- refresh token
- unlink/link auth providers
- soft delete project
- project thumbnails tự động
- server-side mockup rendering
- Cloudinary / S3 storage
- version history
- team collaboration
- admin template management
- thêm product types khác ngoài `tshirt` và `polo`
- thêm surface khác ngoài `front` và `back`

---

## 29. Kết luận

Nếu coding agent cần một thứ tự triển khai tối ưu nhất, hãy đi theo thứ tự:

1. **Auth local + Google**
2. **Templates theo productType + surfaces**
3. **Projects + autosave**
4. **Assets upload**
5. **Docker / deploy**

Lý do:

- Auth là nền cho ownership
- Google login là yêu cầu business mới nên phải được cố định sớm
- Templates phải rõ ngay từ đầu vì dữ liệu `front/back` là xương sống của editor
- Projects là business core vì toàn bộ editor state nằm ở đây
- Assets và deploy hoàn thiện khả năng vận hành sau khi API chính đã ổn
