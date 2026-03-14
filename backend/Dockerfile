# Sử dụng Node.js LTS image làm base image
FROM node:lts

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Sao chép package.json và package-lock.json vào container
COPY package*.json ./

# Cài đặt các phụ thuộc cho backend
RUN npm install

# Sao chép tất cả mã nguồn vào container
COPY . .

# Mở port 5000 cho backend API
EXPOSE 5000

# Chạy backend server
CMD ["npm", "start"]