# Render deployment guide for TastyFoods

## 1. Prepare the app
- Make sure the project root contains package.json and server.js.
- The app already starts with:
  - npm start

## 2. Create a Render Web Service
- Go to Render and create a new Web Service.
- Connect this repository.
- Use the following settings:
  - Runtime: Node
  - Build Command: npm install
  - Start Command: npm start
  - Health Check Path: /api/health

## 3. Add environment variables
Set these in Render > Environment:

- NODE_ENV=production
- DATABASE_URL=your_postgres_connection_string
- PGSSL=true
- MANAGEMENT_AUTH_SECRET=generate_a_long_random_string
- MANAGEMENT_SETUP_KEY=choose_a_secret_setup_key
- MANAGEMENT_DEFAULT_PASSWORD=optional_default_password
- PUBLIC_DEFAULT_RESTAURANT_CODE=gandikotadosa
- RESTAURANT_DOMAIN_MAP=optional
- RAZORPAY_KEY_ID=optional
- RAZORPAY_KEY_SECRET=optional
- RAZORPAY_WEBHOOK_SECRET=optional

## 4. Database setup
Use either:
- Render Postgres Internal URL, if the web service and database are in the same Render account/region
- or the External Database URL if they are not

Important:
- The app requires PostgreSQL.
- The first startup creates the needed tables automatically.

## 5. Custom domain
If you have a separate domain:
1. In Render, add your custom domain under the service settings.
2. Update your DNS records to point to Render.
3. If you want per-restaurant domain routing, set RESTAURANT_DOMAIN_MAP like this:

Example:
- RESTAURANT_DOMAIN_MAP=food.example.com:gandikotadosa,shop.example.com:anotherrestaurant

This maps a host to a restaurant code.

## 6. Important URLs after deployment
- Public storefront: https://your-render-url/tastyfoods
- Admin panel: https://your-render-url/management.html
- Admin dashboard: https://your-render-url/admin-dashboard.html
- Health check: https://your-render-url/api/health

## 7. Recommended first login
- Register a restaurant through the admin flow.
- The restaurant will appear on the public TastyFoods storefront automatically after it is registered and has auth configured.
