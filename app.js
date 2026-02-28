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
const SUPABASE_URL = "https://vahpisvskwmxsqwbzcmp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yCHBZUFETPQN5hAwH1x4dQ_TBXLdzQc";
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
  errorDiv.style.color = "var(--accent-red)"; // Reset to red
  if (mode === 'login') {
    loginForm.classList.remove("hidden");
    signupForm.classList.add("hidden");
  } else {
    loginForm.classList.add("hidden");
    signupForm.classList.remove("hidden");
  }
}

async function handleLogin() {
  const usernameField = document.getElementById("login-username");
  const passwordField = document.getElementById("login-password");
  let username = usernameField.value.trim();
  const password = passwordField.value;
  const errorDiv = document.getElementById("auth-error");

  // reset any previous message
  errorDiv.innerText = "";
  errorDiv.style.color = "var(--accent-red)";

  if (!username || !password) {
    errorDiv.innerText = "Please enter email/username and password.";
    return;
  }

  try {
    // first attempt: look up the real email address attached to the username
    // use ILIKE so the check is case‑insensitive, and log the result for
    // easier debugging when the lookup fails (most often because of RLS)
    const { data, error: profileError } = await supabaseClient
      .from('profiles')
      .select('email')
      .ilike('username', username)
      .single();

    if (profileError) {
      console.error('profile lookup error', profileError);
      // if the error comes from row‑level security it will be surfaced here
      if (profileError.message && profileError.message.toLowerCase().includes('polic')) {
        errorDiv.innerText =
          "Cannot search users by username due to database policy. " +
          "Please sign in with your email or contact support.";
        return;
      }
      // fall through to generic message below
    }

    // if we got an email back we use it, otherwise assume the user entered
    // their email directly instead of a username
    const loginEmail = data?.email || username;
    console.log("Attempting sign-in with email/identifier:", loginEmail);

    const { error } = await supabaseClient.auth.signInWithPassword({
      email: loginEmail,
      password: password
    });

    if (error) throw error;

    // clear fields after successful login
    usernameField.value = "";
    passwordField.value = "";
  } catch (err) {
    console.error('login failed', err);
    if (err.message === "Failed to fetch") {
      errorDiv.innerText = "Network Error: Could not reach Supabase. Check your internet or project URL.";
    } else {
      errorDiv.innerText = err.message || "Invalid credentials.";
    }
  }
}

async function handleSignup() {
  const usernameField = document.getElementById("signup-username");
  const emailField = document.getElementById("signup-email");
  const passwordField = document.getElementById("signup-password");
  
  const username = usernameField.value.trim();
  const email = emailField.value.trim();
  const password = passwordField.value;
  const errorDiv = document.getElementById("auth-error");
  
  errorDiv.innerText = "Processing...";
  errorDiv.style.color = "var(--text-muted)";
  errorDiv.style.color = "var(--accent-red)";

  if (!username || !email || !password) {
    errorDiv.innerText = "All fields are required.";
    return;
  }

  try {
    console.log("Starting signup check for username:", username);
    
    // Step 1: Check if username exists in profiles (Optional check, if it fails due to network, we'll see)
    let existingUser = null;
    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle();
      
      if (error) {
        console.warn("Profile check returned an error (maybe SQL wasn't run?):", error);
      } else {
        existingUser = data;
      }
    } catch (checkErr) {
      console.error("Critical error during profile check:", checkErr);
      // We continue to signup anyway, let the auth layer handle emails
    }

    if (existingUser) {
      errorDiv.innerText = "Username already taken. Please choose another.";
      return;
    }

    console.log("Proceeding to auth.signUp with email:", email);
    
    // Step 2: Supabase signUp
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { username: username }
      }
    });

    if (authError) {
      console.error("Auth Signup Error:", authError);
      throw authError;
    }
    
    console.log("Signup success data:", authData);
    errorDiv.style.color = "var(--accent-green)";
    errorDiv.innerText = "Signup successful! You can now log in.";
    
    // Clear fields
    usernameField.value = "";
    emailField.value = "";
    passwordField.value = "";
    
    setTimeout(() => switchAuthMode('login'), 2000);
  } catch (err) {
    console.error("Caught error in handleSignup:", err);
    if (err.message === "Failed to fetch") {
      errorDiv.innerText = "Network Error: Could not reach Supabase. Check your internet or project URL.";
    } else {
      errorDiv.innerText = err.message || "An unexpected error occurred.";
    }
  }
}

