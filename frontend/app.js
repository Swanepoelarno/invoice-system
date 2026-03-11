const API_URL = 'http://localhost:3000';

const form = document.getElementById('quoteForm');
const quotesList = document.getElementById('quotesList');
const quotesHeading = document.getElementById('quotesHeading');
const amountInput = document.getElementById('amount');

// Navigation
function showView(viewName) {
  document.querySelectorAll('.view').forEach(function(view) {
    view.classList.remove('active');
  });
  document.querySelectorAll('.nav-item').forEach(function(item) {
    item.classList.remove('active');
  });
  document.getElementById('view-' + viewName).classList.add('active');
  event.currentTarget.classList.add('active');
  fetchQuotes();
}

// VAT calculation
amountInput.addEventListener('input', function() {
  const amount = parseFloat(amountInput.value);
  if (!isNaN(amount)) {
    const final = amount * 1.15;
    document.getElementById('finalAmount').value = final.toFixed(2);
  } else {
    document.getElementById('finalAmount').value = '';
  }
});

window.onload = function() {
  fetchQuotes();
};

function fetchQuotes() {
  fetch(`${API_URL}/quotes`)
    .then(function(response) {
      return response.json();
    })
    .then(function(quotes) {
      displayQuotes(quotes);
      displayInvoices(quotes);
      updateDashboard(quotes);
      updateChart(quotes);
    });
}

form.addEventListener('submit', function(event) {
  event.preventDefault();

  const clientName = document.getElementById('clientName').value;
  const serviceDescription = document.getElementById('serviceDescription').value;
  const amount = document.getElementById('amount').value;
  const quoteDate = document.getElementById('quoteDate').value;

  if (!clientName || !serviceDescription || !amount || !quoteDate) {
    alert('Please fill in all fields before saving.');
    return;
  }

  fetch(`${API_URL}/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientName, serviceDescription, amount, quoteDate })
  })
    .then(function(response) {
      return response.json();
    })
    .then(function() {
      form.reset();
      document.getElementById('finalAmount').value = '';
      fetchQuotes();
    });
});

function updateStatus(id, newStatus) {
  fetch(`${API_URL}/quotes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  })
    .then(function() {
      fetchQuotes();
    });
}

let paymentChart = null;

function updateChart(quotes) {
  const grouped = {};

  quotes.forEach(function(quote) {
    const date = quote.quoteDate || quote.createdAt.split(' ')[0];
    if (!grouped[date]) {
      grouped[date] = { paid: 0, outstanding: 0 };
    }
    if (quote.status === 'Paid') {
      grouped[date].paid += parseFloat(quote.amount);
    } else {
      grouped[date].outstanding += parseFloat(quote.amount);
    }
  });

  const labels = Object.keys(grouped).sort();
  const paidData = labels.map(function(d) { return grouped[d].paid; });
  const outstandingData = labels.map(function(d) { return grouped[d].outstanding; });

  if (paymentChart) {
    paymentChart.destroy();
  }

  const ctx = document.getElementById('paymentChart').getContext('2d');
  paymentChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Paid',
          data: paidData,
          borderColor: '#27ae60',
          backgroundColor: 'rgba(39, 174, 96, 0.1)',
          tension: 0.4,
          pointRadius: 5,
          fill: true
        },
        {
          label: 'Outstanding',
          data: outstandingData,
          borderColor: '#e67e22',
          backgroundColor: 'rgba(230, 126, 34, 0.1)',
          tension: 0.4,
          pointRadius: 5,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title: {
          display: true,
          text: 'Paid vs Outstanding by Date',
          font: { size: 16 },
          color: '#1F3864'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) { return 'R' + value; }
          }
        }
      }
    }
  });
}

function updateDashboard(quotes) {
  const totalInvoiced = quotes.reduce(function(sum, quote) {
    return sum + parseFloat(quote.amount);
  }, 0);

  const totalPaid = quotes.reduce(function(sum, quote) {
    if (quote.status === 'Paid') {
      return sum + parseFloat(quote.amount);
    }
    return sum;
  }, 0);

  const totalOutstanding = totalInvoiced - totalPaid;

  document.getElementById('totalInvoiced').textContent = 'R' + totalInvoiced.toFixed(2);
  document.getElementById('totalPaid').textContent = 'R' + totalPaid.toFixed(2);
  document.getElementById('totalOutstanding').textContent = 'R' + totalOutstanding.toFixed(2);
}

function displayQuotes(quotes) {
  const filtered = quotes.filter(function(q) {
    return q.status === 'Draft' || q.status === 'Sent' || q.status === 'Approved';
  });

  if (filtered.length === 0) {
    quotesHeading.style.display = 'none';
    quotesList.innerHTML = '';
    return;
  }

  quotesHeading.style.display = 'block';
  quotesList.innerHTML = '';

  filtered.forEach(function(quote) {
    const card = document.createElement('div');
    card.className = 'quote-card';
    card.innerHTML = `
      <p><strong>Client:</strong> ${quote.clientName}</p>
      <p><strong>Service:</strong> ${quote.serviceDescription}</p>
      <p><strong>Date:</strong> ${quote.quoteDate || 'N/A'}</p>
      <p><strong>Amount:</strong> R${quote.amount}</p>
      <p><strong>Status:</strong> <span class="status">${quote.status}</span></p>
      <div class="actions">
        <button onclick="updateStatus(${quote.id}, 'Sent')">Mark as Sent</button>
        <button onclick="updateStatus(${quote.id}, 'Approved')">Mark as Approved</button>
        <button onclick="updateStatus(${quote.id}, 'Invoiced')">Mark as Invoiced</button>
      </div>
    `;
    quotesList.appendChild(card);
  });
}

function displayInvoices(quotes) {
  const invoicesList = document.getElementById('invoicesList');
  const filtered = quotes.filter(function(q) {
    return q.status === 'Invoiced' || q.status === 'Paid';
  });

  if (filtered.length === 0) {
    invoicesList.innerHTML = '<p style="color:#888; font-size:14px;">No invoices yet. Mark a quote as Invoiced to see it here.</p>';
    return;
  }

  invoicesList.innerHTML = '';

  filtered.forEach(function(quote) {
    const card = document.createElement('div');
    card.className = 'invoice-card';
    card.innerHTML = `
      <p><strong>Client:</strong> ${quote.clientName}</p>
      <p><strong>Service:</strong> ${quote.serviceDescription}</p>
      <p><strong>Date:</strong> ${quote.quoteDate || 'N/A'}</p>
      <p><strong>Amount:</strong> R${quote.amount}</p>
      <p><strong>Status:</strong> <span class="status">${quote.status}</span></p>
      <div class="actions">
        <button onclick="updateStatus(${quote.id}, 'Paid')">Mark as Paid</button>
      </div>
    `;
    invoicesList.appendChild(card);
  });
}