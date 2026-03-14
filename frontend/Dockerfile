# Sử dụng Node.js LTS image làm base image cho build
FROM node:lts as build

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Sao chép package.json và package-lock.json vào container
COPY package*.json ./

# Cài đặt các phụ thuộc cho frontend
RUN npm install

# Sao chép tất cả mã nguồn vào container
COPY . .

# Xây dựng ứng dụng React hoặc Vite
RUN npm run build

# Sử dụng Nginx để phục vụ ứng dụng
FROM nginx:alpine

# Sao chép các file build từ build container vào container Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Mở port 80 để phục vụ frontend
EXPOSE 80

# Chạy Nginx
CMD ["nginx", "-g", "daemon off;"]