// Proactive Connectivity Check
async function testSupabaseConnection() {
  try {
    const { error } = await supabaseClient.from('profiles').select('count', { count: 'exact', head: true });
    if (error && error.message === "Failed to fetch") {
      console.error("Supabase Connectivity Test Failed: Failed to fetch");
      const errorDiv = document.getElementById("auth-error");
      if (errorDiv) {
        errorDiv.innerText = "Initial Connection Warning: Cannot reach Supabase. Check your URL and Key.";
        errorDiv.style.color = "var(--accent-red)";
      }
    } else {
      console.log("Supabase Connectivity Test: Success or reachable.");
    }
  } catch (err) {
    console.warn("Supabase Connectivity Test error (expected if not logged in or invalid URL):", err);
  }
}

// Run test on load
testSupabaseConnection();

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
  const amountInput = document.getElementById("amount");
  const noteInput = document.getElementById("note");
  const amountVal = amountInput.value;
  const category = document.getElementById("category").value;
  const note = noteInput.value.trim();
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
      amountInput.value = "";
      noteInput.value = "";
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

      const initial = data.username ? data.username.charAt(0).toUpperCase() : '?';
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
  // Incomes - SHADES OF GREEN
  "Salary": "#10B981",
  "Bonus": "#34D399",
  "Overtime": "#6EE7B7",
  "Commission": "#10B981",
  "Freelance Income": "#059669",
  "Side Hustle Income": "#047857",
  "Interest Income": "#A7F3D0",
  "Savings Account Interest": "#34D399",
  "Fixed Deposit Interest": "#6EE7B7",
  "Recurring Deposit Interest": "#10B981",
  "Dividend Income": "#059669",
  "Mutual Fund Profit": "#34D399",
  "Stock Profit": "#6EE7B7",
  "Rental Income": "#A7F3D0",
  "Gift Received": "#10B981",
  "Cash Gift": "#059669",
  "Refund": "#34D399",
  "Purchase Refund": "#6EE7B7",
  "Tax Refund": "#A7F3D0",
  "Cashback": "#10B981",
  "Rewards": "#059669",
  "Insurance Claim Received": "#34D399",
  "Scholarship": "#6EE7B7",
  "Allowance": "#A7F3D0",
  "Pocket Money": "#10B981",
  "Sale of Personal Item": "#059669",
  "Sale of Vehicle": "#34D399",
  "Loan Received": "#6EE7B7",
  "Investment Withdrawal": "#A7F3D0",
  "Other Income": "#047857",

  // Expenses - DIVERSE COLORS
  "Housing": "#3B82F6", // Blue
  "Rent": "#60A5FA",
  "Home Loan EMI": "#93C5FD",
  "Maintenance": "#2563EB",
  "Repairs": "#1D4ED8",
  "Furniture": "#3B82F6",
  "Home Appliances": "#60A5FA",
  "Food": "#F59E0B", // Amber
  "Groceries": "#FBBF24",
  "Restaurant": "#FCD34D",
  "Fast Food": "#D97706",
  "Cafe": "#B45309",
  "Food Delivery": "#F59E0B",
  "Snacks": "#FBBF24",
  "Beverages": "#FCD34D",
  "Transportation": "#EF4444", // Red
  "Fuel": "#F87171",
  "Public Transport": "#FCA5A5",
  "Taxi / Auto / Cab": "#DC2626",
  "Parking": "#B91C1C",
  "Toll": "#EF4444",
  "Vehicle Maintenance": "#F87171",
  "Vehicle Insurance": "#FCA5A5",
  "Bills & Utilities": "#8B5CF6", // Violet
  "Electricity": "#A78BFA",
  "Water": "#C4B5FD",
  "Gas": "#7C3AED",
  "Mobile Recharge": "#6D28D9",
  "Internet": "#8B5CF6",
  "Broadband": "#A78BFA",
  "Cable TV": "#C4B5FD",
  "OTT Subscription": "#7C3AED",
  "Shopping": "#EC4899", // Pink
  "Clothes": "#F472B6",
  "Shoes": "#F9A8D4",
  "Accessories": "#DB2777",
  "Electronics": "#C026D3", // Fuchsia
  "Gadgets": "#E879F9",
  "Home Items": "#F0ABFC",
  "Healthcare": "#14B8A6", // Teal
  "Doctor Fees": "#2DD4BF",
  "Medicines": "#5EEAD4",
  "Medical Tests": "#0D9488",
  "Hospital Expenses": "#0F766E",
  "Health Insurance": "#14B8A6",
  "Education": "#6366F1", // Indigo
  "Fees": "#818CF8",
  "Courses": "#A5B4FC",
  "Books": "#4F46E5",
  "Stationery": "#4338CA",
  "Entertainment": "#84CC16", // Lime
  "Movies": "#A3E635",
  "Games": "#BEF264",
  "Events": "#65A30D",
  "Hobbies": "#4D7C0F",
  "Subscriptions": "#84CC16",
  "Personal Care": "#F97316", // Orange
  "Haircut": "#FB923C",
  "Salon": "#FDBA74",
  "Cosmetics": "#EA580C",
  "Grooming": "#C2410C",
  "Gym": "#F97316",
  "Family": "#06B6D4", // Cyan
  "Parents Support": "#22D3EE",
  "Child Expenses": "#67E8F9",
  "Financial": "#64748B", // Slate
  "Loan EMI": "#94A3B8",
  "Credit Card Bill Payment": "#CBD5E1",
  "Interest Paid": "#475569",
  "Bank Charges": "#334155",
  "Late Fees": "#64748B",
  "Penalties": "#94A3B8",
  "Travel": "#F43F5E", // Rose
  "Flight": "#FB7185",
  "Train": "#FDA4AF",
  "Bus": "#E11D48",
  "Hotel": "#F43F5E",
  "Vacation": "#FB7185",
  "Gifts & Donations": "#D946EF", // Fuchsia
  "Gifts Given": "#E879F9",
  "Charity": "#F0ABFC",
  "Religious Donation": "#C026D3",
  "Insurance": "#10B981", // Emerald (shared with income but usually specific)
  "Life Insurance Premium": "#059669",
  "Health Insurance Premium": "#047857",
  "Vehicle Insurance Premium": "#064E3B",
  "Investments": "#0EA5E9", // Sky
  "Mutual Fund Investment": "#38BDF8",
  "Stock Investment": "#7DD3FC",
  "Gold Investment": "#0284C7",
  "Fixed Deposit": "#0369A1",
  "Taxes": "#DC2626", // Red-orange
  "Income Tax": "#EF4444",
  "Professional Tax": "#F87171",
  "Miscellaneous": "#9ca3af", // Gray
  "Emergency Expense": "#6b7280",
  "Other Expense": "#4b5563"
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
  const pieColors = pieLabels.map(c => categoryColors[c] || "#D3D0BC");

  pieChart = new Chart(document.getElementById("pieChart"), {
    type: "doughnut",
    data: {
      labels: pieLabels.length ? pieLabels : ["No Data"],
      datasets: [{
        data: pieData.length ? pieData : [1],
        backgroundColor: pieLabels.length ? pieColors : ["#1A4037"],
        borderWidth: 2,
        borderColor: "#161616"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#D3D0BC', usePointStyle: true, padding: 15, font: { size: 12 } }
        }
      }
    }
  });

  barChart = new Chart(document.getElementById("barChart"), {
    type: "bar",
    data: {
      labels: ["Income", "Expense"],
      datasets: [{ data: [income, expense], backgroundColor: ["#10B981", "#EF4444"], borderRadius: 12 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { display: false }, ticks: { display: false }, border: { display: false } },
        x: { grid: { display: false }, ticks: { color: '#D3D0BC', font: { weight: '600' } } }
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
    item.style.setProperty('--tx-status-color', color);
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
        <div class="tx-amount" style="color: ${color}">
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
