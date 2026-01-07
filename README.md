# 💸 CashFlow — Modern Personal Finance App

**CashFlow One** is a modern, responsive React Native (Expo) app for tracking your personal finances.  
It helps you manage all your **income, expenses, and balance**, with beautiful charts, dark/light mode, Google Sign-In, and full synchronization via **Node.js + MongoDB Atlas** backend.

---

## 🚀 Features

- 📊 **Track income and expenses** with category, amount, and note  
- 💰 **Automatic balance calculation** (profit/loss detection)  
- 🌗 **Dynamic Light/Dark mode** with system theme auto-detection  
- 💵 **Multi-currency support** (€, $, £, ¥, etc.)  
- 📱 **Responsive layout** that adapts to all screen sizes  
- 🔐 **Authentication**
  - Sign in with **Google**
  - Register/Login with **email + password**
  - OTP verification for mobile number (optional)
- ☁️ **Cloud sync** with Node.js backend and MongoDB Atlas  
- 📈 **Visual charts**
  - 7-day bar chart  
  - 12-month trend chart  
  - Top categories summary  
- ⚙️ **Settings page** for theme and currency preferences  
- 🧠 Built with clean, modern UI and TypeScript  

---

## 🛠️ Tech Stack

### Frontend (this repo)
- [Expo SDK 54+](https://docs.expo.dev/)
- [React Native 0.81+](https://reactnative.dev/)
- TypeScript 5.9+
- [expo-auth-session](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [react-native-safe-area-context](https://github.com/th3rdwave/react-native-safe-area-context)
- [@expo/vector-icons](https://docs.expo.dev/guides/icons/)
- [AsyncStorage](https://react-native-async-storage.github.io/async-storage/)

### Backend
- [Node.js](https://nodejs.org/)
- [Express](https://expressjs.com/)
- [MongoDB Atlas](https://www.mongodb.com/atlas)
- [Mongoose](https://mongoosejs.com/)
- Google OAuth2 (`google-auth-library`)

---

## ⚙️ Environment Setup

### 1️⃣ Clone the repository
```bash
git clone https://github.com/gabriel9010/cashflow.git
cd cashflow-one
