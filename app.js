lucide.createIcons();

/* ---------- CHOICES.JS INITIALIZATION ---------- */
document.addEventListener('DOMContentLoaded', function () {
  const element = document.getElementById('category');
  const choices = new Choices(element, {
    searchEnabled: true,
    itemSelectText: '',
    shouldSort: false,
    searchPlaceholderValue: 'Search categories...',
  });

  // Choices.js hides the original select, so we listen to its forwarded change event
  element.addEventListener('change', onCategoryChange);

  // Trigger once to set initial state
  onCategoryChange();
});

/* ---------- SUPABASE INITIALIZATION ---------- */
const SUPABASE_URL = "https://zskikcqzewieatvuxcgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_vifQ2Cdn_d7bvucFqQE7pQ_py6FdvkY";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let transactions = [];
let currentUser = null;

/* ---------- AUTH LOGIC ---------- */
async function checkUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    currentUser = user;
    document.getElementById("auth-overlay").classList.add("hidden");
    fetchTransactions();
    updateProfileDisplay();
  } else {
    document.getElementById("auth-overlay").classList.remove("hidden");
  }
}

function switchAuthMode(mode) {
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const errorDiv = document.getElementById("auth-error");

  errorDiv.innerText = "";
  if (mode === 'login') {
    loginForm.classList.remove("hidden");
    signupForm.classList.add("hidden");
  } else {
    loginForm.classList.add("hidden");
    signupForm.classList.remove("hidden");
  }
}

async function handleLogin() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const errorDiv = document.getElementById("auth-error");
  errorDiv.innerText = "";

  if (!username || !password) {
    errorDiv.innerText = "Please enter username and password.";
    return;
  }

  try {
    // Step 1: Get email for the username from profiles table
    const { data, error: profileError } = await supabaseClient
      .from('profiles')
      .select('email')
      .eq('username', username)
      .single();

    if (profileError || !data) {
      errorDiv.innerText = "Username not found.";
      return;
    }

    // Step 2: Login with email and password
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: data.email,
      password: password
    });

    if (error) throw error;
  } catch (err) {
    errorDiv.innerText = err.message || "Invalid credentials.";
  }
}

async function handleSignup() {
  const username = document.getElementById("signup-username").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const errorDiv = document.getElementById("auth-error");
  errorDiv.innerText = "";

  if (!username || !email || !password) {
    errorDiv.innerText = "All fields are required.";
    return;
  }

  try {
    // Supabase signUp with metadata for the trigger to pick up
    const { error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { username: username }
      }
    });

    if (error) throw error;
    errorDiv.style.color = "var(--accent-green)";
    errorDiv.innerText = "Signup successful! Check your email for verification (if enabled) or try logging in.";
    setTimeout(() => switchAuthMode('login'), 2000);
  } catch (err) {
    errorDiv.innerText = err.message;
  }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  window.location.reload();
}

/* ---------- API INTERACTIONS (SUPABASE) ---------- */
async function fetchTransactions() {
  try {
    const { data, error } = await supabaseClient
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    transactions = data || [];
    calculate();
  } catch (err) {
    console.error("Error loading transactions:", err);
  }
}

async function addTransaction() {
  const amountVal = document.getElementById("amount").value;
  const category = document.getElementById("category").value;
  const note = document.getElementById("note").value.trim();
  const amountError = document.getElementById("amount-error");
  if (amountError) amountError.innerText = "";

  if (!amountVal) { if (amountError) amountError.innerText = "Please enter an amount"; return; }
  const amount = Number(amountVal);
  if (amount <= 0) { if (amountError) amountError.innerText = "Values cannot be negative"; return; }

  try {
    const payload = {
      amount,
      category,
      user_id: currentUser.id
    };
    if (note) payload.note = note;

    const { error } = await supabaseClient
      .from('transactions')
      .insert([payload]);

    if (!error) {
      document.getElementById("amount").value = "";
      document.getElementById("note").value = "";
      onCategoryChange();
      toggleAddTxSection();
      fetchTransactions();
    } else {
      throw error;
    }
  } catch (err) {
    console.error("Error adding transaction:", err);
    if (amountError) amountError.innerText = "Failed to save to database.";
  }
}

