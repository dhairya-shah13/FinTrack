# 💰 FinTrack

**A modern personal finance tracker with real-time analytics**

![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

> Track expenses, visualize spending habits, and split bills — all in one sleek dark-mode interface.

---

## ✨ Features

- 📊 **Dashboard** — At-a-glance summary cards for Total Income, Total Expenses, and Balance
- 🥧 **Pie Chart** — Category-wise breakdown of all transactions with color-coded labels
- 📈 **Bar Chart** — Side-by-side comparison of Income vs Expenses
- ➕ **Add Transactions** — Quick-add form with amount, category dropdown, and optional notes
- ✂️ **Split Expenses** — Split any expense among multiple people and track your share
- 🏷️ **17 Categories** — 13 expense + 4 income categories, each with unique colors
- 🌙 **Dark Mode UI** — Premium design with DM Sans & Playfair Display typography
- 🚀 **Vercel Deploy** — One-click deployment with pre-configured `vercel.json`

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Python Flask, Flask-CORS |
| Database | Supabase (PostgreSQL via REST API) |
| Charts | Chart.js |
| Icons | Lucide Icons |
| Fonts | Google Fonts (DM Sans, Playfair Display) |
| Deployment | Vercel (Serverless Python) |

---

## 📁 Project Structure

```
FinTrack/
├── app.py              # Flask backend — API routes & Supabase integration
├── index.html          # Frontend — SPA with dashboard, transactions & profile
├── requirements.txt    # Python dependencies
├── vercel.json         # Vercel deployment config
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

Create a `transactions` table in your Supabase project with these columns:

> **Note on authentication and profiles**
>
> The frontend looks up a user's email address by querying the `profiles` table using the
> supplied username before calling `auth.signInWithPassword`. If you have Row Level
> Security (RLS) enabled (which is the default), make sure there's a policy that
> allows anonymous/select access on the `username` (or at least on
> `username,email`) otherwise the lookup will always return nothing and you'll see
> a "Username not found" message even when a matching record exists. A simple
> policy that permits public read is:
>
> ```sql
> create policy "public select profiles" on profiles
>   for select using (true);
> ```
>
> Alternatively, change the login form to accept an email address directly.


| Column | Type | Notes |
|--------|------|-------|
| `id` | `int8` | Primary key, auto-increment |
| `amount` | `float8` | Transaction amount |
| `category` | `text` | Category name (e.g., Food, Salary) |
| `note` | `text` | Optional description |
| `created_at` | `timestamptz` | Auto-set to `now()` |

### 5. Run Locally

```bash
python app.py
```

Open **http://localhost:5000** in your browser.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Serves the frontend |
| `GET` | `/transactions` | Fetch all transactions |
| `POST` | `/transactions` | Add a new transaction |

**POST `/transactions`** — Request Body:

```json
{
  "amount": 250,
  "category": "Food",
  "note": "Lunch with friends"
}
```

---

## 🏷️ Categories

**Expense (13):** Food · Housing/Rent · Utilities · Transport · EMI · Insurance · Shopping · Entertainment · Health/Medical · Investments · Travel · Gifts/Donations · Miscellaneous

**Income (4):** Salary · Freelance · Investment Return · Other

---

## ☁️ Deployment (Vercel)

The project includes a `vercel.json` pre-configured for serverless Python deployment.

```bash
npm i -g vercel
vercel
```

> **⚠️ Important:** Add `SUPABASE_URL` and `SUPABASE_KEY` as Environment Variables in your Vercel project settings.

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

**Made with ❤️ by [Dhairya Shah](https://github.com/dhairya-shah13) & [Tanishq Mehta](https://github.com/gt228-tan)**