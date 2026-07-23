// --- API CONFIGURATION ---
const API_BASE_URL = 'http://localhost:5000';

// Global request helper that appends JWT token for authenticated routes
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('quickbite_jwt_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const config = {
    ...options,
    headers
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();
    
    if (!response.ok) {
      // Handle unauthorized expired token redirect
      if (response.status === 401 && state.user) {
        showToast("Session expired. Please log in again.", "info");
        logoutUser();
      }
      throw new Error(data.error || 'API request failed');
    }
    
    return data;
  } catch (err) {
    console.error(`API Fetch Error [${endpoint}]:`, err.message);
    throw err;
  }
}

// Banners are kept client-side for visual promo cards mapping to real restaurant IDs
const MOCK_PROMO_CAROUSALS = [
  {
    title: "50% Off Gourmet Burgers",
    desc: "Order from Burger Craft & Co. today and use code SAVE50",
    tag: "Special Offer",
    image: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80",
    restaurantId: 1
  },
  {
    title: "Free Sushi Delivery",
    desc: "Indulge in fresh rolls at Sakura Zen with zero delivery fees",
    tag: "Freebie",
    image: "https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=600&q=80",
    restaurantId: 3
  },
  {
    title: "1-for-1 Pizzas Today",
    desc: "Double the joy with La Bella Vita. Perfect for shared dinners",
    tag: "BOGO Offer",
    image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80",
    restaurantId: 2
  }
];


// --- APP STATE CONTROLLER ---
const state = {
  user: null, // Stores { id, name, email, address, phone, cardName, cardNumber, cardExpiry, cardCvv }
  currentRestaurant: null, // Active restaurant details object
  cart: [], // Stores { id, name, price, qty, restaurantId, restaurantName, deliveryFee }
  activePromo: null, // Active promo code details
  activeCategory: "All",
  activeDietFilter: "all",
  searchQuery: "",
  sortBy: "rating",
  favorites: [], // Array of favorite restaurant IDs
  location: "125 Cyber Plaza, High-Tech City"
};


// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
  initRouter();
  initLoginHandler();
  initCartListeners();
  initDashboardListeners();
  initMenuListeners();
  initCheckoutListeners();
  
  // Restore user session via token
  const token = localStorage.getItem("quickbite_jwt_token");
  if (token) {
    try {
      const data = await apiFetch('/profile');
      state.user = data.user;
      renderUserInfo();
      
      // Sync cart and favorites from database
      await syncCartAndFavorites();
      
      navigateTo("#/home");
    } catch (err) {
      console.warn("Session restore failed, redirecting to login:", err.message);
      logoutUser();
    }
  } else {
    navigateTo("#/auth");
  }
});

async function syncCartAndFavorites() {
  if (!state.user) return;
  try {
    // Get user cart
    const cartData = await apiFetch(`/cart/${state.user.id}`);
    state.cart = cartData;
    updateCartBadge();
    
    // Get user favorites
    const favsData = await apiFetch(`/favorites/${state.user.id}`);
    state.favorites = favsData.map(f => f.id);
  } catch (err) {
    console.error("Error syncing cart/favorites:", err.message);
  }
}


// --- ROUTING ENGINE ---
function initRouter() {
  window.addEventListener("hashchange", route);
  route();
}

function navigateTo(hash) {
  window.location.hash = hash;
}

