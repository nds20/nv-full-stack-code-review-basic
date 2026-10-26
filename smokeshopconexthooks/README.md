# Smoke Shop Frontend

Modern, production-ready e-commerce frontend for a dispensary/smoke shop application built with React.

## Overview

Complete customer-facing e-commerce solution with age verification, product browsing, shopping cart, checkout, and order confirmation.

## Features

✅ **Age Verification Gate** - Compliance-first age verification  
✅ **Product Browsing** - Browse and search products  
✅ **Product Details** - Detailed product pages with images  
✅ **Shopping Cart** - Add/remove items, quantity control, promo codes  
✅ **Gift Messages** - Add gift messages to orders  
✅ **Checkout** - Full checkout with delivery & payment info  
✅ **Order Confirmation** - Order confirmation screen  
✅ **Responsive Design** - Mobile-first, fully responsive  
✅ **Form Validation** - Comprehensive client-side validation  
✅ **Context API** - State management with React Context  

## Architecture

### Contexts
- **AuthContext** - User authentication and verification state
- **CartContext** - Shopping cart management with promo codes
- **ProductsContext** - Product data and search

### Hooks
- **useAuth** - Access authentication context
- **useCart** - Access cart context
- **useProducts** - Access products context

### Components
- **App** - Main application with routing
- **AgeGate** - Age verification gate
- **LoginPage** - User authentication
- **ProductsPage** - Product listing
- **ProductDetailPage** - Product detail view
- **CartPage** - Shopping cart
- **CheckoutPage** - Checkout form
- **OrderConfirmationPage** - Order confirmation

## Installation

```bash
cd smokeshopfrontend
npm install
npm run dev
```

## Tech Stack

- **React 18+** - UI library
- **React Context** - State management
- **CSS-in-JS** - Inline styling
- **Vite** - Build tool (recommended)

## Code Quality

- Component-based architecture
- Clean separation of concerns
- Comprehensive form validation
- Accessibility features (aria labels, semantic HTML)
- Mobile-responsive design
- Production-ready code

## Environment Variables

None required for frontend-only development.

## Future Enhancements

- Payment processor integration (Stripe, Square)
- User account system
- Order history
- Product reviews
- Wishlist functionality
- Advanced search and filtering
