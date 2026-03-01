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
  // Employment Income
  "Salary", "Hourly Wages", "Overtime Pay", "Bonuses", "Commission",
  "Tips", "Freelance Income", "Contract Work", "Consulting Income",
  // Business Income
  "Business Revenue", "Side Hustle Income", "Online Sales", "Service Income",
  "Affiliate Income", "Ad Revenue", "Subscription Revenue",
  // Investment Income
  "Dividends", "Interest Income", "Capital Gains", "Rental Income",
  "REIT Distributions", "Crypto Gains", "Bond Interest",
  // Government & Benefits
  "Unemployment Benefits", "Social Security", "Disability Benefits",
  "Child Support Received", "Pension", "Stimulus Payments", "Tax Refund",
  // Gifts & Transfers
  "Gift Received", "Inheritance", "Family Support",
  "Cashback Rewards", "Refunds/Reimbursements",
  // Other
  "Other Income"
];

const categoryColors = {
  // ── INCOME ──────────────────────────────────

  // Employment Income — Greens
  "Salary": "#10B981",
  "Hourly Wages": "#34D399",
  "Overtime Pay": "#6EE7B7",
  "Bonuses": "#059669",
  "Commission": "#047857",
  "Tips": "#A7F3D0",
  "Freelance Income": "#10B981",
  "Contract Work": "#34D399",
  "Consulting Income": "#059669",

  // Business Income — Teals
  "Business Revenue": "#14B8A6",
  "Side Hustle Income": "#2DD4BF",
  "Online Sales": "#5EEAD4",
  "Service Income": "#0D9488",
  "Affiliate Income": "#0F766E",
  "Ad Revenue": "#14B8A6",
  "Subscription Revenue": "#2DD4BF",

  // Investment Income — Cyans
  "Dividends": "#06B6D4",
  "Interest Income": "#22D3EE",
  "Capital Gains": "#67E8F9",
  "Rental Income": "#0891B2",
  "REIT Distributions": "#0E7490",
  "Crypto Gains": "#06B6D4",
  "Bond Interest": "#22D3EE",

  // Government & Benefits — Emeralds
  "Unemployment Benefits": "#34D399",
  "Social Security": "#6EE7B7",
  "Disability Benefits": "#A7F3D0",
  "Child Support Received": "#10B981",
  "Pension": "#059669",
  "Stimulus Payments": "#047857",
  "Tax Refund": "#34D399",

  // Gifts & Transfers — Limes
  "Gift Received": "#84CC16",
  "Inheritance": "#A3E635",
  "Family Support": "#BEF264",
  "Cashback Rewards": "#65A30D",
  "Refunds/Reimbursements": "#4D7C0F",

  // Other Income
  "Other Income": "#047857",

  // ── EXPENSES ────────────────────────────────

  // Housing — Blues
  "Rent": "#3B82F6",
  "Mortgage": "#60A5FA",
  "Property Taxes": "#93C5FD",
  "HOA Fees": "#2563EB",
  "Home Insurance": "#1D4ED8",
  "Repairs & Maintenance": "#3B82F6",
  "Furniture": "#60A5FA",
  "Appliances": "#93C5FD",

  // Utilities — Violets
  "Electricity": "#8B5CF6",
  "Water": "#A78BFA",
  "Gas": "#7C3AED",
  "Internet": "#6D28D9",
  "Cable TV": "#C4B5FD",
  "Mobile Phone": "#8B5CF6",
  "Trash Collection": "#A78BFA",

  // Food — Ambers
  "Groceries": "#F59E0B",
  "Dining Out": "#FBBF24",
  "Coffee": "#FCD34D",
  "Takeout": "#D97706",
  "Food Delivery": "#B45309",

  // Transportation — Reds
  "Fuel": "#EF4444",
  "Public Transportation": "#F87171",
  "Car Payment": "#FCA5A5",
  "Car Insurance": "#DC2626",
  "Maintenance & Repairs": "#B91C1C",
  "Parking": "#EF4444",
  "Tolls": "#F87171",
  "Ride Sharing": "#FCA5A5",
  "Vehicle Registration": "#DC2626",

  // Health — Teals
  "Health Insurance": "#14B8A6",
  "Doctor Visits": "#2DD4BF",
  "Dental": "#5EEAD4",
  "Vision": "#0D9488",
  "Medication": "#0F766E",
  "Therapy": "#14B8A6",
  "Gym Membership": "#2DD4BF",

  // Personal & Lifestyle — Pinks
  "Clothing": "#EC4899",
  "Shoes": "#F472B6",
  "Haircuts": "#F9A8D4",
  "Cosmetics": "#DB2777",
  "Subscriptions": "#BE185D",
  "Hobbies": "#EC4899",
  "Entertainment": "#F472B6",
  "Events": "#F9A8D4",
  "Travel": "#F43F5E",
  "Vacations": "#FB7185",

  // Financial — Slates
  "Credit Card Payment": "#64748B",
  "Loan Payment": "#94A3B8",
  "Student Loan": "#CBD5E1",
  "Bank Fees": "#475569",
  "Interest Paid": "#334155",
  "Investment Contributions": "#64748B",
  "Retirement Contributions": "#94A3B8",

  // Family & Kids — Cyans
  "Childcare": "#06B6D4",
  "School Fees": "#22D3EE",
  "Supplies": "#67E8F9",
  "Allowance": "#0891B2",
  "Activities": "#0E7490",
  "Babysitting": "#06B6D4",

  // Insurance — Indigos
  "Life Insurance": "#6366F1",
  "Car Insurance Premium": "#818CF8",
  "Home Insurance Premium": "#A5B4FC",
  "Travel Insurance": "#4F46E5",
  "Pet Insurance": "#4338CA",

  // Taxes — Red-oranges
  "Income Tax": "#DC2626",
  "Self-Employment Tax": "#EF4444",
  "Property Tax": "#F87171",
  "Capital Gains Tax": "#B91C1C",

  // Debt — Roses
  "Personal Loan Payment": "#F43F5E",
  "Payday Loan": "#FB7185",
  "Buy-Now-Pay-Later": "#FDA4AF",
  "Debt Settlement": "#E11D48",

  // Giving — Fuchsias
  "Donations": "#D946EF",
  "Charity": "#E879F9",
  "Religious Contributions": "#F0ABFC",
  "Gifts Given": "#C026D3",

  // Pets — Oranges
  "Pet Food": "#F97316",
  "Vet Visits": "#FB923C",
  "Pet Grooming": "#FDBA74",
  "Pet Supplies": "#EA580C",

  // Miscellaneous — Grays
  "Miscellaneous": "#9CA3AF"
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
    if (cat.toLowerCase().includes("grocer") || cat.toLowerCase().includes("dining") || cat.toLowerCase().includes("takeout") || cat.toLowerCase().includes("food")) iconName = "utensils";
    if (cat.toLowerCase().includes("coffee")) iconName = "coffee";
    if (cat.toLowerCase().includes("salary") || cat.toLowerCase().includes("income") || cat.toLowerCase().includes("wage") || cat.toLowerCase().includes("bonus") || cat.toLowerCase().includes("revenue")) iconName = "wallet";
    if (cat.toLowerCase().includes("transport") || cat.toLowerCase().includes("travel") || cat.toLowerCase().includes("ride") || cat.toLowerCase().includes("fuel") || cat.toLowerCase().includes("car payment") || cat.toLowerCase().includes("parking")) iconName = "car";
    if (cat.toLowerCase().includes("electric") || cat.toLowerCase().includes("water") || cat.toLowerCase().includes("gas") || cat.toLowerCase().includes("internet") || cat.toLowerCase().includes("mobile") || cat.toLowerCase().includes("cable")) iconName = "zap";
    if (cat.toLowerCase().includes("cloth") || cat.toLowerCase().includes("shoes") || cat.toLowerCase().includes("shopping")) iconName = "shopping-cart";
    if (cat.toLowerCase().includes("health") || cat.toLowerCase().includes("doctor") || cat.toLowerCase().includes("dental") || cat.toLowerCase().includes("medic") || cat.toLowerCase().includes("therapy") || cat.toLowerCase().includes("vision")) iconName = "heart-pulse";
    if (cat.toLowerCase().includes("insurance") || cat.toLowerCase().includes("premium")) iconName = "shield";
    if (cat.toLowerCase().includes("pet") || cat.toLowerCase().includes("vet")) iconName = "paw-print";
    if (cat.toLowerCase().includes("loan") || cat.toLowerCase().includes("credit") || cat.toLowerCase().includes("bank") || cat.toLowerCase().includes("debt") || cat.toLowerCase().includes("interest paid")) iconName = "landmark";
    if (cat.toLowerCase().includes("donat") || cat.toLowerCase().includes("charit") || cat.toLowerCase().includes("gift") || cat.toLowerCase().includes("religious")) iconName = "heart";
    if (cat.toLowerCase().includes("tax")) iconName = "receipt";
    if (cat.toLowerCase().includes("gym") || cat.toLowerCase().includes("membership")) iconName = "dumbbell";
    if (cat.toLowerCase().includes("rent") || cat.toLowerCase().includes("mortgage") || cat.toLowerCase().includes("hoa") || cat.toLowerCase().includes("furniture") || cat.toLowerCase().includes("appliance")) iconName = "home";
    if (cat.toLowerCase().includes("child") || cat.toLowerCase().includes("school") || cat.toLowerCase().includes("babysit") || cat.toLowerCase().includes("allowance")) iconName = "baby";
    if (cat.toLowerCase().includes("vacation")) iconName = "plane";
    if (cat.toLowerCase().includes("entertain") || cat.toLowerCase().includes("hobby") || cat.toLowerCase().includes("event") || cat.toLowerCase().includes("subscri")) iconName = "tv";
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