async function route() {
  const hash = window.location.hash || "#/auth";
  
  // Close cart drawer whenever route changes
  document.getElementById("cartDrawerOverlay").classList.remove("active");
  
  // Check auth protection
  if (hash !== "#/auth" && !state.user) {
    window.location.hash = "#/auth";
    return;
  }
  
  // Hide all views
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  
  if (hash === "#/auth") {
    document.getElementById("authView").classList.add("active");
  } else {
    // Show core layout
    document.getElementById("appLayoutView").classList.add("active");
    
    // Sub-routing within layout
    document.querySelectorAll(".app-subview").forEach(sv => sv.style.display = "none");
    
    if (hash === "#/home") {
      document.getElementById("dashboardSubview").style.display = "block";
      await renderDashboard();
    } 
    else if (hash.startsWith("#/restaurant/")) {
      const id = parseInt(hash.split("/")[2]);
      try {
        const restaurant = await apiFetch(`/restaurants/${id}`);
        const menu = await apiFetch(`/restaurants/${id}/menu`);
        restaurant.menu = menu;
        
        state.currentRestaurant = restaurant;
        document.getElementById("restaurantSubview").style.display = "block";
        renderRestaurantDetail(restaurant);
      } catch (err) {
        showToast("Error loading restaurant details", "info");
        navigateTo("#/home");
      }
    } 
    else if (hash === "#/checkout") {
      if (state.cart.length === 0) {
        showToast("Your cart is empty!", "info");
        navigateTo("#/home");
        return;
      }
      document.getElementById("checkoutSubview").style.display = "block";
      renderCheckout();
    } 
    else if (hash.startsWith("#/tracking/")) {
      const orderId = hash.split("/")[2];
      document.getElementById("trackingSubview").style.display = "block";
      await renderOrderTracking(orderId);
    } 
    else {
      navigateTo("#/home");
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}


// --- AUTHENTICATION & PROFILE ---
function initLoginHandler() {
  const loginForm = document.getElementById("loginForm");
  const authTitle = document.getElementById("authTitle");
  const authDesc = document.getElementById("authDesc");
  const authSubmitBtn = document.getElementById("authSubmitBtn");
  const authSwitchLink = document.getElementById("authSwitchLink");
  
  let isRegistering = false;
  
  authSwitchLink.addEventListener("click", (e) => {
    e.preventDefault();
    isRegistering = !isRegistering;
    
    const nameGroup = document.getElementById("nameGroup");
    if (isRegistering) {
      nameGroup.style.display = "block";
      document.getElementById("loginName").required = true;
      authTitle.innerText = "Create Account";
      authDesc.innerText = "Join us and satisfy your food cravings today";
      authSubmitBtn.innerText = "Sign Up";
      authSwitchLink.innerHTML = 'Already have an account? <span class="btn-text">Sign In</span>';
    } else {
      nameGroup.style.display = "none";
      document.getElementById("loginName").required = false;
      authTitle.innerText = "Welcome Back";
      authDesc.innerText = "Enter your details to order fresh food";
      authSubmitBtn.innerText = "Sign In";
      authSwitchLink.innerHTML = 'New to QuickBite? <span class="btn-text">Sign Up</span>';
    }
    loginForm.reset();
  });
  
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    
    try {
      let data;
      if (isRegistering) {
        const name = document.getElementById("loginName").value.trim();
        data = await apiFetch('/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password })
        });
        showToast(`Account created successfully! Welcome, ${data.user.name}.`, "success");
      } else {
        data = await apiFetch('/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        showToast(`Logged in successfully! Welcome back, ${data.user.name}.`, "success");
      }
      
      localStorage.setItem("quickbite_jwt_token", data.token);
      state.user = data.user;
      renderUserInfo();
      
      // Sync cart and favorites
      await syncCartAndFavorites();
      
      navigateTo("#/home");
    } catch (err) {
      showToast(err.message || "Authentication failed. Please check details.", "info");
    }
  });
}

function renderUserInfo() {
  document.getElementById("profileName").innerText = state.user.name;
  document.getElementById("addressText").innerText = truncateString(state.user.address || state.location, 28);
}

function logoutUser() {
  state.user = null;
  state.cart = [];
  state.activePromo = null;
  state.favorites = [];
  localStorage.removeItem("quickbite_jwt_token");
  showToast("Logged out successfully.", "info");
  updateCartBadge();
  navigateTo("#/auth");
}


// --- DASHBOARD / HOME ---
function initDashboardListeners() {
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    renderRestaurantList();
  });
  
  const sortSelect = document.getElementById("sortSelect");
  sortSelect.addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    renderRestaurantList();
  });
}

async function renderDashboard() {
  renderPromos();
  renderCategories();
  await renderRestaurantList();
}

function renderPromos() {
  const container = document.getElementById("promoSlider");
  container.innerHTML = MOCK_PROMO_CAROUSALS.map(promo => `
    <div class="promo-card" style="background-image: url('${promo.image}')" onclick="navigateTo('#/restaurant/${promo.restaurantId}')">
      <div class="promo-overlay"></div>
      <div class="promo-content">
        <span class="promo-tag">${promo.tag}</span>
        <h3>${promo.title}</h3>
        <p>${promo.desc}</p>
        <button class="btn btn-primary" style="padding: 6px 14px; font-size: 0.8rem;">Order Now</button>
      </div>
    </div>
  `).join('');
}

