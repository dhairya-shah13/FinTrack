<![CDATA[<div align="center">

# 💰 FinTrack

**A modern personal finance tracker with real-time analytics**

[![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)](https://www.chartjs.org/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

*Track expenses, visualize spending habits, and split bills — all in one sleek dark-mode interface.*

---

</div>

## ✨ Features

| Feature | Description |
|---|---|
| 📊 **Dashboard** | At-a-glance summary cards showing Total Income, Total Expenses, and Balance |
| 🥧 **Pie Chart** | Category-wise breakdown of all transactions with distinct color-coded labels |
| 📈 **Bar Chart** | Side-by-side comparison of total Income vs Expenses |
| ➕ **Add Transactions** | Quick-add form with amount, category dropdown, and optional notes |
| ✂️ **Split Expenses** | Split any expense among multiple people and track your share |
| 🏷️ **17 Categories** | 13 expense categories + 4 income categories, each with unique colors |
| 🌙 **Dark Mode UI** | Premium glassmorphism design with DM Sans & Playfair Display typography |
| 🚀 **Vercel Deploy** | One-click deployment with pre-configured `vercel.json` |

---

## 🏗️ Tech Stack

```
Frontend  →  HTML5 · CSS3 · Vanilla JavaScript
Backend   →  Python Flask · Flask-CORS
Database  →  Supabase (PostgreSQL via REST API)
Charts    →  Chart.js
Icons     →  Lucide Icons
Fonts     →  Google Fonts (DM Sans, Playfair Display)
Deploy    →  Vercel (Serverless Python)
```

---

## 📁 Project Structure

```
FinTrack/
├── app.py              # Flask backend — REST API routes & Supabase integration
├── index.html          # Frontend — SPA with dashboard, transactions & profile
├── requirements.txt    # Python dependencies
├── vercel.json         # Vercel deployment configuration
├── .env                # Environment variables (Supabase credentials)
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.8+**
- A [Supabase](https://supabase.com/) account with a project set up

### 1. Clone the Repository

```bash
git clone https://github.com/dhairya-shah13/FinTrack.git
cd FinTrack
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
PORT=5000
```

### 4. Set Up Supabase Database

Create a `transactions` table in your Supabase project with the following columns:

| Column | Type | Notes |
|---|---|---|
| `id` | `int8` | Primary key, auto-increment |
| `amount` | `float8` | Transaction amount |
| `category` | `text` | Category name (e.g., Food, Salary) |
| `note` | `text` | Optional note / description |
| `created_at` | `timestamptz` | Auto-set to `now()` |

### 5. Run Locally

```bash
python app.py
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves the frontend (`index.html`) |
| `GET` | `/transactions` | Fetch all transactions from Supabase |
| `POST` | `/transactions` | Add a new transaction |

### POST `/transactions` — Request Body

```json
{
  "amount": 250,
  "category": "Food",
  "note": "Lunch with friends"
}
```

---

## 🏷️ Categories

<details>
<summary><b>Expense Categories (13)</b></summary>

| Category | Color |
|---|---|
| 🍔 Food | `#EF4444` |
| 🏠 Housing / Rent | `#F97316` |
| ⚡ Utilities | `#F59E0B` |
| 🚗 Transport | `#EAB308` |
| 💳 EMI | `#84CC16` |
| 🛡️ Insurance | `#22C55E` |
| 🛍️ Shopping | `#14B8A6` |
| 🎬 Entertainment | `#06B6D4` |
| 🏥 Health / Medical | `#0EA5E9` |
| 📈 Investments | `#3B82F6` |
| ✈️ Travel | `#6366F1` |
| 🎁 Gifts / Donations | `#8B5CF6` |
| ❓ Miscellaneous | `#A855F7` |

</details>

<details>
<summary><b>Income Categories (4)</b></summary>

| Category | Color |
|---|---|
| 💼 Salary | `#10B981` |
| 💻 Freelance | `#34D399` |
| 📊 Investment Return | `#6EE7B7` |
| 📦 Other | `#A7F3D0` |

</details>

---

## ☁️ Deployment (Vercel)

The project includes a `vercel.json` pre-configured for serverless Python deployment.

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

> [!IMPORTANT]
> Add your `SUPABASE_URL` and `SUPABASE_KEY` as **Environment Variables** in your Vercel project settings.

---

## 🛠️ Built With

- [Flask](https://flask.palletsprojects.com/) — Lightweight Python web framework
- [Supabase](https://supabase.com/) — Open-source Firebase alternative (PostgreSQL)
- [Chart.js](https://www.chartjs.org/) — Simple yet flexible charting library
- [Lucide Icons](https://lucide.dev/) — Beautiful open-source icon set
- [Google Fonts](https://fonts.google.com/) — DM Sans & Playfair Display

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">

**Made with ❤️ by [Dhairya Shah](https://github.com/dhairya-shah13)**

</div>
]]>