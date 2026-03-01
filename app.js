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

/* ---------- FIREBASE INITIALIZATION ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyAbAxOFts_ixYNIuSLOvGDEne_JZlkNlV4",
  authDomain: "fintrack-e0c62.firebaseapp.com",
  projectId: "fintrack-e0c62",
  storageBucket: "fintrack-e0c62.firebasestorage.app",
  messagingSenderId: "1012328637288",
  appId: "1:1012328637288:web:cc76134963fae0be4eecdd",
  measurementId: "G-9XS4GQ23Y5"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let transactions = [];
let currentUser = null;

/* ---------- AUTH LOGIC ---------- */
async function checkUser() {
  const user = auth.currentUser;
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
    // Check if the user entered a username instead of email
    let loginEmail = username;

    // If input doesn't look like an email, look up the email from profiles
    if (!username.includes('@')) {
      const snapshot = await db.collection('profiles')
        .where('username_lowercase', '==', username.toLowerCase())
        .limit(1)
        .get();

      if (!snapshot.empty) {
        loginEmail = snapshot.docs[0].data().email;
      }
      // If not found, try using the input as-is (will fail at auth if wrong)
    }

    console.log("Attempting sign-in with email/identifier:", loginEmail);

    await auth.signInWithEmailAndPassword(loginEmail, password);

    // clear fields after successful login
    usernameField.value = "";
    passwordField.value = "";
  } catch (err) {
    console.error('login failed', err);
    if (err.code === 'auth/network-request-failed') {
      errorDiv.innerText = "Network Error: Could not reach Firebase. Check your internet connection.";
    } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      errorDiv.innerText = "Invalid email/username or password.";
    } else if (err.code === 'auth/invalid-email') {
      errorDiv.innerText = "Please enter a valid email address.";
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

  if (!username || !email || !password) {
    errorDiv.style.color = "var(--accent-red)";
    errorDiv.innerText = "All fields are required.";
    return;
  }

  try {
    console.log("Starting signup check for username:", username);

    // Step 1: Check if username exists in profiles
    const snapshot = await db.collection('profiles')
      .where('username_lowercase', '==', username.toLowerCase())
      .limit(1)
      .get();

    if (!snapshot.empty) {
      errorDiv.style.color = "var(--accent-red)";
      errorDiv.innerText = "Username already taken. Please choose another.";
      return;
    }

    console.log("Proceeding to auth.createUser with email:", email);

    // Step 2: Firebase signUp
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Step 3: Create profile document in Firestore
    await db.collection('profiles').doc(user.uid).set({
      username: username,
      username_lowercase: username.toLowerCase(),
      email: email,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log("Signup success for user:", user.uid);
    errorDiv.style.color = "var(--accent-green)";
    errorDiv.innerText = "Signup successful! You can now log in.";

    // Clear fields
    usernameField.value = "";
    emailField.value = "";
    passwordField.value = "";

    // Sign out so user can log in manually
    await auth.signOut();
    setTimeout(() => switchAuthMode('login'), 2000);
  } catch (err) {
    console.error("Caught error in handleSignup:", err);
    errorDiv.style.color = "var(--accent-red)";
    if (err.code === 'auth/network-request-failed') {
      errorDiv.innerText = "Network Error: Could not reach Firebase. Check your internet connection.";
    } else if (err.code === 'auth/email-already-in-use') {
      errorDiv.innerText = "This email is already registered. Please log in instead.";
    } else if (err.code === 'auth/weak-password') {
      errorDiv.innerText = "Password should be at least 6 characters.";
    } else if (err.code === 'auth/invalid-email') {
      errorDiv.innerText = "Please enter a valid email address.";
    } else {
      errorDiv.innerText = err.message || "An unexpected error occurred.";
    }
  }
}

async function handleLogout() {
  await auth.signOut();
  window.location.reload();
}

/* ---------- API INTERACTIONS (FIRESTORE) ---------- */
async function fetchTransactions() {
  try {
    const snapshot = await db.collection('transactions')
      .where('user_id', '==', currentUser.uid)
      .orderBy('created_at', 'desc')
      .get();

    transactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to ISO string for compatibility
      created_at: doc.data().created_at ? doc.data().created_at.toDate().toISOString() : new Date().toISOString()
    }));

    calculate();
  } catch (err) {
    console.error("Error loading transactions:", err);
    // If index not ready yet, show a helpful message
    if (err.code === 'failed-precondition') {
      console.warn("Firestore index is being built. This may take a few minutes.");
    }
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
      user_id: currentUser.uid,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (note) payload.note = note;

    await db.collection('transactions').add(payload);

    amountInput.value = "";
    noteInput.value = "";
    onCategoryChange();
    toggleAddTxSection();
    fetchTransactions();
  } catch (err) {
    console.error("Error adding transaction:", err);
    if (amountError) amountError.innerText = "Failed to save to database.";
  }
}

async function updateProfileDisplay() {
  if (!currentUser) return;
  try {
    const doc = await db.collection('profiles').doc(currentUser.uid).get();

    if (doc.exists) {
      const data = doc.data();
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
auth.onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    document.getElementById("auth-overlay").classList.add("hidden");
    fetchTransactions();
    updateProfileDisplay();
  } else {
    currentUser = null;
    document.getElementById("auth-overlay").classList.remove("hidden");
  }
});

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
      user_id: currentUser.uid,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('transactions').add(payload);

    document.getElementById("amount").value = "";
    document.getElementById("note").value = "";
    if (document.getElementById("splitRow")) document.getElementById("splitRow").classList.remove("visible");
    document.getElementById("splitCount").value = "2";
    onCategoryChange();
    toggleAddTxSection();
    fetchTransactions();
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
