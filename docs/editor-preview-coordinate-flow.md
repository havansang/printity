# Editor Preview Coordinate Flow

Tài liệu này mô tả chi tiết luồng tọa độ từ frontend editor sang backend preview render.

Mục tiêu:

- Có một chuẩn duy nhất để đọc và debug lỗi lệch vị trí giữa `Edit` và `Preview`
- Xác định rõ object đang neo vào mốc nào ở frontend
- Xác định backend dùng `printArea` nào để render
- Có checklist để lần sau chỉ cần gửi đúng dữ liệu, không phải phân tích lại từ đầu

Phạm vi tài liệu này ưu tiên cho:

- Template `Basic T-shirt`
- Surface `front`
- Các loại layer: `text`, `image`, `shape`

---

## 1. Nguồn chuẩn của hệ tọa độ

Trong editor hiện tại có 3 không gian tọa độ khác nhau:

1. `Scene space`
- Là hệ tọa độ toàn bộ SVG editor
- Ví dụ `Basic T-shirt front` có scene gần `3568.58 x 3568.58`
- Đây là không gian mà Fabric object thực sự đang sống

2. `Editor printArea space`
- Là vùng in trong SVG editor
- Với `Basic T-shirt front`:
  - `x = 934.29`
  - `y = 784.29`
  - `width = 1700`
  - `height = 2200`
- Đây là box chuẩn để tính `x/y` normalized cho payload preview

3. `Render printArea space`
- Là vùng backend dán design lên ảnh mockup cuối
- Với `Basic T-shirt front`:
  - `x = 675.5`
  - `y = 526`
  - `width = 697`
  - `height = 902`

Kết luận quan trọng:

- Frontend editor phải lưu object theo `scene space`
- Preview payload phải normalize vị trí theo `editor printArea`
- Backend phải dựng layer trong `editor printArea`, rồi scale cả box đó sang `render printArea`

Nếu 3 bước này không cùng một contract, `Edit` và `Preview` sẽ lệch.

---

## 2. Các file liên quan

### Frontend

- `frontend/src/editor/layout/EditorContext.jsx`
- `frontend/src/editor/layout/CanvasWorkspace.jsx`
- `frontend/src/editor/layout/Positioner.jsx`
- `frontend/src/editor/layout/PreviewWorkspace.jsx`
- `frontend/src/editor/layout/mockupPreviewPayload.js`

### Backend

- `backend/src/modules/mockups/mockup.service.js`
- `backend/src/modules/mockups/mockup.validation.js`
- `backend/src/modules/templates/template.seed.js`

### Mockup assets / SVG nguồn

- `backend/resources/mockups/basic-tshirt/front/editor.svg`
- `backend/resources/mockups/basic-tshirt/front/base.png`
- `backend/resources/mockups/basic-tshirt/front/mask.png`
- `backend/resources/mockups/basic-tshirt/front/shadow.png`
- `backend/resources/mockups/basic-tshirt/front/highlight.png`

---

## 3. Frontend editor đang neo object vào đâu

### 3.1. Print area được lấy từ đâu

Frontend không hardcode box nhìn thấy theo CSS.

Luồng chuẩn hiện tại:

1. `EditorPage` load template từ backend
2. `templateDef.front.printArea` được đưa vào editor state
3. `CanvasWorkspace` load `editor.svg`
4. `CanvasWorkspace.extractPrintAreaFromSvg()` đọc placeholder thật từ SVG
5. Kết quả được lưu vào `surfacePrintAreas`

Nguồn chuẩn cuối cùng ở frontend là:

- `surfacePrintAreas[surfaceKey]`

Đây là box dùng cho cả:

- căn object vào giữa vùng in
- serialize payload preview
- align canvas viewport lên đúng vùng in

### 3.2. Object mới được đặt ở đâu

Khi add `text`, `image`, `shape`, object được đặt bằng:

