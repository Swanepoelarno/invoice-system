const API_URL = 'http://localhost:3000';

const form = document.getElementById('quoteForm');
const quotesList = document.getElementById('quotesList');
const quotesHeading = document.getElementById('quotesHeading');

// Load all quotes when the page opens
window.onload = function() {
  fetchQuotes();
};

// Fetch all quotes from the backend
function fetchQuotes() {
  fetch(`${API_URL}/quotes`)
    .then(function(response) {
      return response.json();
    })
    .then(function(quotes) {
      displayQuotes(quotes);
    });
}

// Save a new quote
form.addEventListener('submit', function(event) {
  event.preventDefault();

  const clientName = document.getElementById('clientName').value;
  const serviceDescription = document.getElementById('serviceDescription').value;
  const amount = document.getElementById('amount').value;

  fetch(`${API_URL}/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientName, serviceDescription, amount })
  })
    .then(function(response) {
      return response.json();
    })
    .then(function() {
      form.reset();
      fetchQuotes();
    });
});

// Update quote status
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

// Display quotes on the page
function displayQuotes(quotes) {
  if (quotes.length === 0) {
    quotesHeading.style.display = 'none';
    quotesList.innerHTML = '';
    return;
  }

  quotesHeading.style.display = 'block';
  quotesList.innerHTML = '';

  quotes.forEach(function(quote) {
    const card = document.createElement('div');
    card.className = 'quote-card';
    card.innerHTML = `
      <p><strong>Client:</strong> ${quote.clientName}</p>
      <p><strong>Service:</strong> ${quote.serviceDescription}</p>
      <p><strong>Amount:</strong> R${quote.amount}</p>
      <p><strong>Status:</strong> <span class="status">${quote.status}</span></p>
      <div class="actions">
        <button onclick="updateStatus(${quote.id}, 'Sent')">Mark as Sent</button>
        <button onclick="updateStatus(${quote.id}, 'Approved')">Mark as Approved</button>
        <button onclick="updateStatus(${quote.id}, 'Invoiced')">Mark as Invoiced</button>
        <button onclick="updateStatus(${quote.id}, 'Paid')">Mark as Paid</button>
      </div>
    `;
    quotesList.appendChild(card);
  });
}