function renderCategories() {
  const container = document.getElementById("categoriesContainer");
  const categories = ["All", "Burgers", "Pizza", "Sushi", "Healthy", "Asian", "Desserts"];
  
  const icons = {
    "All": `<svg viewBox="0 0 24 24"><path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`,
    "Burgers": `<svg viewBox="0 0 24 24"><path d="M12 2c-4 0-7 2.24-7 5h14c0-2.76-3-5-7-5zm-7 7v1h14V9H5zm0 3v2c0 2.2 1.8 4 4 4h6c2.2 0 4-1.8 4-4v-2H5zm2 5c-1.1 0-2-.9-2-2h12c0 1.1-.9 2-2 2H7z"/></svg>`,
    "Pizza": `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.74.56-3.35 1.5-4.66l11.16 11.16C15.35 19.44 13.74 20 12 20zm4.66-3.5L5.5 5.34C6.81 4.4 8.42 3.8 10.2 3.8c4.41 0 8 3.59 8 8 0 1.78-.6 3.39-1.54 4.7z"/></svg>`,
    "Sushi": `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8h16c0 4.42-3.58 8-8 8zm-6-9c0-2.21 2.69-4 6-4s6 1.79 6 4H6z"/></svg>`,
    "Healthy": `<svg viewBox="0 0 24 24"><path d="M17 8C14.24 8 12 10.24 12 13c0 2.76 2.24 5 5 5s5-2.24 5-5c0-2.76-2.24-5-5-5zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3zM7 2a5 5 0 0 0-5 5c0 4 5 11 5 11s5-7 5-11a5 5 0 0 0-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/></svg>`,
    "Asian": `<svg viewBox="0 0 24 24"><path d="M22 11h-2.1c-.5-3.3-3.1-5.9-6.4-6.4V2h-3v2.6C7.2 5.1 4.6 7.7 4.1 11H2v3h2.1c.5 3.3 3.1 5.9 6.4 6.4V23h3v-2.6c3.3-.5 5.9-3.1 6.4-6.4H22v-3zm-10 7c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/></svg>`,
    "Desserts": `<svg viewBox="0 0 24 24"><path d="M12 2a4 4 0 0 0-4 4v1.2c-2.3.4-4 2.4-4 4.8 0 2.7 2.2 5 5 5h6c2.8 0 5-2.3 5-5 0-2.4-1.7-4.4-4-4.8V6a4 4 0 0 0-4-4zm2 5.1c1.2.4 2 1.5 2 2.9H8c0-1.4.8-2.5 2-2.9V6a2 2 0 0 1 4 0v1.1zM18 19H6v2h12v-2z"/></svg>`
  };
  
  container.innerHTML = categories.map(cat => `
    <div class="category-card ${state.activeCategory === cat ? 'active' : ''}" onclick="selectCategory('${cat}')">
      <div class="category-icon-wrapper">
        ${icons[cat] || icons["All"]}
      </div>
      <span class="category-name">${cat}</span>
    </div>
  `).join('');
}

async function selectCategory(cat) {
  state.activeCategory = cat;
  renderCategories();
  await renderRestaurantList();
}