- `originX = 'center'`
- `originY = 'center'`
- `setPositionByOrigin(new Point(pa.x + pa.width / 2, pa.y + pa.height / 2), 'center', 'center')`

Trong đó:

- `pa = surfacePrintAreas[activeSurface]`

Nghĩa là object được đặt theo tâm của `printArea`, nhưng vẫn ở `scene space`.

Ví dụ:

- nếu `x = 934.29`, `width = 1700`
- tâm theo trục X sẽ là `934.29 + 1700 / 2 = 1784.29`

Nếu payload sau đó ra:

- `x = 0.5`
- `y = 0.5`

thì object thực chất đang nằm đúng giữa `editor printArea`.

### 3.3. Vì sao object có thể nhìn lệch ở tab Edit dù payload đúng

Fabric canvas không vẽ toàn bộ scene rồi crop bằng CSS.

Luồng hiện tại:

- canvas width/height = `printArea.width/height`
- Fabric `viewportTransform` dịch ngược theo:
  - `translateX = -printArea.x`
  - `translateY = -printArea.y`

Nghĩa là:

- object vẫn nằm ở `scene space`
- canvas chỉ “nhìn vào” phần `printArea`

Nếu `viewportTransform` sai, object sẽ nhìn lệch ở tab `Edit` dù tọa độ thật vẫn đúng.

Đây là lý do bug kiểu sau có thể xảy ra:

- payload gửi preview ra `x = 0.5, y = 0.5`
- preview backend hiển thị đúng giữa
- nhưng tab `Edit` lại thấy object nằm dưới bên phải

Trong trường hợp đó, lỗi là ở `CanvasWorkspace` hoặc phần align canvas overlay, không phải ở backend.

---

## 4. Frontend preview payload được build như thế nào

### 4.1. Luồng tổng quan

`PreviewWorkspace`

-> gọi `captureSurfaceSnapshots()`

-> gọi `buildMockupPreviewPayload()`

-> gọi API preview backend

### 4.2. Với active surface

Để tránh sai lệch do `toJSON -> loadFromJSON`, preview hiện tại ưu tiên lấy object trực tiếp từ live canvas cho surface đang mở.

Ý nghĩa:

- những gì user đang nhìn ở `Edit` là nguồn sự thật gần nhất
- không đi qua thêm một vòng round-trip có thể làm sai mốc

### 4.3. Công thức serialize vị trí

Cho mỗi object:

- `center = object.getCenterPoint()`
- `pa = surfacePrintAreas[surfaceKey]`

Payload preview dùng:

- `x = (center.x - pa.x) / pa.width`
- `y = (center.y - pa.y) / pa.height`

Đây là normalized center trong `editor printArea`.

Quy ước:

- `x = 0` là mép trái vùng in
- `x = 1` là mép phải vùng in
- `x = 0.5` là đúng giữa

Tương tự với `y`.

### 4.4. Kích thước layer

Payload hiện dùng:

- `width = object.getScaledWidth()`
- `height = object.getScaledHeight()`

Đơn vị của `width/height` là đơn vị của `editor printArea`, không phải normalized.

Backend hiểu đúng theo contract này.

### 4.5. Shape layer hiện gửi gì

Shape preview payload hiện gửi:

- `layerType = "shape"`
- `x`
- `y`
- `width`
- `height`
- `fill`
- `stroke`
- `pathCommands`

Hiện tại shape không dùng `shapeId` làm nguồn render chính nữa trong preview payload.

Lý do:

- `pathCommands` là dữ liệu đủ để backend render ngay
- debug dễ hơn vì nhìn vào payload là biết backend sẽ vẽ gì

### 4.6. Kích thước output preview

`size` hiện phải lấy từ:

- `template.defaultRenderOptions.size`

Với `Basic T-shirt` hiện tại:

- `size = 2048`

Không được hardcode `2400`, vì điều đó làm payload frontend không khớp template backend.

---

## 5. Backend preview đang dùng mốc nào

### 5.1. Backend lấy printArea ở đâu