async function updateProfileDisplay() {
  if (!currentUser) return;
  try {
    const { data } = await supabaseClient
      .from('profiles')
      .select('username, email')
      .eq('id', currentUser.id)
      .single();

    if (data) {
      document.getElementById("user-welcome").innerText = `Welcome back, ${data.username}👋`;
      document.getElementById("profile-name").innerText = `Username: ${data.username}`;
      document.getElementById("profile-email").innerText = `Email: ${data.email}`;

      // Set initial in avatar
      const initial = data.username.charAt(0).toUpperCase();
      const avatar = document.querySelector(".nav-avatar");
      if (avatar) avatar.innerText = initial;
    }
  } catch (err) {
    console.error("Error updating profile display:", err);
  }
}

// Initialize Auth Listener
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    checkUser();
  } else if (event === 'SIGNED_OUT') {
    currentUser = null;
    document.getElementById("auth-overlay").classList.remove("hidden");
  }
});

// Initial check
checkUser();


/* ---------- CATEGORY CONFIG ---------- */
const incomeCategories = [
  "Salary", "Bonus", "Overtime", "Commission", "Freelance Income", "Side Hustle Income",
  "Interest Income", "Savings Account Interest", "Fixed Deposit Interest", "Recurring Deposit Interest",
  "Dividend Income", "Mutual Fund Profit", "Stock Profit", "Rental Income", "Gift Received",
  "Cash Gift", "Refund", "Purchase Refund", "Tax Refund", "Cashback", "Rewards",
  "Insurance Claim Received", "Scholarship", "Allowance", "Pocket Money", "Sale of Personal Item",
  "Sale of Vehicle", "Loan Received", "Investment Withdrawal", "Other Income"
];

