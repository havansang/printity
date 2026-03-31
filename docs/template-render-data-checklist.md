# Template Render Data Checklist

File này dùng để điền dữ liệu mockup thật cho `template.previewScenes[].render`.

## API liên quan

- `GET /api/v1/templates/:id`
- `PATCH /api/v1/templates/:id`
- `GET /api/v1/templates/:id/render-audit`

`render-audit` dùng để kiểm tra template còn thiếu asset nào, scene nào, placement nào.

## Mô hình dữ liệu

- `surfaces.*`
  - là dữ liệu editor gốc
  - dùng cho canvas và tọa độ thiết kế chuẩn

- `previewScenes[*].render`
  - là cấu hình preview theo từng scene
  - mỗi scene có nhiều `layers`
  - mỗi layer là một placement độc lập của một `surface`

## Những trường cần dữ liệu thật

### `basic-tshirt`

#### `previewScenes.front.render`

- `layers[0]` (`front`)
  - đã có `printArea`
  - dùng base màu theo `basePattern`

- `layers[1]` (`neckLabelInner`)
  - hiện đã có `printArea`
  - cần thay bằng vị trí/kích thước thật nếu ảnh front thật khác
  - nếu neck cần realism riêng trong scene `front`, điền thêm:
    - `assets.maskImageUrl`
    - `assets.shadowImageUrl`
    - `assets.highlightImageUrl`
    - `assets.displacementImageUrl`
    - `assets.occlusionImageUrl`

#### `previewScenes.back.render`

- `layers[0]` (`back`)
  - đã có `printArea`
  - nếu ảnh back thật đổi framing, thay lại `printArea`

#### `previewScenes.frontCollarCloseup.render`

- `basePattern`
  - hiện lấy theo `colors/{colorKey}/neck-label-inner/base.png`
  - cần giữ đúng nếu bạn có ảnh base theo màu cho neck closeup

- `layers[0]` (`neckLabelInner`)
  - hiện đang dùng `printArea` full của surface neck
  - nếu closeup thật bị nghiêng/cong, cần điền thêm:
    - `printQuad`
    - `assets.maskImageUrl`
    - `assets.shadowImageUrl`
    - `assets.highlightImageUrl`
    - `assets.displacementImageUrl`
    - `assets.occlusionImageUrl`

#### `previewScenes.folded.render`

- `layers[0]` (`front`)
  - `printQuad` hiện là placeholder/giá trị tạm
  - cần thay bằng quad thật theo ảnh folded thật
  - nếu folded front có asset riêng, điền lại:
    - `assets.maskImageUrl`
    - `assets.shadowImageUrl`
    - `assets.highlightImageUrl`
    - `assets.displacementImageUrl`
    - `assets.occlusionImageUrl`

- `layers[1]` (`neckLabelInner`)
  - `printQuad` hiện là placeholder/giá trị tạm
  - cần thay bằng quad thật theo ảnh folded thật
  - nếu neck trong folded có effect riêng, điền:
    - `assets.maskImageUrl`
    - `assets.shadowImageUrl`
    - `assets.highlightImageUrl`
    - `assets.displacementImageUrl`
    - `assets.occlusionImageUrl`

### `basic-polo`

#### `previewScenes.front.render`

- `layers[0]` (`front`)
  - đã có `printArea`
  - nếu ảnh front thật đổi framing, thay lại `printArea`

#### `previewScenes.back.render`

- `layers[0]` (`back`)
  - đã có `printArea`
  - nếu ảnh back thật đổi framing, thay lại `printArea`

## Quy tắc điền dữ liệu

- Nếu scene chỉ cần scale/translate:
  - điền `printArea`

- Nếu scene bị nghiêng/gập/phối cảnh:
  - điền `printQuad`

- Nếu layer trong scene dùng asset effect riêng:
  - điền ở `previewScenes[*].render.layers[*].assets`

- Nếu layer chỉ dùng effect mặc định của surface:
  - không cần điền `assets`

## Kiểm tra sau khi điền

1. Gọi `GET /api/v1/templates/:id/render-audit`
2. Sửa các `warning/error`
3. Gọi preview với đủ `sceneKeys`
4. So sánh ảnh preview với ảnh mockup thật
