# 76JK API — Serverless Backend for Bonsai Journaling

This is the backend powering [76JK.com](https://76jk.com), a simple plant journaling platform built using AWS Lambda. It exposes endpoints for user management, plant tag tracking, photo uploads, and static HTML generation.

---

## 🚀 Features

- User registration and login with JWT authentication
- Email verification via AWS SNS
- Plant tag and entry management (CRUD)
- Image uploads to S3
- Static HTML generation with Puppeteer
- Cache invalidation via AWS CloudFront

---

## 📁 Directory Structure

Each `76JK_*.js` file is an AWS Lambda function. Example:

- `76JK_NewUser.js`: Register new users
- `76JK_EditEntry.js`: Update plant journal entries
- `76JK_GenerateStatic.js`: Create static snapshots for public viewing