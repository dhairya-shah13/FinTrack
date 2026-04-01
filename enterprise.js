/* ========== ENTERPRISE.JS — Enterprise Finance Logic ========== */

/* ========== CHOICES.JS INITIALIZATION ========== */
document.addEventListener('DOMContentLoaded', function () {
  const element = document.getElementById('category');
  if (element) {
    const choices = new Choices(element, {
      searchEnabled: true,
      itemSelectText: '',
      shouldSort: false,
      searchPlaceholderValue: 'Search categories...',
    });
    element.addEventListener('change', onEnterpriseCategoryChange);
    onEnterpriseCategoryChange();
  }

  // Initialize lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

/* ========== GLOBAL STATE ========== */
let enterpriseTransactions = [];
let assets = [];

/* ========== PAGE INIT (called by shared.js onAuthStateChanged) ========== */
function onUserReady(user) {
  const page = window.location.pathname.split('/').pop() || '';

  if (page === 'enterprise-dashboard.html') {
    fetchEnterpriseTransactions();
    updateProfileDisplay();
  } else if (page === 'enterprise-transactions.html') {
    fetchEnterpriseTransactions();
    updateProfileDisplay();
  } else if (page === 'enterprise-categories.html') {
    renderEnterpriseCategories();
    updateProfileDisplay();
  } else if (page === 'assets.html') {
    fetchEnterpriseTransactions();
    updateProfileDisplay();
  } else if (page === 'bills.html') {
    fetchEnterpriseTransactions();
    updateProfileDisplay();
  } else if (page === 'profile.html') {
    updateProfileDisplay();
  }
}

/* ========== FETCH ENTERPRISE TRANSACTIONS ========== */
async function fetchEnterpriseTransactions() {
  try {
    const snapshot = await db.collection('transactions')
      .where('user_id', '==', currentUser.uid)
      .orderBy('created_at', 'desc')
      .get();

    enterpriseTransactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at ? doc.data().created_at.toDate().toISOString() : new Date().toISOString()
    }));

    // Auto-derive assets from transactions
    const maintenanceTxs = enterpriseTransactions.filter(t => t.category === "Maintenance" && t.asset_id);
    assets = enterpriseTransactions
      .filter(t => t.category === "Assets")
      .map(t => {
        const assetMaintenance = maintenanceTxs.filter(m => m.asset_id === t.id);
        return {
          id: t.id,
          user_id: t.user_id,
          name: t.note || `Asset - ${t.bill_number || 'Unknown'}`,
          purchase_date: t.created_at,
          value: t.amount,
          category: "Assets",
          description: t.note || "",
          maintenance_count: assetMaintenance.length,
          maintenance_spend: assetMaintenance.reduce((sum, m) => sum + Number(m.amount || 0), 0),
          bill_number: t.bill_number,
          transaction_id: t.id,
          created_at: t.created_at
        };
      });

    const page = window.location.pathname.split('/').pop() || '';
    if (page === 'enterprise-dashboard.html') {
      calculateEnterprise();
    } else if (page === 'enterprise-transactions.html') {
      renderEnterpriseTransactions(enterpriseTransactions);
    } else if (page === 'bills.html') {
      renderBillGroups();
    } else if (page === 'assets.html') {
      renderAssets();
    }
  } catch (err) {
    console.error("Error loading enterprise transactions:", err);
    if (err.code === 'failed-precondition') {
      console.warn("Firestore index is being built. This may take a few minutes.");
    }
  }
}