async function renderRestaurantList() {
  const container = document.getElementById("restaurantsGrid");
  
  try {
    // Fetch restaurants from backend with active query parameters
    const restaurants = await apiFetch(`/restaurants?category=${state.activeCategory}&search=${state.searchQuery}&sortBy=${state.sortBy}`);
    
    if (restaurants.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
          <p style="font-size: 1.2rem; font-weight: 500;">No restaurants match your filters.</p>
          <p style="font-size: 0.9rem; margin-top: 8px;">Try clearing your search query or choosing another category.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = restaurants.map(r => {
      const isFav = state.favorites.includes(r.id);
      return `
        <div class="restaurant-card">
          <div class="restaurant-image-wrapper" onclick="navigateTo('#/restaurant/${r.id}')">
            <img src="${r.image}" class="restaurant-image" alt="${r.name}" loading="lazy">
            <div class="card-gradient-overlay"></div>
            ${r.tag ? `
              <span class="offer-badge">
                <svg viewBox="0 0 24 24"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7c-.83 0-1.5-.67-1.5-1.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>
                ${r.tag}
              </span>
            ` : ''}
          </div>
          <button class="favorite-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, ${r.id})">
            <svg viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </button>
          <div class="restaurant-info" onclick="navigateTo('#/restaurant/${r.id}')">
            <div class="restaurant-info-header">
              <h3 class="restaurant-name">${r.name}</h3>
              <span class="restaurant-rating-badge">
                <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                ${r.rating}
              </span>
            </div>
            <p class="restaurant-cuisines">${r.cuisines.join(" • ")}</p>
            <div class="restaurant-meta">
              <div class="meta-item">
                <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                <span>${r.distance}</span>
              </div>
              <div class="meta-item">
                <svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm3.3 14.7L11 12.4V7h1.5v4.7l3.7 2.2-.7 1.1z"/></svg>
                <span>${r.deliveryTime}</span>
              </div>
              <div class="meta-item">
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>
                <span>Delivery: $${r.deliveryFee.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--primary);">Failed to load restaurants from server.</div>`;
  }
}

async function toggleFavorite(event, restaurantId) {
  event.stopPropagation();
  if (!state.user) return;
  
  const isFav = state.favorites.includes(restaurantId);
  try {
    if (isFav) {
      // Remove favorite
      await apiFetch('/favorites', {
        method: 'DELETE',
        body: JSON.stringify({ restaurantId })
      });
      state.favorites = state.favorites.filter(id => id !== restaurantId);
      showToast("Removed from favorites", "info");
    } else {
      // Add favorite
      await apiFetch('/favorites', {
        method: 'POST',
        body: JSON.stringify({ restaurantId })
      });
      state.favorites.push(restaurantId);
      showToast("Added to favorites!", "success");
    }
    
    // Sync UI rendering
    if (window.location.hash === "#/home") {
      await renderRestaurantList();
    } else {
      const btn = document.getElementById("detailFavBtn");
      if (btn) btn.classList.toggle("active");
    }
  } catch (err) {
    showToast("Error updating favorites", "info");
  }
}


// --- RESTAURANT DETAIL & MENU VIEW ---
function initMenuListeners() {
  const menuSearch = document.getElementById("menuSearchInput");
  menuSearch.addEventListener("input", (e) => {
    renderMenuItems(e.target.value.toLowerCase());
  });
}

function renderRestaurantDetail(restaurant) {
  const hero = document.getElementById("restaurantHero");
  hero.style.backgroundImage = `url('${restaurant.image}')`;
  
  document.getElementById("heroName").innerText = restaurant.name;
  document.getElementById("heroCuisines").innerText = restaurant.cuisines.join(" • ");
  document.getElementById("heroDistance").innerText = restaurant.distance;
  document.getElementById("heroTime").innerText = restaurant.deliveryTime;
  document.getElementById("heroDelFee").innerText = `Delivery: $${restaurant.deliveryFee.toFixed(2)}`;
  
  document.getElementById("heroRatingVal").innerHTML = `
    <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
    ${restaurant.rating}
  `;
  document.getElementById("heroRatingCount").innerText = `${restaurant.reviewsCount} reviews`;
  
  const detailFavBtn = document.getElementById("detailFavBtn");
  if (state.favorites.includes(restaurant.id)) {
    detailFavBtn.classList.add("active");
  } else {
    detailFavBtn.classList.remove("active");
  }
  
  state.activeDietFilter = "all";
  document.getElementById("menuSearchInput").value = "";
  
  const sidebarList = document.getElementById("menuNavList");
  const populars = restaurant.menu.filter(m => m.popular);
  const otherItems = restaurant.menu.filter(m => !m.popular);
  
  let sidebarHtml = `<li><a href="#sec-popular" class="menu-nav-link active" onclick="scrollToMenuSection(event, 'sec-popular')">Popular 🔥</a></li>`;
  if (otherItems.length > 0) {
    sidebarHtml += `<li><a href="#sec-mains" class="menu-nav-link" onclick="scrollToMenuSection(event, 'sec-mains')">All Dishes</a></li>`;
  }
  sidebarList.innerHTML = sidebarHtml;
  
  renderMenuItems();
}

function setDietFilter(type) {
  state.activeDietFilter = type;
  document.querySelectorAll(".diet-filter-btn").forEach(btn => btn.classList.remove("active"));
  document.getElementById(`diet-${type}`).classList.add("active");
  renderMenuItems();
}

function renderMenuItems(query = "") {
  const container = document.getElementById("menuContentArea");
  const restaurant = state.currentRestaurant;
  
  let populars = restaurant.menu.filter(m => m.popular);
  let allDishes = restaurant.menu;
  
  if (query) {
    populars = populars.filter(m => m.name.toLowerCase().includes(query) || m.description.toLowerCase().includes(query));
    allDishes = allDishes.filter(m => m.name.toLowerCase().includes(query) || m.description.toLowerCase().includes(query));
  }
  
  if (state.activeDietFilter !== "all") {
    populars = populars.filter(m => m.diet === state.activeDietFilter);
    allDishes = allDishes.filter(m => m.diet === state.activeDietFilter);
  }
  
  let html = `
    <div id="sec-popular" class="menu-section">
      <h3 class="menu-section-title">Popular Items</h3>
      <div class="dishes-grid">
        ${populars.length > 0 ? populars.map(dish => renderDishCard(dish)).join('') : '<p style="color: var(--text-muted); font-size: 0.9rem;">No popular items fit filters.</p>'}
      </div>
    </div>
    
    <div id="sec-mains" class="menu-section">
      <h3 class="menu-section-title">All Dishes</h3>
      <div class="dishes-grid">
        ${allDishes.length > 0 ? allDishes.map(dish => renderDishCard(dish)).join('') : '<p style="color: var(--text-muted); font-size: 0.9rem;">No dishes fit filters.</p>'}
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

function renderDishCard(dish) {
  const cartItem = state.cart.find(item => item.id === dish.id);
  const qty = cartItem ? cartItem.qty : 0;
  
  const vegSvg = `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="hsl(160, 84%, 39%)" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="hsl(160, 84%, 39%)"/></svg>`;
  const nonvegSvg = `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="hsl(14, 100%, 57%)" stroke-width="2"/><polygon points="12,7 17,16 7,16" fill="hsl(14, 100%, 57%)"/></svg>`;
  
  return `
    <div class="dish-card" id="dish-${dish.id}">
      <div class="dish-image-wrapper">
        <img src="${dish.image}" class="dish-image" alt="${dish.name}" loading="lazy">
        <span class="dish-diet-icon ${dish.diet}">
          ${dish.diet === 'veg' ? vegSvg : nonvegSvg}
        </span>
      </div>
      <div class="dish-info">
        <div class="dish-title-row">
          <h4 class="dish-title">${dish.name}</h4>
          <span class="dish-price">$${dish.price.toFixed(2)}</span>
        </div>
        <p class="dish-desc">${dish.description}</p>
        <div class="dish-action-row" id="dish-action-${dish.id}">
          ${qty > 0 ? `
            <div class="quantity-control">
              <button class="qty-btn" onclick="updateItemQuantity('${dish.id}', -1)">−</button>
              <span class="qty-val">${qty}</span>
              <button class="qty-btn" onclick="updateItemQuantity('${dish.id}', 1)">+</button>
            </div>
          ` : `
            <button class="add-to-cart-btn" onclick="addItemToCart('${dish.id}')">+ Add</button>
          `}
        </div>
      </div>
    </div>
  `;
}

function scrollToMenuSection(e, sectionId) {
  e.preventDefault();
  document.querySelectorAll(".menu-nav-link").forEach(link => link.classList.remove("active"));
  e.currentTarget.classList.add("active");
  const el = document.getElementById(sectionId);
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

function toggleDetailFavorite(event) {
  if (state.currentRestaurant) {
    toggleFavorite(event, state.currentRestaurant.id);
  }
}


// --- CART SYSTEM & DRAWER ---
function initCartListeners() {
  const overlay = document.getElementById("cartDrawerOverlay");
  const drawerBtn = document.getElementById("cartDrawerBtn");
  const closeBtn = document.getElementById("closeCartBtn");
  
  drawerBtn.addEventListener("click", () => {
    overlay.classList.add("active");
    renderCartDrawer();
  });
  
  closeBtn.addEventListener("click", () => {
    overlay.classList.remove("active");
  });
  
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.classList.remove("active");
    }
  });
}

function updateCartBadge() {
  const totalItems = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const badge = document.getElementById("cartBadge");
  if (totalItems > 0) {
    badge.innerText = totalItems;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

async function addItemToCart(dishId) {
  if (!state.user) return;
  const restaurant = state.currentRestaurant;
  const dish = restaurant.menu.find(m => m.id === dishId);
  
  // Rule check: items must belong to the same restaurant
  if (state.cart.length > 0 && state.cart[0].restaurantId !== restaurant.id) {
    const confirmClear = confirm("Adding this item will replace items from the other restaurant. Clear cart?");
    if (!confirmClear) return;
    try {
      // Clear database cart
      for (const item of state.cart) {
        await apiFetch(`/cart/${item.id}`, { method: 'DELETE' });
      }
      state.cart = [];
      state.activePromo = null;
    } catch (err) {
      showToast("Error clearing previous cart items", "info");
      return;
    }
  }
  
  try {
    // Add item to backend database
    await apiFetch('/cart', {
      method: 'POST',
      body: JSON.stringify({ menuItemId: dishId, quantity: 1 })
    });
    
    // Refresh local cart
    await syncCartAndFavorites();
    syncMenuCardQuantity(dishId);
    showToast(`${dish.name} added to cart!`, "success");
  } catch (err) {
    showToast("Failed to add item to cart", "info");
  }
}

async function updateItemQuantity(dishId, change) {
  if (!state.user) return;
  
  const item = state.cart.find(c => c.id === dishId);
  if (!item) return;
  
  const newQty = item.qty + change;
  
  try {
    await apiFetch('/cart', {
      method: 'POST',
      body: JSON.stringify({ menuItemId: dishId, quantity: newQty })
    });
    
    await syncCartAndFavorites();
    syncMenuCardQuantity(dishId);
    renderCartDrawer();
    
    if (window.location.hash === "#/checkout") {
      renderCheckoutSummary();
    }
  } catch (err) {
    showToast("Error updating item quantity", "info");
  }
}

function syncMenuCardQuantity(dishId) {
  const target = document.getElementById(`dish-action-${dishId}`);
  if (!target) return;
  
  const item = state.cart.find(c => c.id === dishId);
  const qty = item ? item.qty : 0;
  
  if (qty > 0) {
    target.innerHTML = `
      <div class="quantity-control">
        <button class="qty-btn" onclick="updateItemQuantity('${dishId}', -1)">−</button>
        <span class="qty-val">${qty}</span>
        <button class="qty-btn" onclick="updateItemQuantity('${dishId}', 1)">+</button>
      </div>
    `;
  } else {
    target.innerHTML = `
      <button class="add-to-cart-btn" onclick="addItemToCart('${dishId}')">+ Add</button>
    `;
  }
}

function renderCartDrawer() {
  const container = document.getElementById("cartItemsList");
  
  if (state.cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart-view">
        <svg class="empty-cart-icon" viewBox="0 0 24 24">
          <path d="M17.21 9l-4.38-6.56a1 1 0 0 0-1.66 0L6.79 9H2c-.55 0-1 .45-1 1 0 .09.01.18.04.27l2.54 9.27A3 3 0 0 0 6.4 22h11.2a3 3 0 0 0 2.82-2.46l2.54-9.27L23 10a1 1 0 0 0-1-1h-4.79zM9 9l3-4.5L15 9H9zm9.4 10.54a1 1 0 0 1-.94.76H6.54a1 1 0 0 1-.94-.76L3.27 11h17.46l-2.33 8.54z"/>
        </svg>
        <p style="font-size: 1.1rem; font-weight: 600;">Your Cart is Empty</p>
        <p style="font-size: 0.85rem;">Browse our high-quality restaurant lists and add items.</p>
        <button class="btn btn-primary" onclick="document.getElementById('cartDrawerOverlay').classList.remove('active'); navigateTo('#/home')">Explore Food</button>
      </div>
    `;
    document.getElementById("cartFooter").style.display = "none";
    return;
  }
  
  document.getElementById("cartFooter").style.display = "flex";
  
  container.innerHTML = state.cart.map(item => `
    <div class="cart-item">
      <img src="${item.image}" class="cart-item-img" alt="${item.name}">
      <div class="cart-item-details">
        <div>
          <h4 class="cart-item-title">${item.name}</h4>
          <p class="cart-item-desc">${truncateString(item.description, 50)}</p>
        </div>
        <div class="cart-item-bottom">
          <span class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</span>
          <div class="cart-item-qty">
            <button class="qty-btn" onclick="updateItemQuantity('${item.id}', -1)">−</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn" onclick="updateItemQuantity('${item.id}', 1)">+</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
  
  calculatePricing();
}

function calculatePricing() {
  const itemsSubtotal = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const deliveryFee = state.cart[0].deliveryFee;
  const platformFee = 0.99;
  const tax = itemsSubtotal * 0.08;
  
  let discount = 0;
  if (state.activePromo) {
    if (state.activePromo.type === "percent") {
      discount = itemsSubtotal * state.activePromo.discount;
    } else if (state.activePromo.type === "flat") {
      discount = Math.min(itemsSubtotal, state.activePromo.discount);
    } else if (state.activePromo.type === "delivery") {
      discount = deliveryFee;
    }
  }
  
  const grandTotal = Math.max(0, itemsSubtotal + deliveryFee + platformFee + tax - discount);
  
  document.getElementById("subtotalPrice").innerText = `$${itemsSubtotal.toFixed(2)}`;
  document.getElementById("deliveryPrice").innerText = `$${deliveryFee.toFixed(2)}`;
  document.getElementById("platformPrice").innerText = `$${platformFee.toFixed(2)}`;
  document.getElementById("taxPrice").innerText = `$${tax.toFixed(2)}`;
  document.getElementById("grandTotalPrice").innerText = `$${grandTotal.toFixed(2)}`;
  
  const discountRow = document.getElementById("discountRow");
  if (discount > 0) {
    discountRow.style.display = "flex";
    document.getElementById("discountPrice").innerText = `-$${discount.toFixed(2)}`;
  } else {
    discountRow.style.display = "none";
  }
}

async function applyPromoCode() {
  const input = document.getElementById("promoInput").value.trim().toUpperCase();
  const status = document.getElementById("promoStatus");
  
  if (!input) return;
  
  try {
    const data = await apiFetch('/applyPromo', {
      method: 'POST',
      body: JSON.stringify({ code: input })
    });
    
    state.activePromo = data;
    status.innerText = `Applied: "${data.description}"`;
    status.className = "promo-status success";
    calculatePricing();
    showToast(`Code "${input}" applied!`, "success");
  } catch (err) {
    status.innerText = err.message || "Invalid promotion code.";
    status.className = "promo-status error";
  }
}

function proceedToCheckout() {
  document.getElementById("cartDrawerOverlay").classList.remove("active");
  navigateTo("#/checkout");
}


// --- CHECKOUT & CREDIT CARD SIMULATION ---
function initCheckoutListeners() {
  const cardNum = document.getElementById("checkoutCardNumber");
  const cardName = document.getElementById("checkoutCardName");
  const cardExpiry = document.getElementById("checkoutCardExpiry");
  const cardCvv = document.getElementById("checkoutCardCvv");
  const creditCard = document.getElementById("creditCardPreview");
  
  cardNum.addEventListener("input", (e) => {
    let val = e.target.value.replace(/\D/g, "");
    val = val.substring(0, 16);
    const parts = [];
    for (let i = 0; i < val.length; i += 4) {
      parts.push(val.substring(i, i + 4));
    }
    const formatted = parts.join(" ");
    e.target.value = formatted;
    document.getElementById("ccDisplayNumber").innerText = formatted || "•••• •••• •••• ••••";
  });
  
  cardName.addEventListener("input", (e) => {
    document.getElementById("ccDisplayName").innerText = e.target.value.toUpperCase() || "CARDHOLDER NAME";
  });
  
  cardExpiry.addEventListener("input", (e) => {
    let val = e.target.value.replace(/\D/g, "");
    val = val.substring(0, 4);
    if (val.length > 2) {
      val = val.substring(0, 2) + "/" + val.substring(2);
    }
    e.target.value = val;
    document.getElementById("ccDisplayExpiry").innerText = val || "MM/YY";
  });
  
  cardCvv.addEventListener("focus", () => {
    creditCard.classList.add("flipped");
  });
  cardCvv.addEventListener("blur", () => {
    creditCard.classList.remove("flipped");
  });
  cardCvv.addEventListener("input", (e) => {
    let val = e.target.value.replace(/\D/g, "");
    val = val.substring(0, 3);
    e.target.value = val;
    document.getElementById("ccDisplayCvv").innerText = val || "•••";
  });
  
  const form = document.getElementById("checkoutForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await processOrderCheckout();
  });
}

function selectPaymentMethod(method, card) {
  document.querySelectorAll(".payment-method-card").forEach(c => c.classList.remove("active"));
  card.classList.add("active");
  
  const ccFields = document.getElementById("creditCardFields");
  if (method === "card") {
    ccFields.style.display = "block";
  } else {
    ccFields.style.display = "none";
  }
}

function renderCheckout() {
  document.getElementById("checkoutName").value = state.user.name;
  document.getElementById("checkoutAddress").value = state.user.address || state.location;
  
  document.getElementById("checkoutCardName").value = state.user.cardName || '';
  document.getElementById("checkoutCardNumber").value = state.user.cardNumber || '';
  document.getElementById("checkoutCardExpiry").value = state.user.cardExpiry || '';
  document.getElementById("checkoutCardCvv").value = state.user.cardCvv || '';
  
  document.getElementById("ccDisplayName").innerText = state.user.cardName || 'CARDHOLDER NAME';
  document.getElementById("ccDisplayNumber").innerText = state.user.cardNumber || '•••• •••• •••• ••••';
  document.getElementById("ccDisplayExpiry").innerText = state.user.cardExpiry || 'MM/YY';
  document.getElementById("ccDisplayCvv").innerText = state.user.cardCvv || '•••';
  
  renderCheckoutSummary();
}

function renderCheckoutSummary() {
  const container = document.getElementById("summaryItemsList");
  container.innerHTML = state.cart.map(item => `
    <div class="summary-item">
      <span class="summary-item-qty-name">${item.qty}x ${item.name}</span>
      <span class="summary-item-price">$${(item.price * item.qty).toFixed(2)}</span>
    </div>
  `).join('');
  
  const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const delivery = state.cart[0].deliveryFee;
  const platform = 0.99;
  const tax = subtotal * 0.08;
  
  let discount = 0;
  if (state.activePromo) {
    if (state.activePromo.type === "percent") {
      discount = subtotal * state.activePromo.discount;
    } else if (state.activePromo.type === "flat") {
      discount = Math.min(subtotal, state.activePromo.discount);
    } else if (state.activePromo.type === "delivery") {
      discount = delivery;
    }
  }
  
  const grandTotal = Math.max(0, subtotal + delivery + platform + tax - discount);
  
  document.getElementById("summarySubtotal").innerText = `$${subtotal.toFixed(2)}`;
  document.getElementById("summaryDelivery").innerText = `$${delivery.toFixed(2)}`;
  document.getElementById("summaryPlatform").innerText = `$${platform.toFixed(2)}`;
  document.getElementById("summaryTax").innerText = `$${tax.toFixed(2)}`;
  document.getElementById("summaryGrandTotal").innerText = `$${grandTotal.toFixed(2)}`;
  document.getElementById("payNowBtn").innerText = `Pay $${grandTotal.toFixed(2)}`;
  
  const discountRow = document.getElementById("summaryDiscountRow");
  if (discount > 0) {
    discountRow.style.display = "flex";
    document.getElementById("summaryDiscount").innerText = `-$${discount.toFixed(2)}`;
  } else {
    discountRow.style.display = "none";
  }
}

async function processOrderCheckout() {
  const recipientName = document.getElementById("checkoutName").value.trim();
  const shippingAddress = document.getElementById("checkoutAddress").value.trim();
  const phoneNumber = document.getElementById("checkoutPhone").value.trim();
  
  if (!recipientName || !shippingAddress || !phoneNumber) {
    showToast("Please complete delivery name, address, and phone.", "info");
    return;
  }
  
  const paymentMethod = document.querySelector(".payment-method-card.active").dataset.method;
  let cardLastFour = null;
  
  if (paymentMethod === "card") {
    const cardNum = document.getElementById("checkoutCardNumber").value.replace(/\s/g, "");
    const cardName = document.getElementById("checkoutCardName").value.trim();
    const expiry = document.getElementById("checkoutCardExpiry").value.trim();
    const cvv = document.getElementById("checkoutCardCvv").value.trim();
    
    if (cardNum.length < 16 || !cardName || expiry.length < 5 || cvv.length < 3) {
      showToast("Please check your credit card details.", "info");
      return;
    }
    cardLastFour = cardNum.slice(-4);
  }
  
  const overlay = document.getElementById("paymentProcessingOverlay");
  overlay.classList.add("active");
  
  const orderPayload = {
    restaurantId: state.cart[0].restaurantId,
    items: state.cart.map(item => ({ id: item.id, qty: item.qty })),
    promoCode: state.activePromo ? state.activePromo.code : null,
    recipientName,
    shippingAddress,
    phoneNumber,
    paymentMethod,
    cardLastFour
  };
  
  try {
    // Send order payload to backend
    const data = await apiFetch('/orders', {
      method: 'POST',
      body: JSON.stringify(orderPayload)
    });
    
    // Wait for the simulated payment processing
    setTimeout(() => {
      overlay.classList.remove("active");
      
      // Reset local cart
      state.cart = [];
      state.activePromo = null;
      updateCartBadge();
      
      showToast("Order placed successfully!", "success");
      navigateTo(`#/tracking/${data.orderId}`);
    }, 2500);
  } catch (err) {
    overlay.classList.remove("active");
    showToast(err.message || "Failed to process checkout transaction.", "info");
  }
}


