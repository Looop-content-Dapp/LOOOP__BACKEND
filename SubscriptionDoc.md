# Subscription API Documentation

## Overview
This API provides subscription management functionality for artists and users, including subscription plan creation, user subscriptions, payment processing via Paystack webhooks, and subscription management.

**Base URL:** `/api/subscriptions`

## Authentication
- **Artist Routes:** Requires `isValidArtist` middleware
- **User Routes:** Requires `isUser` middleware  
- **Webhook Routes:** No authentication (verified via Paystack signature)

---

## Artist Subscription Plan Management

### Create Subscription Plan
Create a new subscription plan for an artist.

**Endpoint:** `POST /artist/:artistId/plans`  
**Authentication:** Required (Artist)  
**Middleware:** `isValidArtist`

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `artistId` | String (ObjectId) | Yes | ID of the artist creating the plan |

#### Request Body
```json
{
  "name": "Premium Plan",
  "description": "Access to exclusive content and early releases",
  "price": {
    "amount": 9.99,
    "currency": "USD"
  },
  "benefits": [
    "Exclusive content access",
    "Early release access",
    "Direct messaging with artist"
  ],
  "duration": 30,
  "splitPercentage": {
    "platform": 20,
    "artist": 80
  }
}
```

#### Request Body Schema
| Field | Type | Required | Description | Default |
|-------|------|----------|-------------|---------|
| `name` | String | Yes | Name of the subscription plan | - |
| `description` | String | Yes | Description of the plan | - |
| `price` | Object | Yes | Price configuration | - |
| `price.amount` | Number | Yes | Price amount (min: 0) | - |
| `price.currency` | String | Yes | Currency code | "USD" |
| `benefits` | Array[String] | Yes | List of plan benefits | - |
| `duration` | Number | Yes | Plan duration in days (min: 1) | 30 |
| `splitPercentage` | Object | Yes | Revenue split configuration | - |
| `splitPercentage.platform` | Number | Yes | Platform percentage (0-100) | 20 |
| `splitPercentage.artist` | Number | Yes | Artist percentage (0-100) | 80 |

#### Success Response (201)
```json
{
  "success": true,
  "message": "Subscription plan created successfully",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "artistId": "64f8a1b2c3d4e5f6a7b8c9d1",
    "name": "Premium Plan",
    "description": "Access to exclusive content and early releases",
    "price": {
      "amount": 9.99,
      "currency": "USD"
    },
    "benefits": [
      "Exclusive content access",
      "Early release access",
      "Direct messaging with artist"
    ],
    "duration": 30,
    "splitPercentage": {
      "platform": 20,
      "artist": 80
    },
    "isActive": true,
    "subscriberCount": 0,
    "createdAt": "2023-09-06T10:30:00.000Z",
    "updatedAt": "2023-09-06T10:30:00.000Z"
  }
}
```

#### Error Responses
**404 - Artist Not Found**
```json
{
  "success": false,
  "message": "Artist not found"
}
```

**500 - Server Error**
```json
{
  "success": false,
  "message": "Error creating subscription plan",
  "error": "Detailed error message"
}
```

---

### Get Artist Subscription Plans
Retrieve all active subscription plans for an artist.

**Endpoint:** `GET /artist/:artistId/plans`  
**Authentication:** None

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `artistId` | String (ObjectId) | Yes | ID of the artist |

#### Success Response (200)
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "artistId": "64f8a1b2c3d4e5f6a7b8c9d1",
      "name": "Premium Plan",
      "description": "Access to exclusive content and early releases",
      "price": {
        "amount": 9.99,
        "currency": "USD"
      },
      "benefits": [
        "Exclusive content access",
        "Early release access"
      ],
      "duration": 30,
      "splitPercentage": {
        "platform": 20,
        "artist": 80
      },
      "isActive": true,
      "subscriberCount": 5,
      "createdAt": "2023-09-06T10:30:00.000Z",
      "updatedAt": "2023-09-06T10:30:00.000Z"
    }
  ]
}
```

#### Error Response (500)
```json
{
  "success": false,
  "message": "Error fetching subscription plans",
  "error": "Detailed error message"
}
```

---

## User Subscription Management

### Subscribe to Plan
Create a new subscription for a user to an artist's plan.

**Endpoint:** `POST /user/:userId/plan/:planId/subscribe`  
**Authentication:** Required (User)  
**Middleware:** `isUser`

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | String (ObjectId) | Yes | ID of the subscribing user |
| `planId` | String (ObjectId) | Yes | ID of the subscription plan |

#### Request Body
```json
{
  "paymentMethod": "card"
}
```

#### Request Body Schema
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `paymentMethod` | String | Yes | Payment method used |

#### Success Response (200)
```json
{
  "success": true,
  "message": "Subscription created successfully",
  "data": {
    "subscription": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d2",
      "userId": "64f8a1b2c3d4e5f6a7b8c9d3",
      "planId": "64f8a1b2c3d4e5f6a7b8c9d0",
      "artistId": "64f8a1b2c3d4e5f6a7b8c9d1",
      "status": "pending",
      "startDate": "2023-09-06T10:30:00.000Z",
      "endDate": "2023-10-06T10:30:00.000Z",
      "autoRenew": true,
      "paymentHistory": [
        {
          "amount": 9.99,
          "currency": "USD",
          "paymentMethod": "card",
          "transactionId": "trx_1234567890",
          "status": "pending",
          "timestamp": "2023-09-06T10:30:00.000Z"
        }
      ],
      "createdAt": "2023-09-06T10:30:00.000Z",
      "updatedAt": "2023-09-06T10:30:00.000Z"
    },
    "paymentUrl": "https://checkout.paystack.com/trx_1234567890"
  }
}
```

#### Error Responses
**404 - Plan Not Found**
```json
{
  "success": false,
  "message": "Subscription plan not found"
}
```

**400 - Already Subscribed**
```json
{
  "success": false,
  "message": "User already has an active subscription to this artist"
}
```

**400 - Payment Failed**
```json
{
  "success": false,
  "message": "Payment initialization failed",
  "error": "Payment error details"
}
```

**500 - Server Error**
```json
{
  "success": false,
  "message": "Error creating subscription",
  "error": "Detailed error message"
}
```

---

### Get User Subscriptions
Retrieve all active subscriptions for a user.

**Endpoint:** `GET /user/:userId/subscriptions`  
**Authentication:** Required (User)  
**Middleware:** `isUser`

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | String (ObjectId) | Yes | ID of the user |

#### Success Response (200)
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d2",
      "userId": "64f8a1b2c3d4e5f6a7b8c9d3",
      "planId": {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
        "name": "Premium Plan",
        "description": "Access to exclusive content",
        "price": {
          "amount": 9.99,
          "currency": "USD"
        },
        "benefits": ["Exclusive content access"],
        "duration": 30
      },
      "artistId": "64f8a1b2c3d4e5f6a7b8c9d1",
      "status": "active",
      "startDate": "2023-09-06T10:30:00.000Z",
      "endDate": "2023-10-06T10:30:00.000Z",
      "autoRenew": true,
      "paymentHistory": [
        {
          "amount": 9.99,
          "currency": "USD",
          "paymentMethod": "card",
          "transactionId": "trx_1234567890",
          "status": "success",
          "timestamp": "2023-09-06T10:30:00.000Z"
        }
      ]
    }
  ]
}
```