/* ========== ADD ENTERPRISE TRANSACTION ========== */
async function addEnterpriseTransaction() {
  const amountInput = document.getElementById("amount");
  const noteInput = document.getElementById("note");
  const billNumberInput = document.getElementById("bill-number");
  const amountVal = amountInput.value;
  const category = document.getElementById("category").value;
  const note = noteInput.value.trim();
  const billNumber = billNumberInput.value.trim();
  const amountError = document.getElementById("amount-error");
  if (amountError) amountError.innerText = "";

  if (!amountVal) { if (amountError) amountError.innerText = "Please enter an amount"; return; }
  const amount = Number(amountVal);
  if (amount <= 0) { if (amountError) amountError.innerText = "Values cannot be negative"; return; }
  if (!billNumber) { if (amountError) amountError.innerText = "Bill Number is required for enterprise transactions"; return; }

  try {
    const payload = {
      amount,
      category,
      bill_number: billNumber,
      user_id: currentUser.uid,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (note) payload.note = note;
    const docRef = await db.collection('transactions').add(payload);

    amountInput.value = "";
    noteInput.value = "";
    billNumberInput.value = "";
    onEnterpriseCategoryChange();
    toggleAddTxSection();
    fetchEnterpriseTransactions();
    if (window.location.pathname.split('/').pop() === 'enterprise-dashboard.html') {
      fetchAssets();
    }
  } catch (err) {
    console.error("Error adding enterprise transaction:", err);
    if (amountError) amountError.innerText = "Error: " + (err.message || err.toString());
  }
}

/* ========== UI LOGIC ========== */
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
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function onEnterpriseCategoryChange() {
  const catEl = document.getElementById("category");
  if (!catEl) return;
  const cat = catEl.value;
  const noteInput = document.getElementById("note");
  if (noteInput) {
    if (cat === "Assets") {
      noteInput.placeholder = "Enter asset name/description...";
    } else if (cat === "Miscellaneous Business Expenses") {
      noteInput.placeholder = "Describe the expense...";
    } else {
      noteInput.placeholder = "Add a brief note...";
    }
  }
}

function filterEnterpriseByTimePeriod(period) {
  if (period === "all") {
    renderEnterpriseTransactions(enterpriseTransactions);
    return;
  }

  const now = new Date();
  let startDate, endDate;

  if (period === "this-week") {
    startDate = new Date(now);
    const day = startDate.getDay();
    const diff = day === 0 ? 6 : day - 1;
    startDate.setDate(startDate.getDate() - diff);
    startDate.setHours(0, 0, 0, 0);
    endDate = now;
  } else if (period === "last-week") {
    endDate = new Date(now);
    const day = endDate.getDay();
    const diff = day === 0 ? 6 : day - 1;
    endDate.setDate(endDate.getDate() - diff);
    endDate.setHours(0, 0, 0, 0);
    startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === "this-month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = now;
  } else if (period === "last-month") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  }

  const filtered = enterpriseTransactions.filter(t => {
    const txDate = new Date(t.created_at);
    return txDate >= startDate && txDate <= endDate;
  });

  renderEnterpriseTransactions(filtered);
}

/* ========== ENTERPRISE CALCULATIONS ========== */
function calculateEnterprise() {
  let revenue = 0, expenses = 0;
  const catTotals = {};

  enterpriseTransactions.forEach(t => {
    const amt = Number(t.amount);
    const cat = t.category || "Miscellaneous Business Expenses";
    if (isEnterpriseIncome(cat)) { revenue += amt; } else { expenses += amt; }
    if (!catTotals[cat]) catTotals[cat] = 0;
    catTotals[cat] += amt;
  });

  // Calculate asset-related stats
  let totalAssetValue = 0;
  let assetCount = assets.length;
  assets.forEach(a => { totalAssetValue += Number(a.value || 0); });

  // Count unique bills
  const uniqueBills = new Set(enterpriseTransactions.map(t => t.bill_number).filter(Boolean));
  const billCount = uniqueBills.size;

  // Update dashboard cards
  const revenueEl = document.getElementById("total-revenue");
  const expenseEl = document.getElementById("total-expenses");
  const assetValueEl = document.getElementById("total-asset-value");
  const billCountEl = document.getElementById("total-bills");
  const assetCountEl = document.getElementById("asset-count");

  if (revenueEl) revenueEl.innerText = "₹" + revenue.toLocaleString();
  if (expenseEl) expenseEl.innerText = "₹" + expenses.toLocaleString();
  if (assetValueEl) assetValueEl.innerText = "₹" + totalAssetValue.toLocaleString();
  if (billCountEl) billCountEl.innerText = billCount.toLocaleString();
  if (assetCountEl) assetCountEl.innerText = assetCount.toLocaleString();

  renderEnterpriseCharts(revenue, expenses, catTotals);
  renderEnterpriseTransactions(enterpriseTransactions);
}

