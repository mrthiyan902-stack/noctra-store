# NOCTRA Store

Full-stack e-commerce store built with Node.js, Express, MongoDB, and SSLCommerz.

## Setup

### 1. Clone & Install
```bash
git clone https://github.com/mrthiyan902-stack/noctra-store
cd noctra-store
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in your values:
```
MONGODB_URI=your_mongodb_connection_string
SESSION_SECRET=any_random_long_string
SSLCOMMERZ_STORE_ID=noctr6a13514d0c317
SSLCOMMERZ_STORE_PASSWORD=noctr6a13514d0c317@ssl
SSLCOMMERZ_IS_LIVE=false
ADMIN_USERNAME=admin
ADMIN_PASSWORD=noctra@admin123
APP_URL=https://your-railway-url.up.railway.app
```

### 3. Run
```bash
npm start
```

## Admin Panel
Visit `/admin` — login with your ADMIN_USERNAME and ADMIN_PASSWORD.

## Deployment (Railway)
1. Push to GitHub
2. Connect Railway to this repo
3. Add environment variables in Railway dashboard
4. Deploy!