// --- ORDER TRACKING TIMELINE ---
let trackingInterval = null;

async function renderOrderTracking(orderId) {
  if (trackingInterval) clearInterval(trackingInterval);
  
  document.getElementById("trackingOrderId").innerText = `Order ID: ${orderId}`;
  
  const steps = [
    { id: "step-ordered", linePercent: 0 },
    { id: "step-preparing", linePercent: 33 },
    { id: "step-dispatched", linePercent: 66 },
    { id: "step-delivered", linePercent: 100 }
  ];
  
  document.querySelectorAll(".timeline-step").forEach(step => {
    step.classList.remove("active", "completed");
  });
  
  document.getElementById("step-ordered").classList.add("active");
  const progLine = document.getElementById("timelineProgressLine");
  
  if (window.innerWidth <= 768) {
    progLine.style.height = "0%";
    progLine.style.width = "4px";
  } else {
    progLine.style.width = "0%";
    progLine.style.height = "4px";
  }
  
  let currentStage = 0;
  
  // Keep timeline tracking updates (real order values pulling from db is supported, local timeline runs)
  trackingInterval = setInterval(() => {
    if (currentStage >= 3) {
      clearInterval(trackingInterval);
      return;
    }
    
    const prevEl = document.getElementById(steps[currentStage].id);
    prevEl.classList.remove("active");
    prevEl.classList.add("completed");
    
    currentStage++;
    
    const currEl = document.getElementById(steps[currentStage].id);
    currEl.classList.add("active");
    
    if (window.innerWidth <= 768) {
      progLine.style.height = `${steps[currentStage].linePercent}%`;
    } else {
      progLine.style.width = `${steps[currentStage].linePercent}%`;
    }
    
    const stagesText = [
      "Your order is confirmed!",
      "Chef is preparing your gourmet dish 🍳",
      "Rider has picked up your food! 🛵",
      "Food delivered! Bon Appétit! 🍽️"
    ];
    showToast(stagesText[currentStage], "info");
    
    if (currentStage === 3) {
      showToast("Order tracking complete.", "success");
    }
  }, 5000);
}


// --- TOAST NOTIFICATIONS ---
function showToast(message, type = "success") {
  const container = document.getElementById("notificationContainer");
  
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  const checkSvg = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;
  const infoSvg = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`;
  const closeSvg = `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
  
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? checkSvg : infoSvg}</span>
    <span class="toast-message">${message}</span>
    <span class="toast-close" onclick="this.parentElement.remove()">${closeSvg}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-20px) scale(0.9)";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}


// --- HELPERS ---
function truncateString(str, num) {
  if (!str) return '';
  if (str.length <= num) return str;
  return str.slice(0, num) + "...";
}
