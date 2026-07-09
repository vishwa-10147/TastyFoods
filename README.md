# FoodOrder

![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?logo=socket.io&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-blue)

FoodOrder is a real-time restaurant order management system with dedicated client and management interfaces, powered by Node.js, Express, PostgreSQL, and Socket.IO.

## Overview

FoodOrder helps restaurants run ordering and operations from a single backend.

- Client interface: menu browsing, order placement, order tracking, and payments.
- Management interface: menu control, table control, live order handling, and activity visibility.
- Realtime sync: updates are pushed instantly across all connected screens.

## Key Features

- Live menu and order state updates with Socket.IO
- Table lifecycle management (free, ordering, occupied)
- Kitchen workflow support (new, preparing, ready, delivered)
- Management controls for menu items and table status
- Payment support with Razorpay integration
- Health endpoint and operational safeguards (rate limiting)

## Tech Stack

- Backend: Node.js, Express 5
- Database: PostgreSQL (`pg`)
- Realtime: Socket.IO
- Frontend: Static HTML/CSS/JS pages

## Project Structure

```text
FoodOrdering/
├─ server.js
├─ client.html
├─ management.html
├─ outer-screen.html
├─ restaurant_order_management_system.html
├─ data/
├─ uploads/
├─ package.json
├─ README.md
├─ DEPLOYMENT.md
└─ render.yaml
```

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm start
```

3. Open in browser:

- Client: `http://localhost:3000/client.html`
- Management: `http://localhost:3000/management.html`
- Display: `http://localhost:3000/outer-screen.html`

## Available Scripts

- `npm start`: start the server
- `npm run dev`: start the server in development mode

## Environment Configuration

Copy `.env.example` and configure the values needed for your environment:

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `PGSSL`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `MANAGEMENT_AUTH_SECRET`
- `MANAGEMENT_SETUP_KEY`
- `MANAGEMENT_DEFAULT_PASSWORD`

## API Surface

Core API groups include:

- Health and service status
- Public restaurant/menu state
- Order creation, status updates, and payments
- Menu management
- Table management
- Audit logs
- Razorpay config and webhooks

## Deployment

For production deployment and Render setup, see [DEPLOYMENT.md](DEPLOYMENT.md).

## GitHub Placement

Place this file at the repository root as `README.md`.

If it is in the root directory, GitHub automatically renders it on your repository main page.
