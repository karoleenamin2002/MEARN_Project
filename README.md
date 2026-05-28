project/
├── src/
│   ├── server.js              ← Entry point
│   ├── config/
│   │   └── db.js              ← MongoDB connection
│   ├── models/
│   │   ├── User.js
│   │   ├── Client.js
│   │   ├── Product.js
│   │   ├── Invoice.js
│   │   ├── InvoiceDocument.js
│   │   ├── InventoryTransaction.js
│   │   └── Notification.js
│   ├── controllers/           ← Business logic
│   ├── routes/                ← API endpoints
│   ├── middleware/
│   │   ├── auth.js            ← JWT protect + authorize
│   │   └── errorHandler.js
│   └── utils/
│       └── apiFeatures.js     ← Filter, sort, paginate
├── uploads/                   ← ملفات الفواتير
├── .env
└── package.json