const categoryColors = {
  "Salary": "#10B981", "Bonus": "#34D399", "Overtime": "#6EE7B7", "Commission": "#A7F3D0",
  "Freelance Income": "#059669", "Side Hustle Income": "#10B981", "Interest Income": "#34D399",
  "Savings Account Interest": "#6EE7B7", "Fixed Deposit Interest": "#A7F3D0", "Recurring Deposit Interest": "#059669",
  "Dividend Income": "#10B981", "Mutual Fund Profit": "#34D399", "Stock Profit": "#6EE7B7",
  "Rental Income": "#A7F3D0", "Gift Received": "#059669", "Cash Gift": "#10B981",
  "Refund": "#34D399", "Purchase Refund": "#6EE7B7", "Tax Refund": "#A7F3D0",
  "Cashback": "#059669", "Rewards": "#10B981", "Insurance Claim Received": "#34D399",
  "Scholarship": "#6EE7B7", "Allowance": "#A7F3D0", "Pocket Money": "#059669",
  "Sale of Personal Item": "#10B981", "Sale of Vehicle": "#34D399", "Loan Received": "#6EE7B7",
  "Investment Withdrawal": "#A7F3D0", "Other Income": "#059669",
  "Housing": "#EF4444", "Rent": "#F87171", "Home Loan EMI": "#FCA5A5", "Maintenance": "#FECACA",
  "Repairs": "#DC2626", "Furniture": "#EF4444", "Home Appliances": "#F87171",
  "Food": "#F59E0B", "Groceries": "#FBBF24", "Restaurant": "#FCD34D", "Fast Food": "#FDE68A",
  "Cafe": "#D97706", "Food Delivery": "#F59E0B", "Snacks": "#FBBF24", "Beverages": "#FCD34D",
  "Transportation": "#3B82F6", "Fuel": "#60A5FA", "Public Transport": "#93C5FD",
  "Taxi / Auto / Cab": "#BFDBFE", "Parking": "#2563EB", "Toll": "#3B82F6",
  "Vehicle Maintenance": "#60A5FA", "Vehicle Insurance": "#93C5FD",
  "Bills & Utilities": "#8B5CF6", "Electricity": "#A78BFA", "Water": "#C4B5FD",
  "Gas": "#DDD6FE", "Mobile Recharge": "#7C3AED", "Internet": "#8B5CF6",
  "Broadband": "#A78BFA", "Cable TV": "#C4B5FD", "OTT Subscription": "#DDD6FE",
  "Shopping": "#EC4899", "Clothes": "#F472B6", "Shoes": "#F9A8D4", "Accessories": "#FBCFE8",
  "Electronics": "#DB2777", "Gadgets": "#EC4899", "Home Items": "#F472B6",
  "Healthcare": "#14B8A6", "Doctor Fees": "#2DD4BF", "Medicines": "#5EEAD4",
  "Medical Tests": "#99F6E4", "Hospital Expenses": "#0D9488", "Health Insurance": "#14B8A6",
  "Education": "#6366F1", "Fees": "#818CF8", "Courses": "#A5B4FC",
  "Books": "#C7D2FE", "Stationery": "#4F46E5",
  "Entertainment": "#84CC16", "Movies": "#A3E635", "Games": "#BEF264",
  "Events": "#D9F99D", "Hobbies": "#65A30D", "Subscriptions": "#84CC16",
  "Personal Care": "#F97316", "Haircut": "#FB923C", "Salon": "#FDBA74",
  "Cosmetics": "#FED7AA", "Grooming": "#EA580C", "Gym": "#F97316",
  "Family": "#06B6D4", "Parents Support": "#22D3EE", "Child Expenses": "#67E8F9",
  "Financial": "#64748B", "Loan EMI": "#94A3B8", "Credit Card Bill Payment": "#CBD5E1",
  "Interest Paid": "#475569", "Bank Charges": "#64748B", "Late Fees": "#94A3B8", "Penalties": "#CBD5E1",
  "Travel": "#F43F5E", "Flight": "#FB7185", "Train": "#FDA4AF",
  "Bus": "#FECDD3", "Hotel": "#E11D48", "Vacation": "#F43F5E",
  "Gifts & Donations": "#D946EF", "Gifts Given": "#E879F9", "Charity": "#F0ABFC",
  "Religious Donation": "#F5D0FE", "Insurance": "#10B981", "Life Insurance Premium": "#34D399",
  "Health Insurance Premium": "#6EE7B7", "Vehicle Insurance Premium": "#A7F3D0",
  "Investments": "#3B82F6", "Mutual Fund Investment": "#60A5FA",
  "Stock Investment": "#93C5FD", "Gold Investment": "#BFDBFE", "Fixed Deposit": "#2563EB",
  "Taxes": "#EF4444", "Income Tax": "#F87171", "Professional Tax": "#FCA5A5",
  "Miscellaneous": "#64748B", "Emergency Expense": "#94A3B8", "Other Expense": "#CBD5E1"
};

function isIncome(category) {
  return incomeCategories.includes(category);
}

/* ---------- UI LOGIC ---------- */
function toggleAddTxSection() {
  const section = document.getElementById("addTxSection");
  const backdrop = document.getElementById("modalBackdrop");
  const fabIcon = document.querySelector("#fabAdd [data-lucide]");

  if (section && backdrop) {
    const isVisible = window.getComputedStyle(section).display === "block";
    if (isVisible) {
      section.style.display = "none";
      backdrop.style.display = "none";
      if (fabIcon) fabIcon.setAttribute("data-lucide", "plus");
    } else {
      section.style.display = "block";
      backdrop.style.display = "block";
      if (fabIcon) fabIcon.setAttribute("data-lucide", "x");
    }
    lucide.createIcons();
  }
}

