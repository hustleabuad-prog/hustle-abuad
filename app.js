// --- 0. Initialize Supabase ---
const SB_URL = "https://povwoiqpyifnqofzeyfq.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvdndvaXFweWlmbnFvZnpleWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDU3ODQsImV4cCI6MjA5MDQ4MTc4NH0.bG7RZkabX6UXWrJun8m-PGFWUN5QYra9jKXWflJehXA";
const _supabase = window.supabase.createClient(SB_URL, SB_KEY);

// --- 1. Theme Logic ---
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const savedTheme = localStorage.getItem('hustle_theme') || 'dark';

document.documentElement.setAttribute('data-theme', savedTheme);
themeIcon.innerText = savedTheme === 'dark' ? '☀️' : '🌙';

themeToggleBtn.onclick = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('hustle_theme', newTheme);
    themeIcon.innerText = newTheme === 'dark' ? '☀️' : '🌙';
};

// --- 1.5 Mobile Menu Logic ---
const mobileBtn = document.getElementById('mobile-menu-btn');
const navLinks = document.getElementById('nav-links');

mobileBtn.onclick = () => {
    navLinks.classList.toggle('active');
};

// --- 2. State & Elements ---
let allGigs = [];
let currentFilter = 'All';
let isLogin = false;

const gigsContainer = document.getElementById('gigs-container');
const searchInput = document.getElementById('search-gigs');
const pills = document.querySelectorAll('.pill');
const feedTitle = document.getElementById('feed-title');
const backBtn = document.getElementById('back-to-all');

// --- 3. Auth UI & Logic ---
document.getElementById('open-signup').onclick = () => { isLogin = false; openModal(); navLinks.classList.remove('active');};
document.getElementById('open-login').onclick = () => { isLogin = true; openModal(); navLinks.classList.remove('active');};
document.getElementById('close-modal').onclick = () => document.getElementById('auth-modal').classList.remove('active');
document.getElementById('toggle-auth-type').onclick = (e) => { e.preventDefault(); isLogin = !isLogin; openModal(); };

function openModal() {
    document.getElementById('modal-title').innerText = isLogin ? "Welcome Back" : "Join Hustle";
    document.getElementById('auth-submit-btn').innerText = isLogin ? "Log In" : "Create Account";
    document.getElementById('signup-only-fields').style.display = isLogin ? 'none' : 'block';
    
    document.getElementById('auth-name').required = !isLogin;
    document.getElementById('auth-whatsapp').required = !isLogin;
    
    document.getElementById('auth-modal').classList.add('active');
}

document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const submitBtn = document.getElementById('auth-submit-btn');
    
    submitBtn.innerText = "Loading...";
    submitBtn.disabled = true;

    if (isLogin) {
        // LOGIN
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) { alert(error.message); submitBtn.disabled = false; submitBtn.innerText = "Log In"; return; }
        const { data: prof } = await _supabase.from('profiles').select('*').eq('id', data.user.id).single();
        localStorage.setItem('hustle_session', JSON.stringify(prof));
    } else {
        // SIGNUP
        const name = document.getElementById('auth-name').value;
        const countryCode = document.getElementById('auth-country-code').value;
        let rawNumber = document.getElementById('auth-whatsapp').value;
        
        rawNumber = rawNumber.replace(/\D/g, ''); 
        if (rawNumber.startsWith('0')) { rawNumber = rawNumber.substring(1); }
        const finalWhatsapp = `${countryCode}${rawNumber}`;

        const { data, error } = await _supabase.auth.signUp({ email, password });
        if (error) { alert(error.message); submitBtn.disabled = false; submitBtn.innerText = "Create Account"; return; }
        
        await _supabase.from('profiles').insert([{ id: data.user.id, full_name: name, whatsapp: finalWhatsapp }]);
        localStorage.setItem('hustle_session', JSON.stringify({ full_name: name, whatsapp: finalWhatsapp, id: data.user.id }));
    }
    location.reload();
};

// --- 4. Gigs Logic ---
async function loadGigs(filterByUser = false) {
    let query = _supabase.from('gigs').select('*, profiles(whatsapp, full_name)').order('created_at', { ascending: false });
    
    if (filterByUser) {
        const { data: { user } } = await _supabase.auth.getUser();
        if(!user) return alert("Please log in first.");
        query = query.eq('poster_id', user.id);
        feedTitle.innerText = "My Posted Gigs";
        backBtn.style.display = "block";
    } else {
        feedTitle.innerText = "Active Feed";
        backBtn.style.display = "none";
    }

    const { data, error } = await query;
    if (data) {
        allGigs = data;
        filterAndRender();
    }
}