Backend render preview lấy từ template DB:

- `editorPrintArea = surface.editor.printArea || surface.printArea`
- `renderPrintArea = surface.render.printArea || surface.printArea`

Với `Basic T-shirt front`:

- `editorPrintArea = { x: 934.29, y: 784.29, width: 1700, height: 2200 }`
- `renderPrintArea = { x: 675.5, y: 526, width: 697, height: 902 }`

### 5.2. Backend dựng từng layer như thế nào

Cho mỗi layer:

- `centerX = x * editorPrintArea.width`
- `centerY = y * editorPrintArea.height`

Sau đó backend render bằng transform:

- `translate(centerX, centerY)`
- `rotate(angle)`
- `scale(scaleX, scaleY)`
- `translate(-width/2, -height/2)`

Nghĩa là backend luôn hiểu:

- `x/y` là normalized theo `editorPrintArea`
- `width/height` là kích thước tuyệt đối trong không gian `editorPrintArea`

### 5.3. Backend đặt design lên mockup cuối như thế nào

Sau khi dựng xong toàn bộ design trong box `editorPrintArea.width x editorPrintArea.height`, backend:

1. rasterize design box
2. resize box đó sang `renderPrintArea.width x renderPrintArea.height`
3. composite lên ảnh mockup tại:
   - `left = renderPrintArea.x`
   - `top = renderPrintArea.y`

Nói ngắn gọn:

- frontend gửi tọa độ trong `editor printArea`
- backend scale nguyên cả box design sang `render printArea`

---

## 6. Contract đúng giữa frontend và backend

Đây là contract chuẩn. Nếu một bên làm khác, sẽ lệch.

### Frontend phải đảm bảo

- Object được lưu theo `scene space`
- `surfacePrintAreas[surfaceKey]` đúng với placeholder thật của SVG
- Payload `x/y` luôn normalize theo `surfacePrintAreas[surfaceKey]`
- Payload `width/height` là kích thước tuyệt đối của object trong không gian editor

### Backend phải đảm bảo

- `editor.printArea` trong template đúng với `editor.svg`
- `render.printArea` đúng với mockup base asset
- `x/y` được hiểu là normalized center
- `width/height` được hiểu là size tuyệt đối trong `editor printArea`

---

## 7. Cách đọc nhanh một payload preview

Ví dụ:

```json
{
  "layerType": "shape",
  "x": 0.5,
  "y": 0.5,
  "width": 519.048,
  "height": 519.048,
  "pathCommands": "M 0 519.048 L 0 0 L 519.048 0 L 519.048 519.048 L 0 519.048 Z"
}
```

Diễn giải:

- shape đang ở đúng tâm vùng in
- shape rộng khoảng `519px` trong hệ `editor printArea 1700x2200`
- backend sẽ đặt tâm shape ở:
  - `centerX = 0.5 * 1700 = 850`
  - `centerY = 0.5 * 2200 = 1100`
- sau đó scale cả design box `1700x2200` sang `697x902`

Nếu preview cho ra đúng giữa áo:

- backend đúng
- payload đúng

Nếu tab `Edit` lại thấy object nằm dưới bên phải:

- lỗi là ở frontend canvas alignment

---

## 8. Các lỗi đã gặp và cách nhận biết

### Case A. Edit đúng, preview lệch

Dấu hiệu:

- object nhìn đúng trong vùng in ở `Edit`
- payload `x/y` âm hoặc bất thường
- preview backend lệch ra ngoài

Nguyên nhân thường gặp:

- serializer preview dùng sai mốc
- object bị serialize từ snapshot không cùng mốc với live canvas

Hướng kiểm tra:

1. log `object.getCenterPoint()`
2. log `printArea`
3. tính tay:
   - `(center.x - pa.x) / pa.width`
   - `(center.y - pa.y) / pa.height`
4. so sánh với JSON gửi sang backend

### Case B. Preview đúng, edit lệch

Dấu hiệu:

