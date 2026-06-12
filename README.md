# 🛒 Bazary Backend

A full-featured RESTful API backend for **Bazary** — an e-commerce platform built with Node.js, Express, and MongoDB. The API is deployed on Vercel and handles everything from user authentication to payment processing.

🔗 **Live API:** [bazary-backend.vercel.app](https://bazary-backend.vercel.app)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Endpoints](#-api-endpoints)
- [Authentication](#-authentication)
- [Payment Integration](#-payment-integration)
- [Image Upload](#-image-upload)
- [Deployment](#-deployment)

---

## ✨ Features

- **JWT Authentication** — Access & refresh token strategy with short-lived access tokens (15m) and long-lived refresh tokens (7d)
- **User Management** — Registration, login, profile management, and role-based access
- **Product Catalog** — Full CRUD for products with image upload support
- **Order Management** — Create, track, and manage orders
- **Payment Processing** — Stripe integration with webhook support for real-time payment events
- **Email Notifications** — Transactional emails via Nodemailer (Gmail)
- **Image Hosting** — Cloud image storage and optimization via ImageKit
- **Input Validation** — Request validation using Joi and express-validator
- **AI Integration** — GROQ API integration for AI-powered features

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js v5 |
| Database | MongoDB + Mongoose |
| Authentication | JWT (jsonwebtoken + bcryptjs) |
| Payments | Stripe |
| Image Storage | ImageKit |
| Email | Nodemailer |
| Validation | Joi + express-validator |
| Dev Server | Nodemon |
| Deployment | Vercel |

---

## 📁 Project Structure

```
Bazary_Backend/
├── index.js              # App entry point — initializes Express, connects DB, mounts routes
├── vercel.json           # Vercel deployment configuration
├── .env.example          # Environment variable template
├── package.json
│
├── routes/               # Route definitions — maps HTTP endpoints to controllers
├── controller/           # Business logic handlers for each resource
├── models/               # Mongoose schemas and models
├── middleware/           # Custom middleware (auth guards, error handling, file upload, etc.)
├── Services/             # External service integrations (email, ImageKit, Stripe, etc.)
├── Webhooks/             # Stripe webhook event handlers
└── utils/                # Shared utility functions and helpers
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- MongoDB instance (local or Atlas)
- Stripe account
- ImageKit account
- Gmail account (for email notifications)
- GROQ API key (for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Maram-ghozal/Bazary_Backend.git
   cd Bazary_Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Then fill in all required values in `.env` (see [Environment Variables](#-environment-variables) below).

4. **Start the development server**
   ```bash
   npm start
   ```
   The server will start with `nodemon` and auto-reload on file changes.

---

## 🔐 Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
# Server
PORT=
NODE_ENV=development

# Database
MONGO_URI=

# JWT — Access Token (short-lived)
JWT_ACCESS_SECRET=your_access_secret_key_here
JWT_ACCESS_EXPIRES_IN=15m

# JWT — Refresh Token (long-lived)
JWT_REFRESH_SECRET=your_refresh_secret_key_here
JWT_REFRESH_EXPIRES_IN=7d

# Email (Gmail)
EMAIL_USERNAME=your.email@gmail.com
EMAIL_PASSWORD=your_app_password_here

# ImageKit
IMAGEKIT_PUBLIC_KEY=your_public_key
IMAGEKIT_PRIVATE_KEY=your_private_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# AI
GROQ_API_KEY=
```

> **Note:** Never commit your `.env` file. It is already listed in `.gitignore`.

---

## 📡 API Endpoints

The API follows RESTful conventions. All endpoints are prefixed with the base URL.

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login and receive tokens |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout and invalidate refresh token |
| POST | `/auth/forgot-password` | Send password reset email |
| POST | `/auth/reset-password` | Reset password with token |

### Users
| Method | Endpoint | Description |
|---|---|---|
| GET | `/users/me` | Get current user profile |
| PATCH | `/users/me` | Update profile |
| DELETE | `/users/me` | Delete account |

### Products
| Method | Endpoint | Description |
|---|---|---|
| GET | `/products` | List all products |
| GET | `/products/:id` | Get a single product |
| POST | `/products` | Create a product (admin) |
| PATCH | `/products/:id` | Update a product (admin) |
| DELETE | `/products/:id` | Delete a product (admin) |

### Orders
| Method | Endpoint | Description |
|---|---|---|
| GET | `/orders` | Get user orders |
| POST | `/orders` | Place a new order |
| GET | `/orders/:id` | Get order details |

### Payments
| Method | Endpoint | Description |
|---|---|---|
| POST | `/payments/checkout` | Create a Stripe checkout session |
| POST | `/webhooks/stripe` | Stripe webhook receiver |

---

## 🔑 Authentication

The API uses a **dual-token JWT strategy**:

- **Access Token** — short-lived (15 minutes), sent in the `Authorization: Bearer <token>` header for protected requests.
- **Refresh Token** — long-lived (7 days), used to obtain new access tokens without requiring re-login.

Passwords are hashed using **bcryptjs** before storage.

---

## 💳 Payment Integration

Payments are handled via **Stripe**. The flow:

1. Client calls `/payments/checkout` → API creates a Stripe Checkout Session and returns the session URL.
2. User completes payment on Stripe's hosted page.
3. Stripe sends a webhook event to `/webhooks/stripe`.
4. The Webhooks module verifies the event signature using `STRIPE_WEBHOOK_SECRET` and processes the order accordingly (e.g., marking it as paid).

---

## 🖼 Image Upload

Product and user images are uploaded and served via **ImageKit**:

- **Multer** handles multipart form-data on the server.
- Files are then uploaded to ImageKit's CDN using the `@imagekit/nodejs` SDK.
- Transformed image URLs (resize, format conversion, etc.) are stored in the database.

---

## ☁️ Deployment

The project is deployed on **Vercel** using the configuration in `vercel.json`.

To deploy your own instance:

```bash
npm install -g vercel
vercel --prod
```

Make sure to set all environment variables in the Vercel project dashboard under **Settings → Environment Variables**.

---

## 👩‍💻 Contributors

- [Maram Ghozal](https://github.com/Maram-ghozal)
- [Mariam Aboslema](https://github.com/MariamAboslema)
- [Aya Ahmed Elrayes](https://github.com/ayaahmedelrayes)