function filterAndRender() {
    const term = searchInput.value.toLowerCase();
    const filtered = allGigs.filter(g => {
        const matchesSearch = g.title.toLowerCase().includes(term) || g.description.toLowerCase().includes(term);
        const matchesCat = currentFilter === 'All' || g.category === currentFilter;
        return matchesSearch && matchesCat;
    });

    const session = JSON.parse(localStorage.getItem('hustle_session'));
    const currentUserId = session?.id || null;

    if (filtered.length === 0) {
        gigsContainer.innerHTML = `
            <div class="empty-state">
                <h3>No gigs found 🏜️</h3>
                <p>Looks like there's nothing matching your search right now.</p>
                ${session ? `<button class="btn-primary" onclick="document.getElementById('gTitle').focus()">Be the first to post!</button>` : ''}
            </div>
        `;
        return;
    }

    gigsContainer.innerHTML = filtered.map(g => {
        const isOwner = g.poster_id === currentUserId;
        const waLink = `https://wa.me/${g.profiles?.whatsapp}?text=Hi, I saw your gig "${g.title}"!`;
        const isFilled = g.is_filled;
        
        let actionHTML = '';
        if (isFilled) {
            actionHTML = `<button class="btn-action" style="background: transparent; border: 1px dashed var(--glass-border); color: var(--text-dim);" disabled>Completed</button>
                          ${isOwner ? `<button class="btn-delete" onclick="deleteGig(${g.id})">Delete Gig Permanently</button>` : ''}`;
        } else if (isOwner) {
            actionHTML = `<button class="btn-action" onclick="markGigFilled(${g.id})">Mark as Filled ✓</button>
                          <button class="btn-delete" onclick="deleteGig(${g.id})">Delete Gig</button>`;
        } else {
            actionHTML = `<a href="${waLink}" target="_blank" class="btn-primary w-full" style="padding:10px;">Accept Gig 💬</a>`;
        }

        return `
            <div class="gig-card ${isFilled ? 'filled' : ''}">
                <div style="display:flex; justify-content:space-between; align-items: center; margin-bottom:12px;">
                    <span style="color:var(--cyber-cyan); font-weight:800; font-size:0.8rem;">${g.category}</span> 
                    ${isFilled ? `<span class="badge-filled">FILLED</span>` : `<span style="font-weight: 800;">${g.price}</span>`}
                </div>
                <h3>${g.title}</h3>
                <p style="color:var(--text-dim); margin:15px 0; font-size:0.9rem;">${g.description}</p>
                ${actionHTML}
            </div>
        `;
    }).join('');
}

// --- 5. Status & Actions ---
window.markGigFilled = async (id) => {
    if (confirm("Mark this gig as filled? It will be greyed out for others.")) {
        await _supabase.from('gigs').update({ is_filled: true }).eq('id', id);
        loadGigs(feedTitle.innerText === "My Posted Gigs");
    }
};

window.deleteGig = async (id) => {
    if (confirm("Are you sure you want to delete this gig entirely?")) {
        await _supabase.from('gigs').delete().eq('id', id);
        loadGigs(feedTitle.innerText === "My Posted Gigs");
    }
};

// --- 6. Filters & Form ---
searchInput.oninput = filterAndRender;
pills.forEach(pill => {
    pill.onclick = () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentFilter = pill.dataset.cat;
        filterAndRender();
    };
});

document.getElementById('view-my-gigs').onclick = () => {
    navLinks.classList.remove('active'); // Close mobile menu
    loadGigs(true);
};
backBtn.onclick = () => {
    currentFilter = 'All';
    pills.forEach(p => p.classList.remove('active'));
    pills[0].classList.add('active');
    searchInput.value = '';
    loadGigs(false);
};

document.getElementById('gig-form').onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-gig-btn');
    submitBtn.innerText = "Publishing...";
    submitBtn.disabled = true;

    const { data: { user } } = await _supabase.auth.getUser();
    
    const gig = {
        title: document.getElementById('gTitle').value,
        price: document.getElementById('gPrice').value,
        description: document.getElementById('gDesc').value,
        category: document.getElementById('gCategory').value,
        poster_id: user.id,
        is_filled: false
    };

    const { error } = await _supabase.from('gigs').insert([gig]);
    if (error) {
        alert(error.message);
        submitBtn.innerText = "Publish Gig";
        submitBtn.disabled = false;
    } else {
        location.reload();
    }
};

// --- 7. Start App ---
loadGigs();
const session = JSON.parse(localStorage.getItem('hustle_session'));
if (session) {
    document.getElementById('logged-out-state').style.display = 'none';
    document.getElementById('logged-in-state').style.display = 'flex';
    document.getElementById('post-gig-area').style.display = 'block';
    document.getElementById('display-name').innerText = session.full_name.split(' ')[0];
}

document.getElementById('logout-btn').onclick = () => {
    localStorage.removeItem('hustle_session');
    _supabase.auth.signOut();
    location.reload();
};