function onCategoryChange() {
  const cat = document.getElementById("category").value;
  const noteInput = document.getElementById("note");
  const splitBtn = document.getElementById("splitBtn");
  const splitRow = document.getElementById("splitRow");

  if (cat === "Miscellaneous" || cat === "Other") {
    noteInput.placeholder = cat === "Miscellaneous" ? "Describe the expense..." : "Describe the income...";
  } else {
    noteInput.placeholder = "Add a brief note...";
  }

  if (!isIncome(cat)) {
    splitBtn.classList.add("visible");
  } else {
    splitBtn.classList.remove("visible");
    splitRow.classList.remove("visible");
  }
}

function toggleSplitRow() {
  const splitRow = document.getElementById("splitRow");
  if (splitRow) splitRow.classList.toggle("visible");
}

function filterByCategory(cat, btn) {
  document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
  if (btn) btn.classList.add("active");
  const filtered = cat === "All" ? transactions : transactions.filter(t => (t.category || "").toLowerCase().includes(cat.toLowerCase()));
  renderTransactions(filtered);
}

function filterTransactions(query) {
  const filtered = transactions.filter(t =>
    (t.category || "").toLowerCase().includes(query.toLowerCase()) ||
    (t.note && t.note.toLowerCase().includes(query.toLowerCase()))
  );
  renderTransactions(filtered);
}

async function addSplitTransaction() {
  const amountVal = document.getElementById("amount").value;
  const category = document.getElementById("category").value;
  const note = document.getElementById("note").value.trim();
  const splitCount = parseInt(document.getElementById("splitCount").value);
  const amountError = document.getElementById("amount-error");
  if (amountError) amountError.innerText = "";

  if (!amountVal) { if (amountError) amountError.innerText = "Please enter an amount"; return; }
  const totalAmount = Number(amountVal);
  if (totalAmount <= 0) { if (amountError) amountError.innerText = "Values cannot be negative"; return; }
  if (!splitCount || splitCount < 2) { if (amountError) amountError.innerText = "Split must be among at least 2 people"; return; }

  const userShare = Math.round((totalAmount / splitCount) * 100) / 100;
  const formattedOriginal = "₹" + totalAmount.toLocaleString();
  const splitNote = note
    ? `${note} (${formattedOriginal} split ${splitCount} ways)`
    : `${formattedOriginal} split ${splitCount} ways`;

  try {
    const payload = {
      amount: userShare,
      category,
      note: splitNote,
      user_id: currentUser.id
    };
    const { error } = await supabaseClient
      .from('transactions')
      .insert([payload]);

    if (!error) {
      document.getElementById("amount").value = "";
      document.getElementById("note").value = "";
      if (document.getElementById("splitRow")) document.getElementById("splitRow").classList.remove("visible");
      document.getElementById("splitCount").value = "2";
      onCategoryChange();
      toggleAddTxSection();
      fetchTransactions();
    } else {
      throw error;
    }
  } catch (err) {
    console.error("Error adding split transaction:", err);
    if (amountError) amountError.innerText = "Failed to save to database.";
  }
}

/* ---------- PAGE SWITCH ---------- */
function showPage(page) {
  document.querySelectorAll("section").forEach(s => s.style.display = "none");
  document.getElementById(page).style.display = "block";
  document.querySelectorAll(".nav-links a").forEach(a => a.classList.remove("active"));
  if (event && event.target) event.target.classList.add("active");
}

/* ---------- CALCULATIONS ---------- */
function calculate() {
  let income = 0, expense = 0;
  const catTotals = {};
  transactions.forEach(t => {
    const amt = Number(t.amount);
    const cat = t.category || "Miscellaneous";
    if (isIncome(cat)) { income += amt; } else { expense += amt; }
    if (!catTotals[cat]) catTotals[cat] = 0;
    catTotals[cat] += amt;
  });

  const balance = income - expense;
  if (document.getElementById("balance-big")) {
    document.getElementById("balance-big").innerText = "₹" + balance.toLocaleString();
    document.getElementById("income-val").innerText = "₹" + income.toLocaleString();
    document.getElementById("expense-val").innerText = "₹" + expense.toLocaleString();
    const total = income + expense;
    const incPct = total > 0 ? (income / total) * 100 : 0;
    const expPct = total > 0 ? (expense / total) * 100 : 0;
    document.getElementById("income-bar").style.width = `${incPct}%`;
    document.getElementById("expense-bar").style.width = `${expPct}%`;
  }
  renderCharts(income, expense, catTotals);
  renderTransactions(transactions);
}

