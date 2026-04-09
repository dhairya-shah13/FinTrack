/* ========== THEME MANAGEMENT ========== */
(function initTheme() {
  const saved = localStorage.getItem('fintrack-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('fintrack-theme', next);
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const icon = btn.querySelector('[data-lucide]');
  if (icon) {
    icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

document.addEventListener('DOMContentLoaded', updateThemeIcon);

/* ========== MOBILE NAV MANAGEMENT ========== */
function toggleMobileNav() {
  const navLinks = document.querySelector('.nav-links');
  const hamburger = document.getElementById('hamburgerBtn');
  if (!navLinks || !hamburger) return;
  navLinks.classList.toggle('mobile-open');
  hamburger.classList.toggle('active');
  // Prevent body scroll when menu is open
  document.body.style.overflow = navLinks.classList.contains('mobile-open') ? 'hidden' : '';
}

// Close mobile nav when a link is clicked
document.addEventListener('DOMContentLoaded', function() {
  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach(link => {
    link.addEventListener('click', function() {
      const nav = document.querySelector('.nav-links');
      const hamburger = document.getElementById('hamburgerBtn');
      if (nav && nav.classList.contains('mobile-open')) {
        nav.classList.remove('mobile-open');
        if (hamburger) hamburger.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });
});

/* ========== FIREBASE INITIALIZATION ========== */
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

let currentUser = null;
let currentAccountType = null;

/* ========== ENTERPRISE CATEGORY CONFIG ========== */
const enterpriseIncomeCategories = ["Revenue", "Client Payments"];

const enterpriseCategoryColors = {
  "Revenue": "#10B981",
  "Client Payments": "#34D399",
  "Accounts Receivable": "#3B82F6",
  "Accounts Payable": "#60A5FA",
  "Payroll": "#8B5CF6",
  "Rent / Lease": "#A78BFA",
  "Utilities": "#6366F1",
  "Taxes": "#DC2626",
  "Software / SaaS": "#06B6D4",
  "Office Supplies": "#F59E0B",
  "Travel": "#F43F5E",
  "Marketing": "#EC4899",
  "Insurance": "#14B8A6",
  "Legal / Compliance": "#64748B",
  "Equipment": "#EF4444",
  "Maintenance": "#FB923C",
  "Inventory": "#FBBF24",
  "Vendor Payments": "#94A3B8",
  "Assets": "#059669",
  "Liabilities": "#E11D48",
  "Miscellaneous Business Expenses": "#9CA3AF"
};

function isEnterpriseIncome(category) {
  return enterpriseIncomeCategories.includes(category);
}

/* ========== ACCOUNT TYPE HELPERS ========== */
async function getAccountType(uid) {
  // Check cache first
  const cached = localStorage.getItem('fintrack-account-type');
  if (cached) return cached;

  try {
    const doc = await db.collection('profiles').doc(uid).get();
    if (doc.exists) {
      const type = doc.data().account_type || 'personal';
      localStorage.setItem('fintrack-account-type', type);
      return type;
    }
  } catch (err) {
    console.error('Error fetching account type:', err);
  }
  return 'personal';
}

function isEnterprisePage() {
  const page = window.location.pathname.split('/').pop() || '';
  return page.startsWith('enterprise-') || page === 'assets.html' || page === 'bills.html';
}

function isPersonalPage() {
  const page = window.location.pathname.split('/').pop() || '';
  return ['dashboard.html', 'transactions.html', 'categories.html', 'profile.html'].includes(page);
}

/* ========== AUTH STATE MANAGEMENT ========== */
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
const isLoginPage = (currentPage === 'login.html');
const isIndexPage = (currentPage === 'index.html' || currentPage === '' || currentPage === '/');

auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    currentAccountType = await getAccountType(user.uid);

    // If on login page or index, redirect based on account type
    if (isLoginPage || isIndexPage) {
      if (currentAccountType === 'enterprise') {
        window.location.href = 'enterprise-dashboard.html';
      } else {
        window.location.href = 'dashboard.html';
      }
      return;
    }

    // Redirect if user is on wrong mode pages
    if (currentAccountType === 'enterprise' && isPersonalPage() && currentPage !== 'profile.html') {
      window.location.href = 'enterprise-dashboard.html';
      return;
    }
    if (currentAccountType === 'personal' && isEnterprisePage()) {
      window.location.href = 'dashboard.html';
      return;
    }

    // User is logged in on a correct page — run page init if defined
    if (typeof onUserReady === 'function') {
      onUserReady(user);
    }
  } else {
    currentUser = null;
    currentAccountType = null;
    localStorage.removeItem('fintrack-account-type');
    // If not on login page, redirect to login
    if (!isLoginPage) {
      window.location.href = 'login.html';
      return;
    }
  }
});

/* ========== AUTH FUNCTIONS ========== */
function switchAuthMode(mode) {
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const errorDiv = document.getElementById("auth-error");

  if (errorDiv) {
    errorDiv.innerText = "";
    errorDiv.style.color = "var(--accent-red)";
  }
  if (mode === 'login') {
    if (loginForm) loginForm.classList.remove("hidden");
    if (signupForm) signupForm.classList.add("hidden");
  } else {
    if (loginForm) loginForm.classList.add("hidden");
    if (signupForm) signupForm.classList.remove("hidden");
  }
}

async function handleLogin() {
  const usernameField = document.getElementById("login-username");
  const passwordField = document.getElementById("login-password");
  let username = usernameField.value.trim();
  const password = passwordField.value;
  const errorDiv = document.getElementById("auth-error");

  errorDiv.innerText = "";
  errorDiv.style.color = "var(--accent-red)";

  if (!username || !password) {
    errorDiv.innerText = "Please enter email/username and password.";
    return;
  }

  try {
    let loginEmail = username;
    if (!username.includes('@')) {
      const snapshot = await db.collection('profiles')
        .where('username_lowercase', '==', username.toLowerCase())
        .limit(1)
        .get();
      if (!snapshot.empty) {
        loginEmail = snapshot.docs[0].data().email;
      }
    }

    await auth.signInWithEmailAndPassword(loginEmail, password);
    usernameField.value = "";
    passwordField.value = "";
    // onAuthStateChanged will handle redirect
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

  // Get selected account type
  const accountTypeEl = document.querySelector('input[name="account-type"]:checked');
  const accountType = accountTypeEl ? accountTypeEl.value : 'personal';

  errorDiv.innerText = "Processing...";
  errorDiv.style.color = "var(--text-muted)";

  if (!username || !email || !password) {
    errorDiv.style.color = "var(--accent-red)";
    errorDiv.innerText = "All fields are required.";
    return;
  }

  try {
    const snapshot = await db.collection('profiles')
      .where('username_lowercase', '==', username.toLowerCase())
      .limit(1)
      .get();

    if (!snapshot.empty) {
      errorDiv.style.color = "var(--accent-red)";
      errorDiv.innerText = "Username already taken. Please choose another.";
      return;
    }

    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    await db.collection('profiles').doc(user.uid).set({
      username: username,
      username_lowercase: username.toLowerCase(),
      email: email,
      account_type: accountType,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    });

    errorDiv.style.color = "var(--accent-green)";
    errorDiv.innerText = "Signup successful! You can now log in.";

    usernameField.value = "";
    emailField.value = "";
    passwordField.value = "";

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
  localStorage.removeItem('fintrack-account-type');
  await auth.signOut();
  window.location.href = 'login.html';
}

/* ========== CATEGORY CONFIG ========== */
const incomeCategories = [
  "Salary", "Hourly Wages", "Overtime Pay", "Bonuses", "Commission",
  "Tips", "Freelance Income", "Contract Work", "Consulting Income",
  "Business Revenue", "Side Hustle Income", "Online Sales", "Service Income",
  "Affiliate Income", "Ad Revenue", "Subscription Revenue",
  "Dividends", "Interest Income", "Capital Gains", "Rental Income",
  "REIT Distributions", "Crypto Gains", "Bond Interest",
  "Unemployment Benefits", "Social Security", "Disability Benefits",
  "Child Support Received", "Pension", "Stimulus Payments", "Tax Refund",
  "Gift Received", "Inheritance", "Family Support",
  "Cashback Rewards", "Refunds/Reimbursements",
  "Other Income"
];

const categoryColors = {
  "Salary": "#10B981", "Hourly Wages": "#34D399", "Overtime Pay": "#6EE7B7",
  "Bonuses": "#059669", "Commission": "#047857", "Tips": "#A7F3D0",
  "Freelance Income": "#10B981", "Contract Work": "#34D399", "Consulting Income": "#059669",
  "Business Revenue": "#14B8A6", "Side Hustle Income": "#2DD4BF", "Online Sales": "#5EEAD4",
  "Service Income": "#0D9488", "Affiliate Income": "#0F766E", "Ad Revenue": "#14B8A6",
  "Subscription Revenue": "#2DD4BF",
  "Dividends": "#06B6D4", "Interest Income": "#22D3EE", "Capital Gains": "#67E8F9",
  "Rental Income": "#0891B2", "REIT Distributions": "#0E7490", "Crypto Gains": "#06B6D4",
  "Bond Interest": "#22D3EE",
  "Unemployment Benefits": "#34D399", "Social Security": "#6EE7B7",
  "Disability Benefits": "#A7F3D0", "Child Support Received": "#10B981",
  "Pension": "#059669", "Stimulus Payments": "#047857", "Tax Refund": "#34D399",
  "Gift Received": "#84CC16", "Inheritance": "#A3E635", "Family Support": "#BEF264",
  "Cashback Rewards": "#65A30D", "Refunds/Reimbursements": "#4D7C0F",
  "Other Income": "#047857",
  "Rent": "#3B82F6", "Mortgage": "#60A5FA", "Property Taxes": "#93C5FD",
  "HOA Fees": "#2563EB", "Home Insurance": "#1D4ED8",
  "Repairs & Maintenance": "#3B82F6", "Furniture": "#60A5FA", "Appliances": "#93C5FD",
  "Electricity": "#8B5CF6", "Water": "#A78BFA", "Gas": "#7C3AED",
  "Internet": "#6D28D9", "Cable TV": "#C4B5FD", "Mobile Phone": "#8B5CF6",
  "Trash Collection": "#A78BFA",
  "Groceries": "#F59E0B", "Dining Out": "#FBBF24", "Coffee": "#FCD34D",
  "Takeout": "#D97706", "Food Delivery": "#B45309",
  "Fuel": "#EF4444", "Public Transportation": "#F87171", "Car Payment": "#FCA5A5",
  "Car Insurance": "#DC2626", "Maintenance & Repairs": "#B91C1C",
  "Parking": "#EF4444", "Tolls": "#F87171", "Ride Sharing": "#FCA5A5",
  "Vehicle Registration": "#DC2626",
  "Health Insurance": "#14B8A6", "Doctor Visits": "#2DD4BF", "Dental": "#5EEAD4",
  "Vision": "#0D9488", "Medication": "#0F766E", "Therapy": "#14B8A6",
  "Gym Membership": "#2DD4BF",
  "Clothing": "#EC4899", "Shoes": "#F472B6", "Haircuts": "#F9A8D4",
  "Cosmetics": "#DB2777", "Subscriptions": "#BE185D", "Hobbies": "#EC4899",
  "Entertainment": "#F472B6", "Events": "#F9A8D4",
  "Travel": "#F43F5E", "Vacations": "#FB7185",
  "Credit Card Payment": "#64748B", "Loan Payment": "#94A3B8",
  "Student Loan": "#CBD5E1", "Bank Fees": "#475569", "Interest Paid": "#334155",
  "Investment Contributions": "#64748B", "Retirement Contributions": "#94A3B8",
  "Childcare": "#06B6D4", "School Fees": "#22D3EE", "Supplies": "#67E8F9",
  "Allowance": "#0891B2", "Activities": "#0E7490", "Babysitting": "#06B6D4",
  "Life Insurance": "#6366F1", "Car Insurance Premium": "#818CF8",
  "Home Insurance Premium": "#A5B4FC", "Travel Insurance": "#4F46E5",
  "Pet Insurance": "#4338CA",
  "Income Tax": "#DC2626", "Self-Employment Tax": "#EF4444",
  "Property Tax": "#F87171", "Capital Gains Tax": "#B91C1C",
  "Personal Loan Payment": "#F43F5E", "Payday Loan": "#FB7185",
  "Buy-Now-Pay-Later": "#FDA4AF", "Debt Settlement": "#E11D48",
  "Donations": "#D946EF", "Charity": "#E879F9",
  "Religious Contributions": "#F0ABFC", "Gifts Given": "#C026D3",
  "Pet Food": "#F97316", "Vet Visits": "#FB923C",
  "Pet Grooming": "#FDBA74", "Pet Supplies": "#EA580C",
  "Miscellaneous": "#9CA3AF"
};

function isIncome(category) {
  return incomeCategories.includes(category);
}

/* ========== NAVBAR ACTIVE STATE ========== */
document.addEventListener('DOMContentLoaded', function() {
  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && currentPage === href) {
      link.classList.add('active');
    } else if (!href || href === '#') {
      // skip
    } else {
      link.classList.remove('active');
    }
  });
});

/* ========== PROFILE DISPLAY ========== */
async function updateProfileDisplay() {
  if (!currentUser) return;
  try {
    const doc = await db.collection('profiles').doc(currentUser.uid).get();
    if (doc.exists) {
      const data = doc.data();
      const welcomeEl = document.getElementById("user-welcome");
      const profileName = document.getElementById("profile-name");
      const profileEmail = document.getElementById("profile-email");
      const profileType = document.getElementById("profile-account-type");
      const avatar = document.querySelector(".nav-avatar");

      if (welcomeEl) welcomeEl.innerText = `Welcome back, ${data.username}👋`;
      if (profileName) profileName.innerText = `Username: ${data.username}`;
      if (profileEmail) profileEmail.innerText = `Email: ${data.email}`;
      if (profileType) {
        const typeLabel = (data.account_type || 'personal') === 'enterprise' ? 'Enterprise' : 'Personal';
        profileType.innerText = `Account Type: ${typeLabel}`;
      }

      const initial = data.username ? data.username.charAt(0).toUpperCase() : '?';
      if (avatar) avatar.innerText = initial;
    }
  } catch (err) {
    console.error("Error updating profile display:", err);
  }
}

/* ========== APP DOWNLOAD UTILS ========== */
function toggleDownloadDropdown(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('downloadDropdown');
  if (!dropdown) return;
  if (dropdown.style.display === 'none' || dropdown.style.display === '') {
    dropdown.style.display = 'flex';
  } else {
    dropdown.style.display = 'none';
  }
}

document.addEventListener('click', function(event) {
  const wrapper = document.querySelector('.download-dropdown-wrapper');
  if (wrapper && !wrapper.contains(event.target)) {
    const dropdown = document.getElementById('downloadDropdown');
    if (dropdown && dropdown.style.display === 'flex') {
      dropdown.style.display = 'none';
    }
  }
});

function openIosTutorial() {
  const dropdown = document.getElementById('downloadDropdown');
  if (dropdown) dropdown.style.display = 'none';
  
  const backdrop = document.getElementById('modalBackdrop');
  if (backdrop) {
    backdrop.style.display = 'block';
    backdrop.onclick = closeIosTutorial;
  }
  
  const iosModal = document.getElementById('iosTutorialSection');
  if (iosModal) iosModal.style.display = 'block';
}

function closeIosTutorial() {
  const backdrop = document.getElementById('modalBackdrop');
  if (backdrop) {
    backdrop.style.display = 'none';
    backdrop.onclick = window.toggleAddTxSection; 
  }
  
  const iosModal = document.getElementById('iosTutorialSection');
  if (iosModal) iosModal.style.display = 'none';
}
