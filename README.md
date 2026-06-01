# Inventory Backend - Node.js + Express + MongoDB (MVC)

## 🚀 Setup

```bash
npm install
cp .env.example .env
# عدّل MONGO_URI و JWT_SECRET في الـ .env
npm run dev

For connecting cloudinary ▼▼▼
CLOUD_NAME
CLOUD_API_KEY
CLOUD_API_SECRET
```

---

## 📁 Project Structure

```
src/
├── server.js              # Entry point
├── app.js                 # Express setup + routes registration
├── config/
│   └── db.js              # MongoDB connection
├── models/                # Mongoose schemas (M)
│   ├── user.model.js
│   ├── client.model.js
│   ├── product.model.js
│   ├── invoice.model.js
│   ├── invoiceDocument.model.js
│   ├── inventoryTransaction.model.js
│   ├── notification.model.js
│   ├── aiConversation.model.js
│   └── agentLog.model.js
├── controllers/           # Business logic (C)
│   ├── auth.controller.js
│   ├── product.controller.js
│   ├── invoice.controller.js
│   └── crud.controller.js  # Generic CRUD factory
├── routes/                # Route definitions (V-layer bridge)
│   ├── auth.routes.js
│   ├── user.routes.js
│   ├── client.routes.js
│   ├── product.routes.js
│   ├── invoice.routes.js
│   ├── invoiceDocument.routes.js
│   ├── inventoryTransaction.routes.js
│   ├── notification.routes.js
│   ├── aiConversation.routes.js
│   └── agentLog.routes.js
└── middleware/
    ├── auth.middleware.js  # JWT protect + adminOnly
    └── errorHandler.js     # Global error handler
```

---

## 🔐 Auth Endpoints

| Method | URL                    | Description       | Auth |
| ------ | ---------------------- | ----------------- | ---- |
| POST   | `/api/auth/register` | Register new user | ❌   |
| POST   | `/api/auth/login`    | Login + get JWT   | ❌   |
| GET    | `/api/auth/me`       | Get current user  | ✅   |

### Login Example

```json
POST /api/auth/login
{
  "email": "ahmed@gmail.com",
  "password": "123456"
}
```

Returns: `{ token: "Bearer ..." }`

---

## 📦 API Endpoints

### Users `/api/users` — Admin Only

| Method | URL                | Description    |
| ------ | ------------------ | -------------- |
| GET    | `/api/users`     | Get all users  |
| POST   | `/api/users`     | Create user    |
| GET    | `/api/users/:id` | Get user by ID |
| PUT    | `/api/users/:id` | Update user    |
| DELETE | `/api/users/:id` | Delete user    |

### Clients `/api/clients` — (Vendors & Customers)

Same CRUD pattern. Filter by `type=vendor` or `type=client`.

### Products `/api/products`

| Method | URL                   | Description                                             |
| ------ | --------------------- | ------------------------------------------------------- |
| GET    | `/api/products`     | Get all (supports `?category=&lowStock=true&search=`) |
| POST   | `/api/products`     | Create product                                          |
| GET    | `/api/products/:id` | Get product                                             |
| PUT    | `/api/products/:id` | Update product                                          |
| DELETE | `/api/products/:id` | Delete product                                          |

### Invoices `/api/invoices`

| Method | URL                   | Description                                              |
| ------ | --------------------- | -------------------------------------------------------- |
| GET    | `/api/invoices`     | Get all (supports `?invoiceType=&startDate=&endDate=`) |
| POST   | `/api/invoices`     | Create invoice + auto-update stock                       |
| GET    | `/api/invoices/:id` | Get invoice (populated)                                  |
| PUT    | `/api/invoices/:id` | Update invoice                                           |
| DELETE | `/api/invoices/:id` | Delete invoice                                           |

**invoiceType options:** `purchase`, `sale`, `purchase_return`, `sales_return`, `expense`

### Inventory Transactions `/api/inventory-transactions`

Read-only — auto-created when invoices are processed.

### Notifications `/api/notifications`

Full CRUD.

### AI Conversations `/api/ai-conversations`

Full CRUD.

### Agent Logs `/api/agent-logs`

Read + Create only.

---

## 🔒 Authentication

All endpoints (except `/api/auth/*`) require:

```
Authorization: Bearer <token>
```

---

## ⚙️ Business Logic Notes

- Creating an invoice automatically updates product quantities via `InventoryTransaction`
- Invoice numbers are auto-generated (e.g. `SAL-2026-0001`)
- User passwords are hashed with bcrypt before storage
- Low stock filter: `GET /api/products?lowStock=true`