/* ========== ENTERPRISE CHARTS ========== */
let entPieChart, entBarChart;
function renderEnterpriseCharts(revenue, expenses, catTotals) {
  const pieCanvas = document.getElementById("pieChart");
  const barCanvas = document.getElementById("barChart");
  if (!pieCanvas || !barCanvas) return;

  if (entPieChart) entPieChart.destroy();
  if (entBarChart) entBarChart.destroy();
  const pieLabels = Object.keys(catTotals);
  const pieData = Object.values(catTotals);
  const pieColors = pieLabels.map(c => enterpriseCategoryColors[c] || "#9CA3AF");

  entPieChart = new Chart(pieCanvas, {
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
        legend: { display: false },
        tooltip: {
          enabled: true,
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return ` ${label}: ₹${value.toLocaleString()} (${percentage}%)`;
            }
          }
        }
      }
    }
  });

  entBarChart = new Chart(barCanvas, {
    type: "bar",
    data: {
      labels: ["Revenue", "Expenses"],
      datasets: [{ data: [revenue, expenses], backgroundColor: ["#10B981", "#EF4444"], borderRadius: 12 }]
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

/* ========== ENTERPRISE TRANSACTIONS RENDER ========== */
function renderEnterpriseTransactions(listToRender) {
  const container = document.getElementById("txContainer");
  if (!container) return;
  container.innerHTML = "";
  const txs = listToRender || enterpriseTransactions;
  if (txs.length === 0) {
    container.innerHTML = "<p style='text-align:center; color:#64748B; padding: 2rem;'>No transactions found</p>";
    return;
  }
  const sorted = [...txs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  sorted.forEach(t => {
    const cat = t.category || "Miscellaneous Business Expenses";
    const isInc = isEnterpriseIncome(cat);
    const color = enterpriseCategoryColors[cat] || "#64748B";
    const dateObj = new Date(t.created_at);
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    let iconName = "briefcase";
    if (cat.toLowerCase().includes("revenue") || cat.toLowerCase().includes("client")) iconName = "wallet";
    if (cat.toLowerCase().includes("payroll")) iconName = "users";
    if (cat.toLowerCase().includes("rent") || cat.toLowerCase().includes("lease")) iconName = "home";
    if (cat.toLowerCase().includes("utilit")) iconName = "zap";
    if (cat.toLowerCase().includes("tax")) iconName = "receipt";
    if (cat.toLowerCase().includes("software") || cat.toLowerCase().includes("saas")) iconName = "monitor";
    if (cat.toLowerCase().includes("office")) iconName = "package";
    if (cat.toLowerCase().includes("travel")) iconName = "plane";
    if (cat.toLowerCase().includes("market")) iconName = "megaphone";
    if (cat.toLowerCase().includes("insur")) iconName = "shield";
    if (cat.toLowerCase().includes("legal")) iconName = "scale";
    if (cat.toLowerCase().includes("equip")) iconName = "wrench";
    if (cat.toLowerCase().includes("maint")) iconName = "settings";
    if (cat.toLowerCase().includes("invent")) iconName = "archive";
    if (cat.toLowerCase().includes("vendor")) iconName = "truck";
    if (cat.toLowerCase().includes("asset")) iconName = "landmark";
    if (cat.toLowerCase().includes("liabil")) iconName = "alert-triangle";
    if (cat.toLowerCase().includes("account")) iconName = "file-text";

    const item = document.createElement("div");
    item.className = `tx-item ${isInc ? 'income' : 'expense'}`;
    item.style.setProperty('--tx-status-color', color);
    item.innerHTML = `
      <div class="tx-icon"><i data-lucide="${iconName}" style="color: ${color}"></i></div>
      <div class="tx-details">
        <div class="tx-name">${cat}</div>
        ${t.bill_number ? `<div class="tx-bill-badge">Bill #${t.bill_number}</div>` : ''}
      </div>
      <div class="tx-date-col">${dateStr}</div>
      <div class="tx-time-col">${timeStr}</div>
      <div class="tx-amount-group">
        <div class="tx-amount" style="color: ${color}">
          ${isInc ? '+' : '-'}₹${Number(t.amount || 0).toLocaleString()}
        </div>
        ${t.note ? `<div class="tx-tag">${t.note}</div>` : `<div class="tx-tag">${isInc ? 'Income' : 'Expense'}</div>`}
      </div>
    `;
    container.appendChild(item);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ========== ENTERPRISE CATEGORIES RENDER ========== */
function renderEnterpriseCategories() {
  const incomeContainer = document.getElementById("incomeCategoriesList");
  const expenseContainer = document.getElementById("expenseCategoriesList");
  if (!incomeContainer || !expenseContainer) return;

  incomeContainer.innerHTML = "";
  expenseContainer.innerHTML = "";

  const sortedCategories = Object.keys(enterpriseCategoryColors).sort();

  sortedCategories.forEach(cat => {
    const color = enterpriseCategoryColors[cat];
    const isInc = isEnterpriseIncome(cat);
    const type = isInc ? "Income" : "Expense";
    const container = isInc ? incomeContainer : expenseContainer;

    const card = document.createElement("div");
    card.className = "category-card";
    card.innerHTML = `
      <div class="category-dot" style="background: ${color}"></div>
      <div class="category-info">
        <div class="category-name">${cat}</div>
        <div class="category-type">${type}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

/* ========== ASSET MANAGEMENT ========== */

function renderAssets() {
  const container = document.getElementById("assetsContainer");
  if (!container) return;
  container.innerHTML = "";

  if (assets.length === 0) {
    container.innerHTML = "<p style='text-align:center; color:#64748B; padding: 2rem;'>No assets found. Add a transaction with category \"Assets\" to create one.</p>";
    return;
  }

  // Group assets by bill_number
  const groups = {};
  assets.forEach(a => {
    const bn = a.bill_number || 'No Bill';
    if (!groups[bn]) groups[bn] = [];
    groups[bn].push(a);
  });

  // Sort groups by earliest asset date
  const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
    const dateA = new Date(groups[a][0].created_at);
    const dateB = new Date(groups[b][0].created_at);
    return dateB - dateA;
  });

  sortedGroupKeys.forEach(billNum => {
    const groupAssets = groups[billNum].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const totalValue = groupAssets.reduce((sum, a) => sum + Number(a.value || 0), 0);

    const groupEl = document.createElement("div");
    groupEl.className = "asset-group";
    groupEl.innerHTML = `
      <div class="asset-group-header">
        <div class="asset-group-title">
          <i data-lucide="file-text" style="width:18px;height:18px;"></i>
          Bill #${billNum}
        </div>
        <div class="asset-group-meta">
          <span>${groupAssets.length} asset${groupAssets.length > 1 ? 's' : ''}</span>
          <span>•</span>
          <span>₹${totalValue.toLocaleString()}</span>
        </div>
      </div>
    `;

    groupAssets.forEach(asset => {
      const dateObj = new Date(asset.purchase_date || asset.created_at);
      const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const mCount = asset.maintenance_count || 0;
      const mSpend = asset.maintenance_spend || 0;

      const card = document.createElement("div");
      card.className = "asset-card";
      card.innerHTML = `
        <div class="asset-card-header">
          <div class="asset-card-icon"><i data-lucide="landmark" style="color: #059669;"></i></div>
          <div class="asset-card-info">
            <div class="asset-card-name">${asset.name || 'Unnamed Asset'}</div>
            <div class="asset-card-date">${dateStr}</div>
          </div>
          <div class="asset-card-value">₹${Number(asset.value || 0).toLocaleString()}</div>
        </div>
        ${asset.description ? `<div class="asset-card-desc">${asset.description}</div>` : ''}
        <div class="asset-card-footer">
          <div class="maintenance-stats">
            <div class="maintenance-info">
              <i data-lucide="wrench" style="width:14px;height:14px;color:var(--text-muted);"></i>
              <span>Maintenance: <strong>${mCount}</strong></span>
            </div>
            <div class="maintenance-info maintenance-spend-info">
              <i data-lucide="indian-rupee" style="width:14px;height:14px;color:var(--text-muted);"></i>
              <span>Spent: <strong>₹${mSpend.toLocaleString()}</strong></span>
            </div>
          </div>
          <button class="maintenance-btn" onclick="openMaintenanceModal('${asset.id}', '${(asset.name || 'Asset').replace(/'/g, "\\'")}'  )">
            <i data-lucide="plus" style="width:14px;height:14px;"></i> Maintenance
          </button>
        </div>
      `;
      groupEl.appendChild(card);
    });

    container.appendChild(groupEl);
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ========== MAINTENANCE MODAL ========== */
let maintenanceAssetId = null;
let maintenanceAssetName = '';

function openMaintenanceModal(assetId, assetName) {
  maintenanceAssetId = assetId;
  maintenanceAssetName = assetName || 'Asset';
  const modal = document.getElementById('maintenanceModal');
  const backdrop = document.getElementById('maintenanceBackdrop');
  const titleEl = document.getElementById('maintenanceAssetTitle');
  const noteInput = document.getElementById('maintenanceNote');
  const amountInput = document.getElementById('maintenanceAmount');
  const errorEl = document.getElementById('maintenance-error');

  if (titleEl) titleEl.innerText = `Add Maintenance — ${maintenanceAssetName}`;
  if (noteInput) noteInput.value = '';
  if (amountInput) amountInput.value = '';
  if (errorEl) errorEl.innerText = '';

  if (modal) modal.style.display = 'block';
  if (backdrop) backdrop.style.display = 'block';
}

function closeMaintenanceModal() {
  const modal = document.getElementById('maintenanceModal');
  const backdrop = document.getElementById('maintenanceBackdrop');
  if (modal) modal.style.display = 'none';
  if (backdrop) backdrop.style.display = 'none';
  maintenanceAssetId = null;
  maintenanceAssetName = '';
}

async function submitMaintenance() {
  const noteInput = document.getElementById('maintenanceNote');
  const amountInput = document.getElementById('maintenanceAmount');
  const errorEl = document.getElementById('maintenance-error');
  const submitBtn = document.getElementById('maintenanceSubmitBtn');

  const note = (noteInput ? noteInput.value.trim() : '');
  const amountVal = amountInput ? amountInput.value : '';

  // Validation
  if (!note) {
    if (errorEl) errorEl.innerText = 'Please enter a maintenance note.';
    return;
  }
  if (!amountVal) {
    if (errorEl) errorEl.innerText = 'Please enter the maintenance amount.';
    return;
  }
  const amount = Number(amountVal);
  if (isNaN(amount) || amount <= 0) {
    if (errorEl) errorEl.innerText = 'Amount must be a number greater than 0.';
    return;
  }
  if (!maintenanceAssetId) {
    if (errorEl) errorEl.innerText = 'No asset selected. Please try again.';
    return;
  }

  // Find the parent asset to get its bill_number
  const parentAsset = assets.find(a => a.id === maintenanceAssetId);
  const billNumber = parentAsset ? parentAsset.bill_number : '';

  // Disable submit button during save
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Saving...';
  }

  try {
    const payload = {
      amount,
      category: 'Maintenance',
      note: `[${maintenanceAssetName}] ${note}`,
      asset_id: maintenanceAssetId,
      user_id: currentUser.uid,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (billNumber) payload.bill_number = billNumber;

    await db.collection('transactions').add(payload);

    closeMaintenanceModal();
    showToast('Maintenance entry added successfully!');

    // Re-fetch all transactions to update everything
    await fetchEnterpriseTransactions();
  } catch (err) {
    console.error('Error adding maintenance transaction:', err);
    if (errorEl) errorEl.innerText = 'Failed to save. Please try again.';
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="check" style="width:16px;height:16px;"></i> Save Maintenance';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }
}

/* ========== TOAST NOTIFICATION ========== */
function showToast(message) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.innerHTML = `<i data-lucide="check-circle" style="width:18px;height:18px;color:#10B981;flex-shrink:0;"></i><span>${message}</span>`;
  container.appendChild(toast);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Auto-remove after 3s
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

/* ========== BILL MANAGEMENT ========== */
function renderBillGroups() {
  const container = document.getElementById("billsContainer");
  if (!container) return;
  container.innerHTML = "";

  if (enterpriseTransactions.length === 0) {
    container.innerHTML = "<p style='text-align:center; color:#64748B; padding: 2rem;'>No bills found. Add enterprise transactions with bill numbers to see them here.</p>";
    return;
  }

  // Group transactions by bill_number
  const groups = {};
  enterpriseTransactions.forEach(t => {
    const bn = t.bill_number || 'No Bill Number';
    if (!groups[bn]) groups[bn] = [];
    groups[bn].push(t);
  });

  // Sort groups by earliest transaction date
  const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
    const dateA = Math.min(...groups[a].map(t => new Date(t.created_at).getTime()));
    const dateB = Math.min(...groups[b].map(t => new Date(t.created_at).getTime()));
    return dateB - dateA;
  });

  // Search filter
  const searchInput = document.getElementById("billSearch");
  let filteredKeys = sortedGroupKeys;
  if (searchInput && searchInput.value.trim()) {
    const query = searchInput.value.trim().toLowerCase();
    filteredKeys = sortedGroupKeys.filter(key =>
      key.toLowerCase().includes(query) ||
      groups[key].some(t => (t.note || '').toLowerCase().includes(query) || (t.category || '').toLowerCase().includes(query))
    );
  }

  if (filteredKeys.length === 0) {
    container.innerHTML = "<p style='text-align:center; color:#64748B; padding: 2rem;'>No bills match your search.</p>";
    return;
  }

  filteredKeys.forEach(billNum => {
    const txs = groups[billNum].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const totalAmount = txs.reduce((s, t) => s + Number(t.amount || 0), 0);
    const earliestDate = new Date(Math.min(...txs.map(t => new Date(t.created_at).getTime())));
    const dateStr = earliestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const groupEl = document.createElement("div");
    groupEl.className = "bill-group";
    groupEl.innerHTML = `
      <div class="bill-group-header" onclick="this.parentElement.classList.toggle('expanded')">
        <div class="bill-group-left">
          <i data-lucide="receipt" style="width:20px;height:20px;color:var(--accent-green);"></i>
          <div>
            <div class="bill-group-number">Bill #${billNum}</div>
            <div class="bill-group-date">${dateStr} • ${txs.length} transaction${txs.length > 1 ? 's' : ''}</div>
          </div>
        </div>
        <div class="bill-group-right">
          <div class="bill-group-total">₹${totalAmount.toLocaleString()}</div>
          <i data-lucide="chevron-down" class="bill-chevron" style="width:18px;height:18px;color:var(--text-muted);"></i>
        </div>
      </div>
      <div class="bill-group-body">
        ${txs.map(t => {
          const cat = t.category || 'Misc';
          const isInc = isEnterpriseIncome(cat);
          const color = enterpriseCategoryColors[cat] || '#64748B';
          const d = new Date(t.created_at);
          return `
            <div class="bill-tx-row">
              <div class="bill-tx-cat" style="color: ${color}">${cat}</div>
              <div class="bill-tx-date">${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
              <div class="bill-tx-amount" style="color: ${color}">${isInc ? '+' : '-'}₹${Number(t.amount).toLocaleString()}</div>
              ${t.note ? `<div class="bill-tx-note">${t.note}</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
    container.appendChild(groupEl);
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function searchBills() {
  renderBillGroups();
}

/* ========== ENTERPRISE REPORTING ========== */
function getFilteredEnterpriseByPeriod(period) {
  if (period === "all") return [...enterpriseTransactions];

  const now = new Date();
  let startDate, endDate;

  if (period === "this-week") {
    startDate = new Date(now);
    const day = startDate.getDay();
    const diff = day === 0 ? 6 : day - 1;
    startDate.setDate(startDate.getDate() - diff);
    startDate.setHours(0, 0, 0, 0);
    endDate = now;
  } else if (period === "last-week") {
    endDate = new Date(now);
    const day = endDate.getDay();
    const diff = day === 0 ? 6 : day - 1;
    endDate.setDate(endDate.getDate() - diff);
    endDate.setHours(0, 0, 0, 0);
    startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === "this-month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = now;
  } else if (period === "last-month") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  }

  return enterpriseTransactions.filter(t => {
    const txDate = new Date(t.created_at);
    return txDate >= startDate && txDate <= endDate;
  });
}

function getEnterprisePeriodLabel(period) {
  const labels = {
    "all": "All Transactions",
    "this-week": "This Week",
    "last-week": "Last Week",
    "this-month": "This Month",
    "last-month": "Last Month"
  };
  return labels[period] || "Report";
}

function toggleEnterpriseReportMenu() {
  const menu = document.getElementById("reportMenu");
  if (menu) menu.style.display = menu.style.display === "none" ? "block" : "none";
}

// Close menu on outside click
document.addEventListener("click", function(e) {
  const wrapper = document.querySelector(".report-dropdown-wrapper");
  const menu = document.getElementById("reportMenu");
  if (menu && wrapper && !wrapper.contains(e.target)) {
    menu.style.display = "none";
  }
});

async function downloadEnterpriseReport(period) {
  const menu = document.getElementById("reportMenu");
  if (menu) menu.style.display = "none";

  const filtered = getFilteredEnterpriseByPeriod(period);

  if (filtered.length === 0) {
    alert("No transactions found for the selected period.");
    return;
  }

  let income = 0, expense = 0;
  const catTotals = {};
  filtered.forEach(t => {
    const amt = Number(t.amount);
    const cat = t.category || "Miscellaneous Business Expenses";
    if (isEnterpriseIncome(cat)) { income += amt; } else { expense += amt; }
    if (!catTotals[cat]) catTotals[cat] = 0;
    catTotals[cat] += amt;
  });
  const balance = income - expense;

  const canvas = document.getElementById("reportPieChart");
  if (!canvas) { alert("Report generation not available on this page."); return; }
  canvas.style.display = "block";
  canvas.width = 400;
  canvas.height = 400;

  const pieLabels = Object.keys(catTotals);
  const pieData = Object.values(catTotals);
  const pieColors = pieLabels.map(c => enterpriseCategoryColors[c] || "#9CA3AF");

  const tempChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: pieLabels,
      datasets: [{
        data: pieData,
        backgroundColor: pieColors,
        borderWidth: 1,
        borderColor: "#ffffff"
      }]
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#333', font: { size: 10 } }
        }
      }
    }
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  const chartImage = canvas.toDataURL("image/png");
  tempChart.destroy();
  canvas.style.display = "none";

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(24);
  doc.setTextColor(26, 64, 55);
  doc.text("FinTrack", 14, 20);

  doc.setFontSize(14);
  doc.setTextColor(100);
  doc.text(`Enterprise Transaction Report — ${getEnterprisePeriodLabel(period)}`, 14, 30);

  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 14, 37);

  doc.setDrawColor(220);
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(14, 44, 55, 22, 3, 3, 'FD');
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("REVENUE", 18, 51);
  doc.setFontSize(14);
  doc.setTextColor(16, 185, 129);
  doc.text(`₹${income.toLocaleString()}`, 18, 60);

  doc.setFillColor(254, 242, 242);
  doc.roundedRect(75, 44, 55, 22, 3, 3, 'FD');
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("EXPENSES", 79, 51);
  doc.setFontSize(14);
  doc.setTextColor(225, 29, 72);
  doc.text(`₹${expense.toLocaleString()}`, 79, 60);

  doc.setFillColor(239, 246, 255);
  doc.roundedRect(136, 44, 60, 22, 3, 3, 'FD');
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("NET CASH FLOW", 140, 51);
  doc.setFontSize(14);
  doc.setTextColor(balance >= 0 ? 16 : 225, balance >= 0 ? 185 : 29, balance >= 0 ? 129 : 72);
  doc.text(`₹${balance.toLocaleString()}`, 140, 60);

  doc.addImage(chartImage, "PNG", 30, 72, 150, 100);

  const tableData = filtered
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(t => {
      const d = new Date(t.created_at);
      const cat = t.category || "Miscellaneous Business Expenses";
      return [
        cat,
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        `${isEnterpriseIncome(cat) ? '+' : '-'}₹${Number(t.amount).toLocaleString()}`,
        t.bill_number || '-',
        t.note || (isEnterpriseIncome(cat) ? 'Income' : 'Expense')
      ];
    });

  doc.autoTable({
    startY: 178,
    head: [['Category', 'Date', 'Amount', 'Bill #', 'Note']],
    body: tableData,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      overflow: 'linebreak',
      cellPadding: 3
    },
    headStyles: {
      fillColor: [26, 64, 55],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [50, 50, 50]
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 28 },
      2: { halign: 'center', cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 'auto', fontSize: 7 }
    },
    margin: { left: 14, right: 14 },
    tableWidth: 'auto',
    didParseCell: function(data) {
      if (data.column.index === 2 && data.section === 'body') {
        const val = data.cell.raw;
        if (val.startsWith('+')) {
          data.cell.styles.textColor = [16, 185, 129];
        } else {
          data.cell.styles.textColor = [225, 29, 72];
        }
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(180);
    doc.text(`FinTrack Enterprise Report • Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
  }

  const periodSlug = period.replace('-', '_');
  doc.save(`FinTrack_Enterprise_${periodSlug}.pdf`);
}
