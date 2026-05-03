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
    element.addEventListener('change', onCategoryChange);
    onCategoryChange();
  }

  // Initialize lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

/* ========== GLOBAL STATE ========== */
let transactions = [];

/* ========== PAGE INIT (called by shared.js onAuthStateChanged) ========== */
function onUserReady(user) {
  fetchTransactions();
  updateProfileDisplay();

  // Auto-render categories if on categories page
  const categoriesSection = document.getElementById('categories');
  if (categoriesSection) {
    renderCategories();
  }
}

/* ========== API INTERACTIONS (FIRESTORE) ========== */
async function fetchTransactions() {
  try {
    const snapshot = await db.collection('transactions')
      .where('user_id', '==', currentUser.uid)
      .orderBy('created_at', 'desc')
      .get();

    transactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at ? doc.data().created_at.toDate().toISOString() : new Date().toISOString()
    }));

    calculate();
  } catch (err) {
    console.error("Error loading transactions:", err);
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

function onCategoryChange() {
  const catEl = document.getElementById("category");
  if (!catEl) return;
  const cat = catEl.value;
  const noteInput = document.getElementById("note");
  const splitBtn = document.getElementById("splitBtn");
  const splitRow = document.getElementById("splitRow");

  if (noteInput) {
    if (cat === "Miscellaneous" || cat === "Other") {
      noteInput.placeholder = cat === "Miscellaneous" ? "Describe the expense..." : "Describe the income...";
    } else {
      noteInput.placeholder = "Add a brief note...";
    }
  }

  if (splitBtn) {
    if (!isIncome(cat)) {
      splitBtn.classList.add("visible");
    } else {
      splitBtn.classList.remove("visible");
      if (splitRow) splitRow.classList.remove("visible");
    }
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

function filterByTimePeriod(period) {
  if (period === "all") {
    renderTransactions(transactions);
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

  const filtered = transactions.filter(t => {
    const txDate = new Date(t.created_at);
    return txDate >= startDate && txDate <= endDate;
  });

  renderTransactions(filtered);
}

function getFilteredByPeriod(period) {
  if (period === "all") return [...transactions];

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

  return transactions.filter(t => {
    const txDate = new Date(t.created_at);
    return txDate >= startDate && txDate <= endDate;
  });
}

function getPeriodLabel(period) {
  const labels = {
    "all": "All Transactions",
    "this-week": "This Week",
    "last-week": "Last Week",
    "this-month": "This Month",
    "last-month": "Last Month"
  };
  return labels[period] || "Report";
}

function toggleReportMenu() {
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

async function downloadReport(period) {
  const menu = document.getElementById("reportMenu");
  if (menu) menu.style.display = "none";

  const filtered = getFilteredByPeriod(period);

  if (filtered.length === 0) {
    alert("No transactions found for the selected period.");
    return;
  }

  let income = 0, expense = 0;
  const catTotals = {};
  filtered.forEach(t => {
    const amt = Number(t.amount);
    const cat = t.category || "Miscellaneous";
    if (isIncome(cat)) { income += amt; } else { expense += amt; }
    if (!catTotals[cat]) catTotals[cat] = 0;
    catTotals[cat] += amt;
  });
  const balance = income - expense;
  const txCount = filtered.length;
  const generatedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // --- Generate chart image ---
  const canvas = document.getElementById("reportPieChart");
  if (!canvas) { alert("Report generation not available on this page."); return; }
  canvas.style.display = "block";
  canvas.width = 300;
  canvas.height = 300;

  const pieLabels = Object.keys(catTotals);
  const pieData = Object.values(catTotals);
  const pieColors = pieLabels.map(c => categoryColors[c] || "#D3D0BC");

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
          position: 'bottom',
          labels: { color: '#4B5563', font: { size: 8 }, padding: 8 }
        }
      }
    }
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  const chartImage = canvas.toDataURL("image/png");
  tempChart.destroy();
  canvas.style.display = "none";

  // --- Build PDF ---
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pdfFont = await loadPDFFont(doc);
  doc.setFont(pdfFont, 'normal');
  const pw = doc.internal.pageSize.getWidth();   // 210
  const ph = doc.internal.pageSize.getHeight();   // 297
  const ml = 20, mr = 20;  // margins
  const cw = pw - ml - mr; // content width

  // =============================================
  // PAGE 1 — EXECUTIVE SUMMARY
  // =============================================

  // --- Header rule ---
  let y = 20;
  doc.setDrawColor(17, 24, 39);   // #111827
  doc.setLineWidth(0.6);
  doc.line(ml, y, pw - mr, y);

  // --- Title block ---
  y += 8;
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(20);
  doc.setTextColor(17, 24, 39);
  doc.text("FinTrack", ml, y);

  doc.setFont(pdfFont, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);  // #6B7280
  doc.text("Transaction Report", pw - mr, y - 4, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(getPeriodLabel(period), pw - mr, y + 1, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text(`Generated ${generatedDate}`, pw - mr, y + 6, { align: 'right' });

  // --- Thin separator ---
  y += 12;
  doc.setDrawColor(229, 231, 235);  // #E5E7EB
  doc.setLineWidth(0.3);
  doc.line(ml, y, pw - mr, y);

  // --- FINANCIAL SUMMARY section ---
  y += 10;
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text("FINANCIAL SUMMARY", ml, y);

  y += 8;
  const summaryCol1 = ml;
  const summaryCol2 = ml + cw * 0.25;
  const summaryCol3 = ml + cw * 0.5;
  const summaryCol4 = ml + cw * 0.75;

  // Helper to draw a summary block
  function drawSummaryBlock(x, label, value, valueColor) {
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);  // #9CA3AF
    doc.text(label, x, y);
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
    doc.text(value, x, y + 7);
  }

  drawSummaryBlock(summaryCol1, "TOTAL INCOME", `\u20B9${formatINR(income)}`, [22, 163, 74]);
  drawSummaryBlock(summaryCol2, "TOTAL EXPENSE", `\u20B9${formatINR(expense)}`, [220, 38, 38]);
  drawSummaryBlock(summaryCol3, "NET BALANCE", `\u20B9${formatINR(balance)}`, balance >= 0 ? [22, 163, 74] : [220, 38, 38]);
  drawSummaryBlock(summaryCol4, "TRANSACTIONS", `${txCount}`, [17, 24, 39]);

  // --- Underline below summary ---
  y += 14;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(ml, y, pw - mr, y);

  // --- Category Breakdown heading ---
  y += 10;
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text("CATEGORY BREAKDOWN", ml, y);

  y += 6;

  // --- Category breakdown as a minimal table ---
  const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const totalAll = income + expense;

  catEntries.forEach(([cat, amt]) => {
    const isInc = isIncome(cat);
    const pct = totalAll > 0 ? ((amt / totalAll) * 100).toFixed(1) : '0.0';

    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81); // #374151
    doc.text(cat, ml, y);

    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`${pct}%`, ml + 70, y);

    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(isInc ? 22 : 220, isInc ? 163 : 38, isInc ? 74 : 38);
    doc.text(`${isInc ? '+' : '-'}\u20B9${formatINR(amt)}`, pw - mr, y, { align: 'right' });

    y += 5;
  });

  // --- Small chart at bottom-right of page 1 ---
  if (chartImage) {
    doc.addImage(chartImage, "PNG", pw - mr - 70, ph - 95, 70, 70);
  }

  // =============================================
  // PAGE 2+ — TRANSACTION LEDGER
  // =============================================
  doc.addPage();

  // --- Ledger header on page 2 ---
  let ly = 20;
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.6);
  doc.line(ml, ly, pw - mr, ly);

  ly += 7;
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text("Transaction Ledger", ml, ly);

  doc.setFont(pdfFont, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text(`${getPeriodLabel(period)}  \u2022  ${txCount} entries`, pw - mr, ly, { align: 'right' });

  ly += 5;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(ml, ly, pw - mr, ly);

  // --- Transaction table data ---
  const tableData = filtered
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(t => {
      const d = new Date(t.created_at);
      const cat = t.category || "Miscellaneous";
      const sign = isIncome(cat) ? '+' : '-';
      return [
        cat,
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        `${sign}\u20B9${formatINR(t.amount)}`,
        t.note || (isIncome(cat) ? 'Income' : 'Expense')
      ];
    });

  // --- Content width for percentage columns ---
  const tableW = pw - ml - mr;

  doc.autoTable({
    startY: ly + 3,
    head: [['Category', 'Date', 'Time', 'Amount', 'Note']],
    body: tableData,
    showHead: 'everyPage',
    theme: 'striped',
    styles: {
      font: pdfFont,
      fontSize: 8,
      textColor: [55, 65, 81],
      lineColor: [229, 231, 235],
      lineWidth: 0.15,
      cellPadding: { top: 2.8, right: 3.4, bottom: 2.8, left: 3.4 },
      overflow: 'linebreak',
      valign: 'top'
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [107, 114, 128],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
      cellPadding: { top: 3, right: 3.4, bottom: 3, left: 3.4 },
      lineWidth: { bottom: 0.5 },
      lineColor: [229, 231, 235]
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [55, 65, 81]
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251]
    },
    columnStyles: {
      0: { cellWidth: tableW * 0.22, halign: 'left', overflow: 'linebreak' },
      1: { cellWidth: tableW * 0.15, halign: 'left' },
      2: { cellWidth: tableW * 0.12, halign: 'left' },
      3: { cellWidth: tableW * 0.14, halign: 'right', fontStyle: 'bold', overflow: 'visible' },
      4: { cellWidth: tableW * 0.37, halign: 'left', fontSize: 7.5, textColor: [107, 114, 128], overflow: 'linebreak' }
    },
    margin: { left: ml, right: mr, top: 20, bottom: 18 },
    tableWidth: tableW,
    tableLineColor: [229, 231, 235],
    tableLineWidth: 0.15,
    didParseCell: function(data) {
      if (data.column.index === 3 && data.section === 'body') {
        const val = data.cell.raw || '';
        if (val.startsWith('+')) {
          data.cell.styles.textColor = [22, 163, 74];
        } else {
          data.cell.styles.textColor = [220, 38, 38];
        }
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: function(data) {
      if (data.pageNumber > 1) {
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.3);
        doc.line(ml, 15, pw - mr, 15);

        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(7);
        doc.setTextColor(156, 163, 175);
        doc.text('Transaction Ledger (continued)', ml, 18);
        doc.text(`${getPeriodLabel(period)}`, pw - mr, 18, { align: 'right' });
      }
    }
  });

  // =============================================
  // FOOTER — All pages
  // =============================================
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = ph - 10;

    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(ml, footerY - 3, pw - mr, footerY - 3);

    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text("FinTrack Report", ml, footerY);
    doc.text(`Page ${i} of ${pageCount}`, pw / 2, footerY, { align: 'center' });
    doc.text(generatedDate, pw - mr, footerY, { align: 'right' });
  }

  const periodSlug = period.replace('-', '_');
  doc.save(`FinTrack_Report_${periodSlug}.pdf`);
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
  const formattedOriginal = "₹" + totalAmount.toLocaleString('en-IN');
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

/* ========== CATEGORIES RENDER ========== */
function renderCategories() {
  const incomeContainer = document.getElementById("incomeCategoriesList");
  const expenseContainer = document.getElementById("expenseCategoriesList");
  if (!incomeContainer || !expenseContainer) return;

  incomeContainer.innerHTML = "";
  expenseContainer.innerHTML = "";

  const sortedCategories = Object.keys(categoryColors).sort();

  sortedCategories.forEach(cat => {
    const color = categoryColors[cat];
    const isInc = isIncome(cat);
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

/* ========== CALCULATIONS ========== */
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
    document.getElementById("balance-big").innerText = "₹" + balance.toLocaleString('en-IN');
    document.getElementById("income-val").innerText = "₹" + income.toLocaleString('en-IN');
    document.getElementById("expense-val").innerText = "₹" + expense.toLocaleString('en-IN');
    const total = income + expense;
    const incPct = total > 0 ? (income / total) * 100 : 0;
    const expPct = total > 0 ? (expense / total) * 100 : 0;
    document.getElementById("income-bar").style.width = `${incPct}%`;
    document.getElementById("expense-bar").style.width = `${expPct}%`;
  }
  renderCharts(income, expense, catTotals);
  renderTransactions(transactions);
}

/* ========== CHARTS ========== */
let pieChart, barChart;
function renderCharts(income, expense, catTotals) {
  const pieCanvas = document.getElementById("pieChart");
  const barCanvas = document.getElementById("barChart");
  if (!pieCanvas || !barCanvas) return; // Skip if not on dashboard page

  if (pieChart) pieChart.destroy();
  if (barChart) barChart.destroy();
  const pieLabels = Object.keys(catTotals);
  const pieData = Object.values(catTotals);
  const pieColors = pieLabels.map(c => categoryColors[c] || "#D3D0BC");

  pieChart = new Chart(pieCanvas, {
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
          display: false
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return ` ${label}: ₹${value.toLocaleString('en-IN')} (${percentage}%)`;
            }
          }
        }
      }
    }
  });

  barChart = new Chart(barCanvas, {
    type: "bar",
    data: {
      labels: ["Income", "Expense"],
      datasets: [{ data: [income, expense], backgroundColor: ["#22C55E", "#EF4444"], borderRadius: 12 }]
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

/* ========== TRANSACTIONS RENDER ========== */
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
      <div class="tx-details"><div class="tx-name">${cat}</div></div>
      <div class="tx-date-col">${dateStr}</div>
      <div class="tx-time-col">${timeStr}</div>
      <div class="tx-amount-group">
        <div class="tx-amount" style="color: ${color}">
          ${isInc ? '+' : '-'}₹${Number(t.amount || 0).toLocaleString('en-IN')}
        </div>
        ${t.note ? `<div class="tx-tag">${t.note}</div>` : `<div class="tx-tag">${isInc ? 'Income' : 'Expense'}</div>`}
      </div>
    `;
    container.appendChild(item);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