- payload `x/y` nhìn đúng
- preview backend đúng
- object trên editor hiển thị lệch

Nguyên nhân thường gặp:

- `viewportTransform` của Fabric sai
- canvas overlay không align đúng lên placeholder trong SVG

Hướng kiểm tra:

1. log `canvas.viewportTransform`
2. kiểm tra `translateX = -printArea.x`
3. kiểm tra `translateY = -printArea.y`
4. kiểm tra `CanvasWorkspace.alignCanvasToPrintArea()`

### Case C. Cả edit lẫn preview đều sai

Nguyên nhân thường gặp:

- object được tạo sai mốc ngay từ đầu
- `surfacePrintAreas` đọc sai từ SVG
- template `editor.printArea` không khớp `editor.svg`

Hướng kiểm tra:

1. mở `editor.svg`
2. đọc `placeholder_front`
3. so sánh với template seed / template DB

---

## 9. Checklist debug chuẩn

Khi có bug lệch vị trí, lần sau chỉ cần gửi các dữ liệu sau:

1. Ảnh tab `Edit`
2. Ảnh tab `Preview`
3. JSON request gửi tới backend preview
4. Nếu có thể, thêm:
   - `canvas.viewportTransform`
   - `object.left`
   - `object.top`
   - `object.originX`
   - `object.originY`
   - `object.getCenterPoint()`
   - `surfacePrintAreas[activeSurface]`

Quy trình debug:

1. Kiểm tra payload `x/y`
- nếu payload đã sai thì chưa cần nhìn backend

2. Nếu payload đúng mà preview sai
- kiểm tra backend `editor.printArea`
- kiểm tra backend `render.printArea`
- kiểm tra transform build layer

3. Nếu payload đúng và preview đúng nhưng edit sai
- kiểm tra `CanvasWorkspace`
- kiểm tra `viewportTransform`
- kiểm tra align canvas overlay lên SVG

---

## 10. Invariants bắt buộc phải giữ

Các rule này không được phá:

1. Object trong editor luôn sống ở `scene space`

2. `surfacePrintAreas` là nguồn chuẩn duy nhất để:
- add object
- align object
- serialize payload

3. Payload preview luôn dùng:
- `x/y` = normalized center trong `editor printArea`
- `width/height` = absolute size trong `editor printArea`

4. Backend preview luôn dựng layer trong `editorPrintArea` rồi mới scale cả box sang `renderPrintArea`

5. `render.printArea` không được dùng để tính `x/y` từng object

6. Nếu `Edit` và `Preview` mâu thuẫn:
- ưu tiên đối chiếu payload trước
- sau đó mới xét backend

---

## 11. Trạng thái implementation hiện tại

Tại thời điểm viết tài liệu này:

- Active surface preview ưu tiên serialize từ live canvas
- Shape preview payload gửi `pathCommands`
- `size` của preview payload lấy theo `template.defaultRenderOptions.size`
- `CanvasWorkspace.syncViewportToPrintArea()` phải đặt translation tuyệt đối theo `-printArea.x/-printArea.y`, không giữ pan cũ trong Fabric

Lý do:

- pan/zoom của editor hiện nằm ở `Positioner`, không nằm trong Fabric viewport
- nếu giữ pan cũ trong Fabric, `Edit` có thể nhìn lệch dù preview đúng

---

## 12. Kết luận ngắn

Chuẩn đúng của hệ thống là:

- Frontend object nằm trong `scene space`
- Payload preview normalize theo `editor printArea`
- Backend render trong `editor printArea`
- Backend scale nguyên design box sang `render printArea`

Nếu một object ở `Edit` nhìn khác `Preview`, phải trả lời 3 câu hỏi theo thứ tự:

1. Payload `x/y` có đúng không
2. Backend `editor.printArea` và `render.printArea` có đúng không
3. `viewportTransform` của Fabric có đúng không

Chỉ cần đi đúng 3 bước đó là khoanh được lỗi.