/* ---------- CHARTS ---------- */
let pieChart, barChart;
function renderCharts(income, expense, catTotals) {
  if (pieChart) pieChart.destroy();
  if (barChart) barChart.destroy();
  const pieLabels = Object.keys(catTotals);
  const pieData = Object.values(catTotals);
  const pieColors = pieLabels.map(c => categoryColors[c] || "#64748B");

  pieChart = new Chart(document.getElementById("pieChart"), {
    type: "doughnut",
    data: {
      labels: pieLabels.length ? pieLabels : ["No Data"],
      datasets: [{
        data: pieData.length ? pieData : [1],
        backgroundColor: pieLabels.length ? pieColors : ["#334155"],
        borderWidth: 2,
        borderColor: "#111C36"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#64748B', usePointStyle: true, padding: 15, font: { size: 12 } }
        }
      }
    }
  });

  barChart = new Chart(document.getElementById("barChart"), {
    type: "bar",
    data: {
      labels: ["Income", "Expense"],
      datasets: [{ data: [income, expense], backgroundColor: ["#10B981", "#F87171"], borderRadius: 12 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { display: false }, ticks: { display: false }, border: { display: false } },
        x: { grid: { display: false }, ticks: { color: '#64748B', font: { weight: '600' } } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

/* ---------- TRANSACTIONS RENDER ---------- */
function renderTransactions(listToRender) {
  const container = document.getElementById("txContainer");
  if (!container) return;
  container.innerHTML = "";
  const txs = listToRender || transactions;
  if (txs.length === 0) {
    container.innerHTML = "<p style='text-align:center; color:#64748B; padding: 2rem;'>No transactions found</p>";
    return;
  }
  const sorted = [...txs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  sorted.forEach(t => {
    const cat = t.category || "Miscellaneous";
    const isInc = isIncome(cat);
    const color = categoryColors[cat] || "#64748B";
    const dateObj = new Date(t.created_at);
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const item = document.createElement("div");
    item.className = `tx-item ${isInc ? 'income' : 'expense'}`;
    let iconName = "shopping-bag";
    if (cat.toLowerCase().includes("food") || cat.toLowerCase().includes("dining") || cat.toLowerCase().includes("restaurant")) iconName = "utensils";
    if (cat.toLowerCase().includes("salary") || cat.toLowerCase().includes("income")) iconName = "wallet";
    if (cat.toLowerCase().includes("transport") || cat.toLowerCase().includes("travel") || cat.toLowerCase().includes("taxi")) iconName = "car";
    if (cat.toLowerCase().includes("bill") || cat.toLowerCase().includes("utility") || cat.toLowerCase().includes("mobile")) iconName = "zap";
    if (cat.toLowerCase().includes("shopping") || cat.toLowerCase().includes("clothes")) iconName = "shopping-cart";
    item.innerHTML = `
      <div class="tx-icon"><i data-lucide="${iconName}" style="color: ${color}"></i></div>
      <div class="tx-details"><div class="tx-name">${cat}</div><div class="tx-date">${dateStr} • ${timeStr}</div></div>
      <div class="tx-amount-group">
        <div class="tx-amount" style="color: ${isInc ? 'var(--accent-green)' : 'var(--accent-red)'}">
          ${isInc ? '+' : '-'}₹${Number(t.amount || 0).toLocaleString()}
        </div>
        ${t.note ? `<div class="tx-tag">${t.note}</div>` : `<div class="tx-tag">${isInc ? 'Income' : 'Expense'}</div>`}
      </div>
    `;
    container.appendChild(item);
  });
  lucide.createIcons();
}

fetchTransactions();
