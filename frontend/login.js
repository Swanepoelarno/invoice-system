const API_URL = 'http://localhost:3000';

const form = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

// If already logged in send to dashboard
if (localStorage.getItem('token')) {
  window.location.href = 'index.html';
}

form.addEventListener('submit', function(event) {
  event.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      if (data.token) {
        localStorage.setItem('token', data.token);
        window.location.href = 'index.html';
      } else {
        loginError.style.display = 'block';
      }
    })
    .catch(function() {
      loginError.style.display = 'block';
    });
});