#### Error Response (500)
```json
{
  "success": false,
  "message": "Error fetching user subscriptions",
  "error": "Detailed error message"
}
```

---

### Cancel Subscription
Cancel a user's subscription (disables auto-renewal).

**Endpoint:** `POST /subscription/:subscriptionId/cancel`  
**Authentication:** Required (User)  
**Middleware:** `isUser`

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `subscriptionId` | String (ObjectId) | Yes | ID of the subscription to cancel |

#### Success Response (200)
```json
{
  "success": true,
  "message": "Subscription cancelled successfully"
}
```

#### Error Responses
**404 - Subscription Not Found**
```json
{
  "success": false,
  "message": "Subscription not found"
}
```

**500 - Server Error**
```json
{
  "success": false,
  "message": "Error cancelling subscription",
  "error": "Detailed error message"
}
```

---

## Payment Webhook

### Handle Subscription Payment
Webhook endpoint for processing Paystack payment notifications.

**Endpoint:** `POST /payment/webhook`  
**Authentication:** Paystack signature verification  
**Content-Type:** `application/json`

#### Headers
| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `x-paystack-signature` | String | Yes | Paystack webhook signature for verification |

#### Request Body
```json
{
  "reference": "trx_1234567890",
  "status": "success",
  "data": {
    "amount": 999,
    "currency": "NGN",
    "transaction_date": "2023-09-06T10:30:00.000Z",
    "reference": "trx_1234567890"
  }
}
```

#### Request Body Schema
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reference` | String | Yes | Transaction reference ID |
| `status` | String | Yes | Payment status (`success` or `failed`) |
| `data` | Object | Yes | Payment data from Paystack |

#### Success Response (200)
```json
{
  "success": true,
  "message": "Payment processed successfully"
}
```

#### Error Responses
**401 - Invalid Signature**
```json
{
  "success": false,
  "message": "Invalid signature"
}
```

**404 - Subscription Not Found**
```json
{
  "success": false,
  "message": "Subscription not found"
}
```

**500 - Server Error**
```json
{
  "success": false,
  "message": "Error processing payment",
  "error": "Detailed error message"
}
```

---

## Data Models

### ArtistSubscriptionPlan Schema
```javascript
{
  "_id": "ObjectId",
  "artistId": "ObjectId", // References Artist model
  "name": "String", // Required, trimmed
  "description": "String", // Required
  "price": {
    "amount": "Number", // Required, min: 0
    "currency": "String" // Required, default: "USD"
  },
  "benefits": ["String"], // Array of benefit strings
  "duration": "Number", // Required, min: 1, default: 30 (days)
  "splitPercentage": {
    "platform": "Number", // Required, 0-100, default: 20
    "artist": "Number" // Required, 0-100, default: 80
  },
  "isActive": "Boolean", // Default: true
  "subscriberCount": "Number", // Default: 0
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### UserSubscription Schema  
```javascript
{
  "_id": "ObjectId",
  "userId": "ObjectId", // References User model
  "planId": "ObjectId", // References ArtistSubscriptionPlan model
  "artistId": "ObjectId", // References Artist model
  "status": "String", // Enum: ['pending', 'active', 'cancelled', 'expired']
  "startDate": "Date", // Default: Date.now
  "endDate": "Date", // Required
  "autoRenew": "Boolean", // Default: true
  "cancellationDate": "Date", // Default: null
  "paymentHistory": [
    {
      "amount": "Number", // Required
      "currency": "String", // Required
      "paymentMethod": "String", // Required
      "transactionId": "String", // Required
      "status": "String", // Enum: ['pending', 'success', 'failed']
      "timestamp": "Date" // Default: Date.now
    }
  ],
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

---


## Error Handling
All endpoints return consistent error response format:
```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "Technical error details (optional)"
}
```

Common HTTP status codes used:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors, business logic violations)
- `401` - Unauthorized (invalid webhook signature)
- `404` - Resource Not Found
- `500` - Internal Server Error